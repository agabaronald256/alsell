const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { isModerator, isSuperAdmin } = require('../middleware/roles');

// Get all users with pagination and filters
router.get('/', auth, isModerator, async (req, res) => {
  const { page = 1, limit = 20, search, role, verified, sort = 'newest' } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = `
      SELECT
        u.id, u.email, u.username, u.role, u.is_verified,
        u.rating_avg, u.rating_count, u.created_at, u.phone,
        COUNT(DISTINCT l.id) as listing_count,
        COUNT(DISTINCT o.id) as offer_count,
        COUNT(DISTINCT r.id) as review_count
      FROM users u
      LEFT JOIN listings l ON u.id = l.user_id
      LEFT JOIN offers o ON u.id = o.buyer_id
      LEFT JOIN reviews r ON u.id = r.reviewer_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }
    if (role) {
      params.push(role);
      query += ` AND u.role=$${params.length}`;
    }
    if (verified !== undefined) {
      params.push(verified === 'true');
      query += ` AND u.is_verified=$${params.length}`;
    }

    query += ` GROUP BY u.id`;

    if (sort === 'newest') query += ' ORDER BY u.created_at DESC';
    else if (sort === 'oldest') query += ' ORDER BY u.created_at ASC';
    else if (sort === 'most_listings') query += ' ORDER BY listing_count DESC';
    else if (sort === 'highest_rated') query += ' ORDER BY u.rating_avg DESC';

    const countResult = await db.query(
      `SELECT COUNT(DISTINCT u.id) FROM users u WHERE 1=1 ${search ? `AND (u.email ILIKE '%${search}%' OR u.username ILIKE '%${search}%')` : ''}${role ? ` AND u.role='${role}'` : ''}`
    );

    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);
    res.json({
      users: result.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      pages: Math.ceil(Number(countResult.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user full profile
router.get('/:id', auth, isModerator, async (req, res) => {
  try {
    const [user, listings, offers, reviews, reports] = await Promise.all([
      db.query('SELECT * FROM users WHERE id=$1', [req.params.id]),
      db.query('SELECT * FROM listings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
      db.query('SELECT * FROM offers WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
      db.query('SELECT * FROM reviews WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
      db.query('SELECT * FROM reports WHERE reported_user_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
    ]);
    if (!user.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.rows[0], listings: listings.rows, offers: offers.rows, reviews: reviews.rows, reports: reports.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role
router.patch('/:id/role', auth, isSuperAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['user', 'moderator', 'staff', 'superadmin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
  try {
    const result = await db.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, username, role',
      [role, req.params.id]
    );
    await db.query(
      `INSERT INTO admin_log (admin_id, action, target_user_id, details)
       VALUES ($1, 'role_change', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ new_role: role })]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ban user
router.patch('/:id/ban', auth, isModerator, async (req, res) => {
  const { reason, duration_days } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot ban yourself' });
  try {
    const banned_until = duration_days
      ? new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000)
      : null;
    await db.query(
      'UPDATE users SET role=$1, banned_until=$2, ban_reason=$3 WHERE id=$4',
      ['banned', banned_until, reason, req.params.id]
    );
    await db.query(
      'UPDATE listings SET status=$1 WHERE user_id=$2 AND status=$3',
      ['paused', req.params.id, 'active']
    );
    await db.query(
      `INSERT INTO admin_log (admin_id, action, target_user_id, details)
       VALUES ($1, 'ban', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ reason, duration_days })]
    );
    res.json({ message: 'User banned', banned_until });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unban user
router.patch('/:id/unban', auth, isModerator, async (req, res) => {
  try {
    await db.query(
      "UPDATE users SET role='user', banned_until=NULL, ban_reason=NULL WHERE id=$1",
      [req.params.id]
    );
    await db.query(
      `INSERT INTO admin_log (admin_id, action, target_user_id, details)
       VALUES ($1, 'unban', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({})]
    );
    res.json({ message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify user
router.patch('/:id/verify', auth, isModerator, async (req, res) => {
  try {
    await db.query('UPDATE users SET is_verified=true WHERE id=$1', [req.params.id]);
    await db.query(
      `INSERT INTO admin_log (admin_id, action, target_user_id, details)
       VALUES ($1, 'verify', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({})]
    );
    res.json({ message: 'User verified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;