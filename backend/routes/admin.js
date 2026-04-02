// ============================================================
//  routes/admin.js  – API Admin (owner only)
//  Auto-close : le vote se ferme automatiquement à la deadline
//  Vote blanc : toujours activé (droit constitutionnel)
// ============================================================
const express = require("express");
const { ethers } = require("ethers");
const ElectionHistory  = require("../models/ElectionHistory");
const ElectionSettings = require("../models/ElectionSettings");
const Voter            = require("../models/Voter");
const { sendResultsEmail } = require("../services/emailService");

const router = express.Router();

const CONTRACT_ABI = [
  "function addCandidate(string memory _name) external",
  "function openVotingWithBlank(uint256 _deadline, string memory _category) external",
  "function closeVoting() external",
  "function getResults() external view returns (uint256[] memory, string[] memory, uint256[] memory)",
  "function getBlankVotes() external view returns (uint256)",
  "function blankVoteEnabled() external view returns (bool)",
  "function votingOpen() external view returns (bool)",
  "function totalVotes() external view returns (uint256)",
  "function totalRegistered() external view returns (uint256)",
  "function getElectionInfo() external view returns (string, string, bool, uint256, uint256, uint256, bool)",
  "function getTimeRemaining() external view returns (uint256)",
  "function votingDeadline() external view returns (uint256)",
  "function owner() external view returns (address)",
];

function getOwnerContract() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer   = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

// ── Logique de fermeture automatique (partagée) ─────────────
let autoCloseRunning = false;

async function performClose() {
  if (autoCloseRunning) return;
  autoCloseRunning = true;
  try {
    const contract = getOwnerContract();
    const [ids, names, counts] = await contract.getResults();
    const info = await contract.getElectionInfo();
    const [name, category, , , totalRegistered, totalVotes] = info;
    const blankVotes = await contract.getBlankVotes();

    const tx = await contract.closeVoting();
    await tx.wait(1);

    const totalV  = Number(totalVotes);
    const totalR  = Number(totalRegistered);
    const blankN  = Number(blankVotes);
    const rows    = ids.map((id, i) => ({ id: Number(id), name: names[i], voteCount: Number(counts[i]) }));
    const results = rows.map(r => ({
      ...r,
      percentage: totalV > 0 ? Number(((r.voteCount / totalV) * 100).toFixed(2)) : 0,
    }));

    await ElectionHistory.create({
      electionName:      name,
      electionCategory:  category,
      endedAt:           new Date(),
      totalRegistered:   totalR,
      totalVotes:        totalV,
      blankVotes:        blankN,
      turnoutPercentage: totalR > 0 ? Number(((totalV / totalR) * 100).toFixed(2)) : 0,
      results,
    });

    // Emails résultats
    try {
      const voterDocs = await Voter.find({ registeredOnChain: true }).lean();
      sendResultsEmail(voterDocs, results).catch(e => console.error("❌ Email résultats:", e.message));
    } catch(e) {}

    console.log(`🔴 [AUTO-CLOSE] Vote fermé automatiquement à ${new Date().toISOString()} | TX: ${tx.hash}`);
  } catch (err) {
    // Si déjà fermé ou erreur blockchain, on ignore silencieusement
    if (!err.message?.includes('not open')) {
      console.error("❌ Auto-close error:", err.message);
    }
  } finally {
    autoCloseRunning = false;
  }
}

// ── Auto-close : vérifie toutes les 10 secondes ─────────────
// Sur Hardhat local, block.timestamp n'avance qu'avec les transactions.
// On compare donc l'heure réelle (Date.now) avec la deadline du contrat,
// et on avance le temps Hardhat si nécessaire avant d'appeler closeVoting().
setInterval(async () => {
  try {
    const contract  = getOwnerContract();
    const isOpen    = await contract.votingOpen();
    if (!isOpen) return;

    const deadline  = Number(await contract.votingDeadline());
    if (deadline === 0) return; // aucune deadline configurée

    const nowWall   = Math.floor(Date.now() / 1000);
    if (nowWall < deadline) return; // deadline pas encore atteinte

    // Deadline réelle dépassée → avancer le temps Hardhat si block.timestamp est en retard
    const remaining = Number(await contract.getTimeRemaining());
    if (remaining > 0) {
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      await provider.send('evm_increaseTime', [remaining + 2]);
      await provider.send('evm_mine', []);
    }

    console.log("⏰ Deadline atteinte — fermeture automatique du vote...");
    await performClose();
  } catch (e) {
    if (e.message && !e.message.includes('not open')) {
      console.error("❌ Auto-close check error:", e.message);
    }
  }
}, 10000);

// ── POST /api/admin/candidate  → Ajouter candidat ───────────
router.post("/candidate", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Nom du candidat requis" });
  }
  try {
    const contract = getOwnerContract();

    // Vérifier unicité
    const [, names] = await contract.getResults();
    const exists = names.some(n => n.toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: `Un candidat "${name}" existe déjà` });
    }

    const tx = await contract.addCandidate(name.trim());
    await tx.wait(1);
    return res.json({ success: true, message: `Candidat "${name}" ajouté`, txHash: tx.hash });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.reason || err.message });
  }
});

// ── POST /api/admin/open  → Ouvrir le vote ──────────────────
// Vote blanc TOUJOURS activé — droit constitutionnel
router.post("/open", async (req, res) => {
  try {
    const { deadline = 0, category = "" } = req.body || {};

    if (!Number(deadline) || Number(deadline) <= Math.floor(Date.now() / 1000)) {
      return res.status(400).json({
        success: false,
        message: "Vous devez définir une date/heure de clôture valide dans le futur.",
      });
    }

    const contract = getOwnerContract();
    // Toujours openVotingWithBlank — le vote blanc est un droit, pas une option
    const tx = await contract.openVotingWithBlank(Number(deadline), String(category));
    await tx.wait(1);

    const closeAt = new Date(Number(deadline) * 1000).toLocaleString('fr-FR');
    console.log(`🟢 Vote ouvert (vote blanc activé) | Clôture: ${closeAt} | TX: ${tx.hash}`);
    return res.json({
      success: true,
      message: `Vote ouvert avec vote blanc. Clôture automatique le ${closeAt}`,
      txHash: tx.hash,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.reason || err.message });
  }
});

// ── GET /api/admin/stats  → Stats + candidats ───────────────
router.get("/stats", async (req, res) => {
  try {
    const contract = getOwnerContract();
    const [ids, names, counts] = await contract.getResults();
    const [votingOpen, totalVotes, totalRegistered, electionInfo, timeRemaining, blankVotes] =
      await Promise.all([
        contract.votingOpen(),
        contract.totalVotes(),
        contract.totalRegistered(),
        contract.getElectionInfo(),
        contract.getTimeRemaining(),
        contract.getBlankVotes(),
      ]);
    const [electionName, electionCategory, , votingDeadline] = electionInfo;

    return res.json({
      success: true,
      votingOpen,
      totalVotes:      Number(totalVotes),
      totalRegistered: Number(totalRegistered),
      blankVotes:      Number(blankVotes),
      electionName,
      electionCategory,
      votingDeadline:  Number(votingDeadline),
      timeRemaining:   Number(timeRemaining),
      candidates: ids.map((id, i) => ({
        id:        Number(id),
        name:      names[i],
        voteCount: Number(counts[i]),
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/elections  → Historique ──────────────────
router.get("/elections", async (req, res) => {
  const rows = await ElectionHistory.find().sort({ createdAt: -1 }).lean();
  return res.json({ success: true, elections: rows });
});

// ── GET /api/admin/settings  → Paramètres visibilité ────────
router.get("/settings", async (req, res) => {
  try {
    let settings = await ElectionSettings.findOne().lean();
    if (!settings) settings = { resultsVisibility: "after_close" };
    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/settings  → Mettre à jour ───────────────
router.post("/settings", async (req, res) => {
  const { resultsVisibility } = req.body;
  const allowed = ["public", "after_close", "registered_only"];
  if (!allowed.includes(resultsVisibility)) {
    return res.status(400).json({ success: false, message: `Valeur invalide. Choisir : ${allowed.join(", ")}` });
  }
  try {
    const settings = await ElectionSettings.findOneAndUpdate(
      {},
      { resultsVisibility, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return res.json({ success: true, message: "Paramètres mis à jour", settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
