const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'vector_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const setSessionCookie = (res, userId) => {
  const token = jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET,
    {
      expiresIn: '7d',
      algorithm: 'HS256',
    });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: MAX_AGE_MS });
};

const clearSessionCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions);

//return userId or null if the token is missing, is invalid or it expired
const readSession = (req) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }).sub;
  } catch {
    return null;
  }
};

module.exports = { setSessionCookie, clearSessionCookie, readSession };