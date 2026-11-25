const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/users.controller');

const router = Router();

router.post('/register', ctrl.registerUser);
router.post('/login', ctrl.loginUser);
router.post('/logout', ctrl.logoutUser);

router.get('/:id', auth, ctrl.getUserById);
router.put('/:id', auth, ctrl.updateUser);
router.delete('/:id', auth, ctrl.deleteUser);

module.exports = router;