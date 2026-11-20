module.exports = (req, res, next) => {
  req.userId = process.env.DEV_USER_ID;
  next();
};
