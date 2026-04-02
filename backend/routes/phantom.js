// ============================================================
//  routes/phantom.js  – API Phantom ID
//  BUG 1 FIX : JWT généré ET vérifié via middleware verifyJWT
//  BUG 2 FIX : Admin ne peut pas voter (check backend)
//  FEATURE 1  : Wallet pré-assigné par CIN
//  FEATURE 2  : Liste noire militaire
// ============================================================
const express   = require("express");
const crypto    = require("crypto");
const jwt       = require("jsonwebtoken");
const { ethers } = require("ethers");
const { body, validationResult } = require("express-validator");

const FakeID    = require("../models/FakeID");
const Voter     = require("../models/Voter");
const Blacklist = require("../models/Blacklist");
const { registerVoterOnChain, getVoterStatusOnChain } = require("../services/blockchain");
const { phantomLimiter } = require("../middleware/rateLimiter");
const { sendMilitaryAlert, sendRegistrationConfirmation } = require("../services/emailService");

const router = express.Router();

// ── Professions bloquées (Article 47) ────────────────────────
const BLOCKED_PROFESSIONS = [
  "Militaire",
  "Forces Armées Royales",
  "Gendarmerie",
  "Police Nationale",
  "Protection Civile",
];

// ============================================================
//  MIDDLEWARE : verifyJWT (BUG 1 FIX)
//  Usage : router.get('/protected', verifyJWT, handler)
// ============================================================
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.headers["x-auth-token"];

  if (!token) {
    return res.status(401).json({ success: false, message: "Token JWT manquant" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.voter = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.name === "TokenExpiredError"
        ? "Session expirée. Veuillez vous réinscrire."
        : "Token JWT invalide",
    });
  }
}

// ============================================================
//  POST /api/phantom/verify
// ============================================================
router.post(
  "/verify",
  phantomLimiter,
  [
    body("cin")
      .notEmpty().withMessage("Le CIN est requis")
      .isLength({ min: 6, max: 12 }).withMessage("Format CIN invalide")
      .toUpperCase(),
    body("walletAddress")
      .notEmpty().withMessage("L'adresse wallet est requise")
      .matches(/^0x[a-fA-F0-9]{40}$/).withMessage("Adresse Ethereum invalide"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { cin, walletAddress } = req.body;
    const clientIp    = req.ip || req.connection.remoteAddress;
    const walletLower = walletAddress.toLowerCase();
    const idHash      = hashCIN(cin);

    try {
      // ── BUG 2 : L'admin ne peut pas voter ────────────────────
      const ownerWallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY);
      if (walletLower === ownerWallet.address.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "L'administrateur ne peut pas voter.",
        });
      }

      // ── 1. CIN valide dans Phantom ID ? ──────────────────────
      const idRecord = await FakeID.findOne({ cin: cin.toUpperCase() });
      if (!idRecord) {
        return res.status(404).json({
          success: false,
          message: "CIN introuvable dans la base nationale.",
        });
      }
      if (!idRecord.isValid) {
        return res.status(403).json({
          success: false,
          message: "Ce CIN est expiré ou révoqué.",
        });
      }

      // ── FEATURE 2 : Vérification profession militaire ────────
      if (idRecord.profession && BLOCKED_PROFESSIONS.includes(idRecord.profession)) {
        // Enregistrer dans la liste noire
        await Blacklist.create({
          wallet:     walletLower,
          cinHash:    idHash,
          profession: idRecord.profession,
          city:       idRecord.city,
          ipAddress:  clientIp,
          reason:     "Les membres des forces de sécurité ne sont pas autorisés à voter (Article 47)",
        });

        // Alerte email admin (non-bloquante)
        sendMilitaryAlert(walletLower, idHash, idRecord.profession, idRecord.city)
          .catch(e => console.error("Email alert failed:", e.message));

        console.log(`🚨 Tentative militaire bloquée — ${idRecord.profession} — ${idRecord.city}`);

        return res.status(403).json({
          success: false,
          message: `Les membres des forces de sécurité ne sont pas autorisés à voter (Article 47)`,
          profession: idRecord.profession,
          blocked: true,
        });
      }

      // ── FEATURE 1 : Vérification wallet pré-assigné ──────────
      if (idRecord.walletAddress) {
        if (walletLower !== idRecord.walletAddress.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Ce CIN est assigné au wallet ${idRecord.walletAddress}. Connectez le bon wallet MetaMask.`,
            assignedWallet: idRecord.walletAddress,
          });
        }
      }

      // ── 2. Déjà enregistré on-chain avec ce wallet ? ─────────
      const existingVoter = await Voter.findOne({ walletAddress: walletLower });
      if (existingVoter && existingVoter.registeredOnChain) {
        return res.status(409).json({
          success: false,
          message: "Cet électeur est déjà enregistré.",
          voterProfile: {
            fullName: idRecord.fullName,
            city:     idRecord.city,
          },
        });
      }

      // ── 3. Ce CIN déjà utilisé par un AUTRE wallet ? ─────────
      const cinUsedByOther = await Voter.findOne({
        idHash,
        walletAddress: { $ne: walletLower },
        registeredOnChain: true,
      });
      if (cinUsedByOther) {
        return res.status(403).json({
          success: false,
          message: "Ce CIN est déjà associé à un autre wallet.",
        });
      }

      // ── 4. Enregistrement on-chain ────────────────────────────
      let txHash = null;
      try {
        txHash = await registerVoterOnChain(walletLower, idHash);
      } catch (blockchainError) {
        console.error("❌ Erreur blockchain :", blockchainError.message);
        return res.status(500).json({
          success: false,
          message: blockchainError.message,
        });
      }

      // ── 5. Sauvegarde MongoDB ─────────────────────────────────
      await Voter.findOneAndUpdate(
        { walletAddress: walletLower },
        {
          idHash,
          walletAddress:     walletLower,
          registeredOnChain: true,
          txHash,
          riskScore:         0,
          $addToSet:         { ipAddresses: clientIp },
          $inc:              { attemptCount: 1 },
        },
        { upsert: true, new: true }
      );

      // Marquer CIN comme utilisé
      idRecord.usedForVoting = true;
      await idRecord.save();

      // ── 6. JWT ────────────────────────────────────────────────
      const token = jwt.sign(
        { walletAddress: walletLower, idHash, registered: true },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      // ── 7. Email de confirmation (non-bloquant) ───────────────
      if (idRecord.email) {
        sendRegistrationConfirmation(idRecord.email, idRecord.fullName, idRecord.city, txHash)
          .catch(e => console.error("Email confirmation failed:", e.message));
      }

      console.log(`✅ Inscrit – Wallet: ${walletLower} | TX: ${txHash}`);

      return res.status(200).json({
        success: true,
        message: "Identité vérifiée. Électeur enregistré avec succès.",
        token,
        txHash,
        voterProfile: {
          fullName: idRecord.fullName,
          city:     idRecord.city,
        },
      });

    } catch (err) {
      console.error("💥 Erreur /verify :", err);
      return res.status(500).json({ success: false, message: "Erreur interne" });
    }
  }
);

// ============================================================
//  GET /api/phantom/status?wallet=0x...
// ============================================================
router.get("/status", async (req, res) => {
  const { wallet } = req.query;

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ success: false, message: "Adresse wallet invalide" });
  }

  try {
    const onChainStatus = await getVoterStatusOnChain(wallet.toLowerCase());
    const dbRecord = await Voter.findOne({ walletAddress: wallet.toLowerCase() });

    return res.json({
      success: true,
      wallet: wallet.toLowerCase(),
      isRegistered:  onChainStatus.isRegistered,
      hasVoted:      onChainStatus.hasVoted,
      voteTimestamp: onChainStatus.timestamp,
      riskScore:     dbRecord ? dbRecord.riskScore : 0,
      txHash:        dbRecord ? dbRecord.txHash : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur lors de la vérification" });
  }
});

// ============================================================
//  GET /api/phantom/me  — Route protégée par JWT (BUG 1 FIX)
//  Retourne le profil de l'électeur connecté depuis son token
// ============================================================
router.get("/me", verifyJWT, async (req, res) => {
  try {
    const { walletAddress } = req.voter;
    const dbRecord = await Voter.findOne({ walletAddress }).lean();
    const onChainStatus = await getVoterStatusOnChain(walletAddress);

    return res.json({
      success: true,
      wallet: walletAddress,
      isRegistered: onChainStatus.isRegistered,
      hasVoted:     onChainStatus.hasVoted,
      txHash:       dbRecord?.txHash || null,
      riskScore:    dbRecord?.riskScore || 0,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur profil" });
  }
});

// ── Helper ────────────────────────────────────────────────────
function hashCIN(cin) {
  return crypto.createHash("sha256").update(cin.toUpperCase()).digest("hex");
}

// Exporter le middleware pour utilisation dans d'autres routes
module.exports = router;
module.exports.verifyJWT = verifyJWT;
