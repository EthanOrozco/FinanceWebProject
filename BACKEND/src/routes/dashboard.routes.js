const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/dashboard.controller');

const router = Router();
router.use(auth);

router.get('/', ctrl.getDashboard);

module.exports = router;
