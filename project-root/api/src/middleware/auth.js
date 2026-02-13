// JWT verification middleware
// Per BLL.md 1D: Applied to ALL protected routes
const jwt = require('jsonwebtoken');
const env = require('../config/env');

module.exports = function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized - No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { user_account_id, email, role_id, role_name, permissions }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized - Invalid or expired token' });
  }
};
