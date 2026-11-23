const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/goals.controller');

const router = Router();
router.use(auth);

router.get('/', ctrl.getGoals);
router.get('/:id', ctrl.getGoalById);
router.post('/', ctrl.createGoal);
router.put('/:id', ctrl.updateGoal);
router.delete('/:id', ctrl.deleteGoal);

router.post('/:id/contributions', ctrl.addContribution);
router.delete('/:id/contributions/:contributionId', ctrl.deleteContribution);

module.exports = router;