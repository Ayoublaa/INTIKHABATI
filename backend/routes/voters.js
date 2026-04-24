const router          = require('express').Router();
const ctrl            = require('../controllers/voterController');
const { validate }    = require('../middleware/validate');
const verifySig       = require('../middleware/verifySignature');
const { registerLimiter, publicLimiter } = require('../middleware/rateLimiter');

// GET /api/voters/nonce/:wallet — get a one-time nonce to sign
router.get('/nonce/:wallet',       publicLimiter,   ctrl.getNonce);

// POST /api/voters/register — register voter (signature + nonce required)
router.post('/register',
  registerLimiter,
  validate('register'),   // validates body shape + signature fields
  verifySig,              // verifies EIP-191 signature against wallet
  ctrl.register
);

router.get('/status',             publicLimiter,   ctrl.getStatus);
router.get('/elections/:wallet',  publicLimiter,   ctrl.getVoterElections);
router.get('/verify/:wallet',     publicLimiter,   ctrl.verify);

module.exports = router;
