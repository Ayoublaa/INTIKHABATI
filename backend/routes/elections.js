const router = require('express').Router();
const ctrl   = require('../controllers/electionController');
const { publicLimiter } = require('../middleware/rateLimiter');

router.get('/',             publicLimiter, ctrl.getAll);
router.get('/history',      publicLimiter, ctrl.getHistory);
router.get('/:id',          publicLimiter, ctrl.getOne);
router.get('/:id/candidates', publicLimiter, ctrl.getCandidates);
router.get('/:id/results',  publicLimiter, ctrl.getResults);
router.get('/:id/stats',    publicLimiter, ctrl.getStats);

module.exports = router;
