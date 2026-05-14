const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Buyer overview
router.get('/overview', auth, async (req, res) => {
  try {
    const [offers, favourites, bids, reviews] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='pending') as pending,
          COUNT(*) FILTER (WHERE status='accepted') as accepted,
          COUNT(*) FILTER (WHERE status='declined') as declined
        FROM offers WHERE buyer_id=$1
      `, [req.user.id]),
      db.query('SELECT COUNT(*) as total FROM favourites WHERE user_id=$1', [req.user.id]),
      db.query(`
        SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE a.status='active') as active_auctions
        FROM bids b LEFT JOIN auctions a ON b.auction_id=a.id
        WHERE b.bidder_id=$1
      `, [req.user.id]),
      db.query('SELECT COUNT(*) as total FROM reviews WHERE reviewer_id=$1', [req.user.id]),
    ]);
    res.json({
      offers: offers.rows[0],
      favourites: favourites.rows[0],
      bids: bids.rows[0],
      reviews: reviews.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buyer's offers
router.get('/offers', auth, async (req, res) => {
  const { status } = req.query;
  try {
    let where = ['o.buyer_id=$1'];
    const params = [req.user.id];
    if (status) { params.push(status); where.push(`o.status=$${params.length}`); }
    const result = await db.query(`
      SELECT o.*, l.title as listing_title, l.price as listing_price,
        l.photos as listing_photos, l.category, l.location,
        u.username as seller_name, u.rating_avg as seller_rating, u.is_verified as seller_verified
      FROM offers o
      LEFT JOIN listings l ON o.listing_id=l.id
      LEFT JOIN users u ON l.user_id=u.id
      WHERE ${where.join(' AND ')}
      ORDER BY o.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buyer's bid history
router.get('/bids', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.*, a.current_price, a.ends_at, a.status as auction_status,
        a.winner_id, l.title as listing_title, l.photos as listing_photos,
        l.category, l.location,
        CASE WHEN a.winner_id=b.bidder_id THEN true ELSE false END as is_winning
      FROM bids b
      LEFT JOIN auctions a ON b.auction_id=a.id
      LEFT JOIN listings l ON a.listing_id=l.id
      WHERE b.bidder_id=$1
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buyer's favourites with price drop info
router.get('/favourites', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, u.username as seller, f.price_at_save, f.created_at as saved_at,
        CASE WHEN l.price < f.price_at_save THEN true ELSE false END as price_dropped,
        CASE WHEN l.price < f.price_at_save
          THEN ROUND(((f.price_at_save - l.price)::numeric / f.price_at_save) * 100, 1)
          ELSE 0 END as drop_percentage
      FROM favourites f
      LEFT JOIN listings l ON f.listing_id=l.id
      LEFT JOIN users u ON l.user_id=u.id
      WHERE f.user_id=$1
      ORDER BY price_dropped DESC, f.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;