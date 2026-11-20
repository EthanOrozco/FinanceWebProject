const { Router } = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/categories.controller');

const router = Router();
router.use(auth);

router.get('/', ctrl.getCategories);
router.get('/:id', ctrl.getCategoryById);
router.post('/', ctrl.createCategory);
router.put('/:id', ctrl.updateCategory);
router.delete('/:id', ctrl.deleteCategory);

module.exports = router;
