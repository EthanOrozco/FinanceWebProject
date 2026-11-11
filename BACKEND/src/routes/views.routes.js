const { Router } = require('express');
const path = require('path');
const router = Router();

router.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../FRONTEND/src/views/index.html'));
});

router.get('/login', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../FRONTEND/src/views/login.html'));
});

router.get('/dashboard', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../FRONTEND/src/views/dashboard.html'));
});

router.get('/transacciones', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../FRONTEND/src/views/transacciones.html'));
});

router.get('/metas', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../FRONTEND/src/views/metas.html'));
})

router.get('/perfil', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../FRONTEND/src/views/perfil.html'));
})

module.exports = router;