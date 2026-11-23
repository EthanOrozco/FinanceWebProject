const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/transactions.controller');

const router = Router();
router.use(auth);

router.get('/', ctrl.getTransactions);
router.get('/:id', ctrl.getTransactionById);
router.post('/', ctrl.createTransaction);
router.put('/:id', ctrl.updateTransaction);
router.delete('/:id', ctrl.deleteTransaction);

module.exports = router;
