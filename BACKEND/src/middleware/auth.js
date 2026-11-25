const { readSession } = require('../utils/session');

module.exports = (req, res, next) => {
  const userId = readSession(req);
  if (!userId) {
    return res.status(401).json({ message: 'Tu sesión expiró. Inicia sesión de nuevo.' });
  }
  req.userId = userId;
  next();
};