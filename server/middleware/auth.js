const jwt = require('jsonwebtoken');
const db = require('../db');
const crypto = require('crypto');

const generateFingerprint = (req) => {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection?.remoteAddress || '';
  const lang = req.headers['accept-language'] || '';
  return crypto.createHash('sha256').update(`${ua}${lang}`).digest('hex').slice(0, 64);
};

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    req.fingerprint = generateFingerprint(req);
    req.clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
