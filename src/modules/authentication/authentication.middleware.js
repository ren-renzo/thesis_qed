// const jwt = require('jsonwebtoken');

// module.exports = function verifyToken(req, res, next) {
//   const token = req.cookies?.token; // galing sa httpOnly cookie

//   if (!token) {
//     return res.status(401).json({ message: 'No token provided.' });
//   }

//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       return res.status(403).json({ message: 'Invalid or expired token.' });
//     }
//     req.user = decoded;
//     next();
//   });
// };

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'qed_default_fallback_secret_key_123';

exports.authenticate = (req, res, next) => {
  // 1. Kunin ang token mula sa cookie (default name: 'token')
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // I-attach ang user info sa request object
    req.user = {
      userId: decoded.userId || decoded.id,
      userName: decoded.userName,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Optional: role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
};