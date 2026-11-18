const { Router } = require('express');
const path = require('path');
const router = Router();

const VIEWS_DIR = path.resolve(__dirname, '../../../FRONTEND/src/views');

const pages = {
  '/':              'landing.html',
  '/login':         'login.html',
  '/dashboard':     'dashboard.html',
  '/cuentas':       'cuentas.html',
  '/transacciones': 'transacciones.html',
  '/categorias':    'categorias.html',
  '/metas':         'metas.html',
  '/perfil':        'perfil.html',
};

for (const [url, file] of Object.entries(pages)) {
  router.get(url, (req, res) => res.sendFile(path.join(VIEWS_DIR, file)))
}
module.exports = router;
