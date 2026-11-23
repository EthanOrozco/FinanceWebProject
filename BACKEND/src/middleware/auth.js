const mongoose = require('mongoose');

// El frontend manda el _id del usuario logueado en el header x-user-id (ver authHeaders en api.js)
module.exports = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ message: 'No autorizado. Inicia sesión primero.' });
  }
  req.userId = userId;
  next();
};
