const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/users.controller');

const router = Router();

router.post('/register', ctrl.registerUser);
router.post('/login', ctrl.loginUser);
router.post('/logout', ctrl.logoutUser);

router.get('/me', auth, ctrl.getMe);
router.put('/me', auth, ctrl.updateMe);
router.delete('/me', auth, ctrl.deleteMe);

module.exports = router;
