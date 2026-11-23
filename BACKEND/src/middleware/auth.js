module.exports = (req, res, next) => {
  const userId = req.headers['x-user-id'] || process.env.DEV_USER_ID;
  if (!userId || userId === 'ObjID') {
    return res.status(401).json({ message: 'No autorizado. Inicia sesión primero.' });
  }
  req.userId = userId;
  next();
};