const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/accounts.controller');

const router = Router();
router.use(auth);

router.get('/', ctrl.getAccounts);
router.get('/:id', ctrl.getAccountById);
router.post('/', ctrl.createAccount);
router.put('/:id', ctrl.updateAccount);
router.delete('/:id', ctrl.deleteAccount);

module.exports = router;