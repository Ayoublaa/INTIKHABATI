const router = require('express').Router();
const ctrl   = require('../controllers/electionController');
const secCtrl = require('../controllers/securityController');
const { requireOwner }  = require('../middleware/auth');
const { validate }      = require('../middleware/validate');
const { adminLimiter }  = require('../middleware/rateLimiter');
const ElectionSettings  = require('../models/ElectionSettings');

router.use(requireOwner);
router.use(adminLimiter);

// Dashboard
router.get('/dashboard', ctrl.getDashboard);

// Election management
router.post('/elections',                validate('createElection'), ctrl.createElection);
router.post('/elections/:id/candidate',  validate('addCandidate'),   ctrl.addCandidate);
router.post('/elections/:id/open',       ctrl.openElection);
router.post('/elections/:id/reveal',     ctrl.startRevealPhase);  // v3: commit-reveal phase
// NOTE: the close endpoint is intentionally removed.
// Elections now close automatically via services/autoCloseService.js,
// which calls ctrl.closeElection (or getWriteContract().closeElection)
// directly in-process when the deadline passes. There is no HTTP path
// for admins to trigger a close manually anymore.
router.post('/elections/:id/geo',        ctrl.setElectionGeo);    // geo restrictions

// Settings
router.get('/settings', async (req, res) => {
  try {
    let s = await ElectionSettings.findOne();
    if (!s) s = await ElectionSettings.create({});
    res.json({ success: true, settings: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings', async (req, res) => {
  const { resultsVisibility } = req.body;
  const allowed = ['public', 'after_close', 'registered_only'];
  if (!allowed.includes(resultsVisibility)) {
    return res.status(400).json({ success: false, message: 'Invalid visibility value' });
  }
  try {
    const s = await ElectionSettings.findOneAndUpdate(
      {}, { resultsVisibility }, { upsert: true, new: true }
    );
    res.json({ success: true, settings: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Security
router.get('/security/alerts',       secCtrl.getAlerts);
router.get('/security/voters/risk',  secCtrl.getRiskVoters);
router.post('/security/blacklist',   secCtrl.blacklist);
router.get('/security/logs',         secCtrl.getLogs);
router.get('/security/metrics',      secCtrl.getMetrics);

// Reset risk score for a wallet
router.post('/reset-risk/:wallet', async (req, res) => {
  const Voter = require('../models/Voter');
  const { wallet } = req.params;
  if (!/^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
    return res.status(400).json({ success: false, message: 'Invalid wallet address' });
  }
  try {
    await Voter.updateOne({ walletAddress: wallet.toLowerCase() }, { riskScore: 0 });
    res.json({ success: true, wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
