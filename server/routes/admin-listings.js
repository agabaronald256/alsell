const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { isModerator, isSuperAdmin } = require('../middleware/roles');

// Get all listings with full details
router.get('/', auth, isModerator, async (req, res) => {
  const { page = 1, limit = 20, search, category, status, sort = 'newest' } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = ['1=1'];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`l.title ILIKE $${params.length}`);
    }
    if (category) {
      params.push(category);
      where.push(`l.category=$${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`l.status=$${params.length}`);
    }

    const whereStr = where.join(' AND ');
    let orderBy = 'l.created_at DESC';
    if (sort === 'price-high') orderBy = 'l.price DESC';
    if (sort === 'price-low') orderBy = 'l.price ASC';
    if (sort === 'most-offers') orderBy = 'offer_count DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM listings l WHERE ${whereStr}`, params
    );

    params.push(limit, offset);
    const result = await db.query(`
      SELECT l.*, u.username as seller, u.email as seller_email, u.role as seller_role,
        COUNT(DISTINCT o.id) as offer_count,
        COUNT(DISTINCT r.id) as report_count
      FROM listings l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN offers o ON l.id = o.listing_id
      LEFT JOIN reports r ON l.id = r.listing_id
      WHERE ${whereStr}
      GROUP BY l.id, u.username, u.email, u.role
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      listings: result.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      pages: Math.ceil(Number(countResult.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove listing
router.patch('/:id/remove', auth, isModerator, async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required' });
  try {
    await db.query("UPDATE listings SET status='removed' WHERE id=$1", [req.params.id]);
    const listing = await db.query('SELECT user_id, title FROM listings WHERE id=$1', [req.params.id]);
    if (listing.rows.length) {
      await db.query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'listing_removed', $2)`,
        [listing.rows[0].user_id, `Your listing "${listing.rows[0].title}" was removed: ${reason}`]
      );
    }
    await db.query(
      `INSERT INTO admin_log (admin_id, action, details)
       VALUES ($1, 'remove_listing', $2)`,
      [req.user.id, JSON.stringify({ listing_id: req.params.id, reason })]
    );
    res.json({ message: 'Listing removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature listing (pin to top)
router.patch('/:id/feature', auth, isSuperAdmin, async (req, res) => {
  const { featured } = req.body;
  try {
    await db.query('UPDATE listings SET is_featured=$1 WHERE id=$2', [featured, req.params.id]);
    res.json({ message: featured ? 'Listing featured' : 'Listing unfeatured' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;