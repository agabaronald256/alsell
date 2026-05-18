const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get all listings
router.get('/', async (req, res) => {
  const { category, condition, sort, q, lat, lng, radius, page = 1, limit = 24 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = ['l.status=$1'];
    let params = ['active'];
    if (category && category !== 'all') {
      params.push(category);
      where.push(`l.category=$${params.length}`);
    }
    if (condition && condition !== 'All') {
      params.push(condition);
      where.push(`l.condition=$${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(l.title ILIKE $${params.length} OR l.description ILIKE $${params.length})`);
    }
    if (lat && lng && radius) {
      params.push(parseFloat(lat));
      params.push(parseFloat(lng));
      params.push(parseFloat(radius));
      where.push(`(
        6371 * acos(
          cos(radians($${params.length - 2})) * cos(radians(l.latitude)) *
          cos(radians(l.longitude) - radians($${params.length - 1})) +
          sin(radians($${params.length - 2})) * sin(radians(l.latitude))
        )
      ) < $${params.length}`);
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM listings l WHERE ${where.join(' AND ')}`, params
    );

    const whereClause = where.join(' AND ');
    let query = `
      SELECT l.*, u.username as seller, u.avatar_url, u.is_verified,
             u.rating_avg as seller_rating, u.rating_count,
             u.trust_score as seller_trust_score,
             a.id as auction_id, a.current_price as auction_current_price,
             a.starting_price as auction_starting_price, a.ends_at as auction_ends_at,
             a.status as auction_status,
             (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) as bid_count
      FROM listings l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN auctions a ON l.id = a.listing_id
      WHERE ${whereClause}
    `;
    if (sort === 'price-low') query += ' ORDER BY l.is_boosted DESC NULLS LAST, l.price ASC';
    else if (sort === 'price-high') query += ' ORDER BY l.is_boosted DESC NULLS LAST, l.price DESC';
    else query += ' ORDER BY l.is_boosted DESC NULLS LAST, l.created_at DESC';

    params.push(limit, offset);
    const result = await db.query(`${query} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
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

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
  `SELECT l.*, u.username as seller, u.avatar_url, u.is_verified,
          u.rating_avg as seller_rating, u.rating_count,
          u.trust_score as seller_trust_score,
          a.id as auction_id, a.current_price as auction_current_price,
          a.starting_price as auction_starting_price, a.ends_at as auction_ends_at,
          a.status as auction_status,
          (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) as bid_count
   FROM listings l
   LEFT JOIN users u ON l.user_id = u.id
   LEFT JOIN auctions a ON l.id = a.listing_id
   WHERE l.id=$1`,
  [req.params.id]
);
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create listing (protected)
router.post('/', auth, async (req, res) => {
  const { title, description, price, category, condition, location, latitude, longitude, photos } = req.body;
  if (!title || !price || !category)
    return res.status(400).json({ error: 'Title, price and category required' });
  try {
    const result = await db.query(
      `INSERT INTO listings (user_id, title, description, price, category, condition, location, latitude, longitude, photos, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active') RETURNING *`,
      [req.user.id, title, description, price, category, condition, location, latitude, longitude, photos || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update listing (protected, owner only)
router.patch('/:id', auth, async (req, res) => {
  const {
    title, description, price, condition,
    status, location, category, photos,
    latitude, longitude
  } = req.body;
  try {
    const check = await db.query(
      'SELECT user_id FROM listings WHERE id=$1',
      [req.params.id]
    );
    if (!check.rows.length)
      return res.status(404).json({ error: 'Listing not found' });
    if (check.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'You can only edit your own listings' });

    const result = await db.query(
      `UPDATE listings SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        condition = COALESCE($4, condition),
        status = COALESCE($5, status),
        location = COALESCE($6, location),
        category = COALESCE($7, category),
        photos = COALESCE($8, photos),
        latitude = COALESCE($9, latitude),
        longitude = COALESCE($10, longitude)
       WHERE id=$11 RETURNING *`,
      [title, description, price, condition, status,
       location, category, photos, latitude, longitude,
       req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete listing (protected, owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const check = await db.query('SELECT user_id FROM listings WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });
    if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await db.query('DELETE FROM listings WHERE id=$1', [req.params.id]);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;