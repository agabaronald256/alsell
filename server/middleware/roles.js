const db = require('../db');

// Attach full user with role to request
const attachUser = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const result = await db.query(
      'SELECT id, email, username, role, is_verified, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'User not found' });
    req.fullUser = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Require specific role
const requireRole = (...roles) => async (req, res, next) => {
  await attachUser(req, res, () => {
    if (!roles.includes(req.fullUser.role)) {
      return res.status(403).json({
        error: 'Access denied',
        required: roles,
        current: req.fullUser.role,
      });
    }
    next();
  });
};

const isSuperAdmin = requireRole('superadmin');
const isModerator = requireRole('superadmin', 'moderator');
const isStaff = requireRole('superadmin', 'moderator', 'staff');

module.exports = { attachUser, requireRole, isSuperAdmin, isModerator, isStaff };