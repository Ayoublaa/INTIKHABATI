// ============================================================
//  routes/security.js — Détection de fraude IA + Blacklist
//  FEATURE 2 : Endpoint blacklist pour la page /security
// ============================================================
const express  = require("express");
const crypto   = require("crypto");
const { ethers } = require("ethers");
const Voter    = require("../models/Voter");
const FakeID   = require("../models/FakeID");
const Blacklist = require("../models/Blacklist");
const { getVotesPerHour } = require("../services/blockchain");

const router = express.Router();

function hashCIN(cin) {
  return crypto.createHash("sha256").update(String(cin).toUpperCase()).digest("hex");
}

function hashToBytes32(hexHash) {
  return ethers.hexlify(ethers.toUtf8Bytes(hexHash)).padEnd(66, "0").slice(0, 66);
}

// ── GET /api/security/metrics ────────────────────────────────
router.get("/metrics", async (_req, res) => {
  try {
    const voters = await Voter.find({ registeredOnChain: true }).lean();
    const ids    = await FakeID.find().select({ cin: 1, city: 1 }).lean();

    const cityByHexHash = new Map(ids.map(x => [hashCIN(x.cin), x.city]));
    const cityByBytes32 = new Map(ids.map(x => {
      const hex     = hashCIN(x.cin);
      const bytes32 = hashToBytes32(hex);
      return [bytes32.toLowerCase(), x.city];
    }));

    const cityByWallet = new Map();
    for (const voter of voters) {
      const idHash = voter.idHash;
      const city = cityByHexHash.get(idHash)
               || cityByBytes32.get(idHash?.toLowerCase())
               || "Inconnue";
      cityByWallet.set(voter.walletAddress.toLowerCase(), city);
    }

    const votesPerHour = await getVotesPerHour(0);
    const maxHourly    = votesPerHour.reduce((m, v) => Math.max(m, v.votes), 0);
    const suspiciousHours = votesPerHour.filter(v =>
      maxHourly > 0 && v.votes >= Math.max(5, Math.ceil(maxHourly * 0.8))
    );

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const CONTRACT_ABI = [
      "event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp)",
    ];
    const contract  = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const voteLogs  = await contract.queryFilter(
      contract.filters.VoteCast(), 0, currentBlock
    ).catch(() => []);

    const votesByCity = {};
    const nowTs = Math.floor(Date.now() / 1000);
    const last10Min = 10 * 60;
    const votesByCityRecent = {};

    for (const log of voteLogs) {
      const voterAddr = log.args.voter.toLowerCase();
      const city      = cityByWallet.get(voterAddr) || "Inconnue";
      votesByCity[city] = (votesByCity[city] || 0) + 1;
      try {
        const block = await provider.getBlock(log.blockNumber);
        if (block && Number(block.timestamp) >= (nowTs - last10Min)) {
          votesByCityRecent[city] = (votesByCityRecent[city] || 0) + 1;
        }
      } catch (e) {}
    }

    const anomalyCount   = suspiciousHours.length;
    const unknownVotes   = votesByCity["Inconnue"] || 0;
    const totalVotes     = Object.values(votesByCity).reduce((s, v) => s + v, 0);
    const unknownRatio   = totalVotes > 0 ? unknownVotes / totalVotes : 0;
    const unknownPenalty = unknownRatio > 0.5 ? 5 : unknownRatio > 0.2 ? 2 : 0;
    const confidenceScore = Number(
      Math.max(70, 99.9 - anomalyCount * 1.2 - unknownPenalty).toFixed(1)
    );

    const alerts = [
      ...suspiciousHours.map(h => ({
        level:   "warning",
        message: `Activité élevée détectée à ${new Date(h.hour * 1000).toLocaleTimeString("fr-FR")}`,
        votes:   h.votes,
      })),
    ];

    if (unknownVotes > 0 && unknownRatio > 0.3) {
      alerts.push({
        level:   "info",
        message: `${unknownVotes} vote(s) avec localisation non identifiée`,
        votes:   unknownVotes,
      });
    }

    return res.json({
      success: true,
      confidenceScore,
      suspiciousHours,
      votesPerHour,
      cityDistribution: Object.entries(votesByCity)
        .filter(([city]) => city !== "Inconnue")
        .map(([city, votes]) => ({ city, votes })),
      cityDistributionAll: Object.entries(votesByCity)
        .map(([city, votes]) => ({ city, votes })),
      alerts,
      debug: {
        totalVoters:  voters.length,
        totalVotes,
        unknownVotes,
        citiesFound:  Object.keys(votesByCity).filter(c => c !== "Inconnue"),
      },
    });

  } catch (err) {
    console.error("Security metrics error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/security/blacklist  → Liste noire militaire ─────
router.get("/blacklist", async (_req, res) => {
  try {
    const entries = await Blacklist.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      count:   entries.length,
      entries: entries.map(e => ({
        wallet:     e.wallet,
        cinHash:    e.cinHash.slice(0, 12) + "...",  // Masquer partiellement
        profession: e.profession,
        city:       e.city,
        timestamp:  e.timestamp,
        reason:     e.reason,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
