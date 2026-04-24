const { getWriteContract, getReadContract } = require('../services/contractService');
const Voter       = require('../models/Voter');
const FakeID      = require('../models/FakeID');
const Blacklist   = require('../models/Blacklist');
const ActivityLog = require('../models/ActivityLog');
const { calculateRiskScore }              = require('../utils/riskScorer');
const { hashCIN }                         = require('../utils/hashId');
const { createNonce }                     = require('../utils/nonceStore');
const { sendMilitaryAlert, sendRegistrationConfirmation } = require('../services/emailService');

// ── Professions bloquées Article 47 ──────────────────────────
const BLOCKED_PROFESSIONS = [
  'Militaire', 'Forces Armées Royales',
  'Gendarmerie', 'Police Nationale', 'Protection Civile',
];

// ── Closed status in v3 contract (Upcoming=0, Open=1, Revealing=2, Closed=3)
const STATUS_CLOSED = 3;

// ============================================================
//  GET /api/voters/nonce/:wallet
//  Returns a one-time nonce the frontend must sign with MetaMask.
// ============================================================
exports.getNonce = async (req, res) => {
  const wallet = req.params.wallet;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
    return res.status(400).json({ success: false, message: 'Invalid wallet address.' });
  }
  try {
    const { nonce, message } = await createNonce(wallet);
    res.json({ success: true, nonce, message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
//  POST /api/voters/register
//  signature + nonce verified by verifySignature middleware before this runs.
// ============================================================
exports.register = async (req, res) => {
  const { electionId, cin, walletAddress } = req.body;
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  const idHash  = hashCIN(cin);
  const walletL = walletAddress.toLowerCase();

  try {
    const contract = getReadContract();

    // ── 0. CIN exists in Phantom ID ─────────────────────────
    const idRecord = await FakeID.findOne({ cin: cin.toUpperCase() });
    if (!idRecord) {
      return res.status(404).json({
        success: false,
        message: 'CIN introuvable dans la base nationale.',
      });
    }
    if (!idRecord.isValid) {
      return res.status(403).json({ success: false, message: 'Ce CIN est expiré ou révoqué.' });
    }

    // ── Article 47 : Blocage militaire ───────────────────────
    if (idRecord.profession && BLOCKED_PROFESSIONS.includes(idRecord.profession)) {
      await Blacklist.create({
        wallet: walletL, cinHash: idHash,
        profession: idRecord.profession, city: idRecord.city,
        ipAddress: ip,
        reason: 'Forces de sécurité — Article 47',
      });
      sendMilitaryAlert(walletL, idHash, idRecord.profession, idRecord.city)
        .catch(e => console.error('❌ Email alerte militaire:', e.message));
      await ActivityLog.create({
        type: 'BLACKLIST', walletAddress: walletL, electionId, ip,
        detail: `Article 47 — ${idRecord.profession} — ${idRecord.city}`, severity: 'critical',
      });
      console.log(`🚨 Militaire bloqué — ${idRecord.profession}`);
      return res.status(403).json({
        success: false, blocked: true,
        profession: idRecord.profession,
        message: "Les membres des forces de sécurité ne sont pas autorisés à voter (Article 47).",
      });
    }

    // ── Éligibilité géographique ─────────────────────────────
    const ElectionMeta = require('../models/ElectionMeta');
    const meta = await ElectionMeta.findOne({ electionId: Number(electionId) });
    if (meta) {
      const hasRegion   = meta.allowedRegions.length > 0;
      const hasCity     = meta.allowedCities.length > 0;
      const hasDistrict = meta.allowedDistricts.length > 0;
      if (hasRegion || hasCity || hasDistrict) {
        const regionOk   = !hasRegion   || meta.allowedRegions.includes(idRecord.region || '');
        const cityOk     = !hasCity     || meta.allowedCities.includes(idRecord.city || '');
        const districtOk = !hasDistrict || meta.allowedDistricts.includes(idRecord.district || '');
        if (!regionOk || !cityOk || !districtOk) {
          await ActivityLog.create({
            type: 'REGISTRATION', walletAddress: walletL, electionId, ip,
            detail: `Geo ineligible: ${idRecord.district}, ${idRecord.city} (${idRecord.region})`,
            severity: 'warning',
          });
          return res.status(403).json({
            success: false,
            geoBlocked: true,
            message: `Vous n'êtes pas éligible pour cette élection. Zone requise : ${[...meta.allowedCities, ...meta.allowedRegions].filter(Boolean).join(', ')}.`,
            voterLocation: {
              city:     idRecord.city,
              district: idRecord.district,
              region:   idRecord.region,
            },
          });
        }
      }
    }

    // ── Wallet pré-assigné ───────────────────────────────────
    if (idRecord.walletAddress && idRecord.walletAddress.toLowerCase() !== walletL) {
      return res.status(403).json({
        success: false,
        message: `Ce CIN est assigné au wallet ${idRecord.walletAddress}.`,
        assignedWallet: idRecord.walletAddress,
      });
    }

    // ── 1. Already registered on-chain? ─────────────────────
    const alreadyOnChain = await contract.isIdRegisteredInElection(electionId, idHash);
    if (alreadyOnChain) {
      return res.json({
        success: true, alreadyRegistered: true,
        message: 'already registered',
        voterProfile: { fullName: idRecord.fullName, city: idRecord.city },
      });
    }

    // ── 2. Election must be Open (status === 1) ──────────────
    let election;
    try { election = await contract.getElection(electionId); }
    catch { return res.status(404).json({ success: false, message: 'Election not found.' }); }
    if (Number(election.status) !== 1) {
      return res.status(400).json({ success: false, message: 'Élection fermée ou non ouverte.' });
    }

    // ── 3. MongoDB voter check / create ─────────────────────
    let voter = await Voter.findOne({ walletAddress: walletL });
    if (!voter) {
      voter = new Voter({ walletAddress: walletL, idHash, ipAddresses: [ip], attemptCount: 1 });
    } else {
      if (voter.idHash !== idHash) {
        voter.riskScore = Math.min(100, (voter.riskScore || 0) + 40);
        await voter.save();
        await ActivityLog.create({
          type: 'ID_MISMATCH', walletAddress: walletL, electionId, ip,
          detail: 'Wallet reused with different CIN', severity: 'critical',
        });
        return res.status(403).json({ success: false, message: 'Identity mismatch detected.' });
      }
      if (voter.registeredElections.includes(Number(electionId))) {
        return res.json({
          success: true, alreadyRegistered: true, message: 'already registered',
          voterProfile: { fullName: idRecord.fullName, city: idRecord.city },
        });
      }
      if (!voter.ipAddresses.includes(ip)) voter.ipAddresses.push(ip);
      voter.attemptCount += 1;
    }

    // ── 4. Risk check ────────────────────────────────────────
    voter.riskScore = calculateRiskScore(voter);
    if (voter.riskScore >= 80 || voter.isBlacklisted) {
      await voter.save();
      await ActivityLog.create({
        type: 'SUSPICIOUS', walletAddress: walletL, electionId, ip,
        detail: `Risk score: ${voter.riskScore}`, severity: 'critical',
      });
      return res.status(403).json({ success: false, message: 'Account flagged. Contact election authorities.' });
    }

    // ── 5. On-chain registration ─────────────────────────────
    const writeContract = getWriteContract();
    const tx = await writeContract.registerVoter(electionId, walletAddress, idHash);
    await tx.wait(1);

    // ── 6. Persist MongoDB ───────────────────────────────────
    voter.registeredElections.push(Number(electionId));
    voter.txHash            = tx.hash;
    voter.registeredOnChain = true;
    await voter.save();

    idRecord.usedForVoting = true;
    await idRecord.save();

    await ActivityLog.create({
      type: 'REGISTRATION', walletAddress: walletL, electionId,
      ip, txHash: tx.hash, severity: 'info',
    });

    // ── 7. Email confirmation ────────────────────────────────
    if (idRecord.email) {
      sendRegistrationConfirmation(idRecord.email, idRecord.fullName, idRecord.city, tx.hash)
        .catch(e => console.error('❌ Email confirmation:', e.message));
      console.log(`📧 Confirmation → ${idRecord.email}`);
    }

    console.log(`✅ Inscrit — ${walletL} | Élection ${electionId} | TX: ${tx.hash}`);

    return res.json({
      success: true,
      message: 'Successfully registered.',
      txHash:  tx.hash,
      voterProfile: {
        fullName: idRecord.fullName,
        city:     idRecord.city,
        district: idRecord.district,
        region:   idRecord.region,
      },
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/voters/status?electionId=1&wallet=0x...
exports.getStatus = async (req, res) => {
  const { electionId, wallet } = req.query;
  if (!electionId || !wallet) {
    return res.status(400).json({ success: false, message: 'electionId and wallet required' });
  }
  try {
    const contract = getReadContract();
    const status   = await contract.getVoterStatus(Number(electionId), wallet);
    // v3: also return commit-reveal state
    let commitRevealState = null;
    try {
      const [committed, revealed, commitment] = await contract.getCommitRevealStatus(Number(electionId), wallet);
      commitRevealState = { committed, revealed, commitment };
    } catch {}

    res.json({
      success:          true,
      isRegistered:     status.isRegistered,
      hasVoted:         status.hasVoted,
      hasDelegated:     status.hasDelegated,
      delegatedTo:      status.delegatedTo,
      voteTimestamp:    Number(status.voteTimestamp),
      commitRevealState,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/voters/elections/:wallet
exports.getVoterElections = async (req, res) => {
  try {
    const contract = getReadContract();
    const eids = await contract.getVoterElections(req.params.wallet);
    res.json({ success: true, electionIds: eids.map(Number) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/voters/verify/:wallet
exports.verify = async (req, res) => {
  try {
    const wallet   = req.params.wallet.toLowerCase();
    const contract = getReadContract();
    const eids     = await contract.getVoterElections(wallet);
    const rows     = [];

    for (const eid of eids) {
      const id = Number(eid);
      const [election, status] = await Promise.all([
        contract.getElection(id),
        contract.getVoterStatus(id, wallet),
      ]);
      rows.push({
        electionId:    id,
        electionName:  election.name,
        isRegistered:  status.isRegistered,
        hasVoted:      status.hasVoted,
        hasDelegated:  status.hasDelegated,
        delegatedTo:   status.delegatedTo,
        voteTimestamp: Number(status.voteTimestamp),
      });
    }

    const mongoVoter = await Voter.findOne({ walletAddress: wallet })
      .select('idHash ipAddresses attemptCount riskScore isBlacklisted txHash')
      .lean();

    res.json({ success: true, wallet, elections: rows, mongoProfile: mongoVoter || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
