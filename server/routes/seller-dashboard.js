const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Seller overview stats
router.get('/overview', auth, async (req, res) => {
  try {
    const listings = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='active') as active,
        COUNT(*) FILTER (WHERE status='sold') as sold,
        COUNT(*) FILTER (WHERE status='paused') as paused,
        COALESCE(AVG(price), 0) as avg_price,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30_days
      FROM listings WHERE user_id=$1
    `, [req.user.id]);

    const offers = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE o.status='pending') as pending,
        COUNT(*) FILTER (WHERE o.status='accepted') as accepted,
        COUNT(*) FILTER (WHERE o.status='declined') as declined
      FROM offers o
      LEFT JOIN listings l ON o.listing_id=l.id
      WHERE l.user_id=$1
    `, [req.user.id]);

    const reviews = await db.query(`
      SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating,
        COUNT(*) FILTER (WHERE rating=5) as five_star,
        COUNT(*) FILTER (WHERE rating=4) as four_star,
        COUNT(*) FILTER (WHERE rating<=3) as three_or_below
      FROM reviews WHERE seller_id=$1
    `, [req.user.id]);

    const boosts = await db.query(`
      SELECT COUNT(*) as active_boosts
      FROM boosts
      WHERE user_id=$1 AND active=true AND expires_at > NOW()
    `, [req.user.id]);

    res.json({
      listings: listings.rows[0],
      offers: offers.rows[0],
      reviews: reviews.rows[0],
      boosts: boosts.rows[0],
    });
  } catch (err) {
    console.error('Seller overview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Seller's listings with performance
router.get('/listings', auth, async (req, res) => {
  const { page = 1, limit = 10, status, sort = 'newest' } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = ['l.user_id=$1'];
    const params = [req.user.id];

    if (status) {
      params.push(status);
      where.push(`l.status=$${params.length}`);
    }

    let orderBy = 'l.created_at DESC';
    if (sort === 'most-offers') orderBy = 'offer_count DESC';
    if (sort === 'highest-price') orderBy = 'l.price DESC';
    if (sort === 'most-views') orderBy = 'l.price DESC';

    params.push(limit, offset);
    const result = await db.query(`
      SELECT l.*,
        COUNT(DISTINCT o.id) as offer_count,
        COUNT(DISTINCT f.id) as favourite_count,
        a.current_price as auction_current_price,
        a.ends_at as auction_ends_at,
        a.status as auction_status,
        (SELECT COUNT(*) FROM bids b LEFT JOIN auctions aa ON b.auction_id=aa.id WHERE aa.listing_id=l.id) as bid_count
      FROM listings l
      LEFT JOIN offers o ON l.id=o.listing_id
      LEFT JOIN favourites f ON l.id=f.listing_id
      LEFT JOIN auctions a ON l.id=a.listing_id
      WHERE ${where.join(' AND ')}
      GROUP BY l.id, a.current_price, a.ends_at, a.status
      ORDER BY ${orderBy}
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    const count = await db.query('SELECT COUNT(*) FROM listings WHERE user_id=$1', [req.user.id]);

    res.json({
      listings: result.rows,
      total: Number(count.rows[0].count),
      page: Number(page),
      pages: Math.ceil(Number(count.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seller's incoming offers
router.get('/offers', auth, async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = ['l.user_id=$1'];
    const params = [req.user.id];
    if (status) { params.push(status); where.push(`o.status=$${params.length}`); }
    params.push(limit, offset);
    const result = await db.query(`
      SELECT o.*, l.title as listing_title, l.price as listing_price,
        l.photos as listing_photos, l.category,
        u.username as buyer_name, u.rating_avg as buyer_rating
      FROM offers o
      LEFT JOIN listings l ON o.listing_id=l.id
      LEFT JOIN users u ON o.buyer_id=u.id
      WHERE ${where.join(' AND ')}
      ORDER BY o.created_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seller's reviews
router.get('/reviews', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, u.username as reviewer_name, l.title as listing_title
      FROM reviews r
      LEFT JOIN users u ON r.reviewer_id=u.id
      LEFT JOIN listings l ON r.listing_id=l.id
      WHERE r.seller_id=$1
      ORDER BY r.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seller listing activity over time
router.get('/activity', auth, async (req, res) => {
  try {
    const [listingsByDay, offersByDay] = await Promise.all([
      db.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM listings WHERE user_id=$1
        AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date ASC
      `, [req.user.id]),
      db.query(`
        SELECT DATE(o.created_at) as date, COUNT(*) as count
        FROM offers o
        LEFT JOIN listings l ON o.listing_id=l.id
        WHERE l.user_id=$1
        AND o.created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(o.created_at) ORDER BY date ASC
      `, [req.user.id]),
    ]);
    res.json({ listings: listingsByDay.rows, offers: offersByDay.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;