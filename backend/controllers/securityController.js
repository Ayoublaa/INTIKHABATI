const Voter       = require('../models/Voter');
const ActivityLog = require('../models/ActivityLog');

// GET /api/security/alerts
exports.getAlerts = async (req, res) => {
  try {
    const logs = await ActivityLog.find({
      severity: { $in: ['warning', 'critical'] },
    }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, alerts: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/security/voters/risk
exports.getRiskVoters = async (req, res) => {
  try {
    const voters = await Voter.find({ riskScore: { $gte: 30 } })
      .sort({ riskScore: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, voters });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/security/blacklist
exports.blacklist = async (req, res) => {
  const { walletAddress, reason } = req.body;
  if (!walletAddress) return res.status(400).json({ success: false, message: 'wallet required' });
  try {
    const voter = await Voter.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { isBlacklisted: true, riskScore: 100 },
      { new: true }
    );
    await ActivityLog.create({
      type: 'BLACKLIST', walletAddress: walletAddress.toLowerCase(),
      detail: reason || 'Manually blacklisted by admin', severity: 'critical',
    });
    res.json({ success: true, voter });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/security/logs
exports.getLogs = async (req, res) => {
  try {
    const { type, electionId, wallet } = req.query;
    const filter = {};
    if (type)       filter.type       = type;
    if (electionId) filter.electionId = Number(electionId);
    if (wallet)     filter.walletAddress = wallet.toLowerCase();

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/security/metrics
exports.getMetrics = async (req, res) => {
  try {
    const totalVoters     = await Voter.countDocuments();
    const blacklisted     = await Voter.countDocuments({ isBlacklisted: true });
    const highRisk        = await Voter.countDocuments({ riskScore: { $gte: 50 } });
    const recentAlerts    = await ActivityLog.countDocuments({
      severity: 'critical',
      createdAt: { $gte: new Date(Date.now() - 24 * 3600_000) },
    });
    res.json({ success: true, metrics: { totalVoters, blacklisted, highRisk, recentAlerts } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
