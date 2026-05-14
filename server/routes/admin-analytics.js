const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { isModerator, isSuperAdmin } = require('../middleware/roles');

// Platform overview stats
router.get('/overview', auth, isSuperAdmin, async (req, res) => {
  try {
    const [
      users, listings, offers, messages,
      auctions, bids, reviews, reports,
      boosts, newUsersToday, newListingsToday,
      offersToday, activeAuctions
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM listings'),
      db.query('SELECT COUNT(*) FROM offers'),
      db.query('SELECT COUNT(*) FROM messages'),
      db.query('SELECT COUNT(*) FROM auctions'),
      db.query('SELECT COUNT(*) FROM bids'),
      db.query('SELECT COUNT(*) FROM reviews'),
      db.query("SELECT COUNT(*) FROM reports WHERE status='pending'"),
      db.query('SELECT COUNT(*) FROM boosts WHERE active=true'),
      db.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) FROM listings WHERE created_at > NOW() - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) FROM offers WHERE created_at > NOW() - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) FROM auctions WHERE status='active'"),
    ]);

    res.json({
      total_users: Number(users.rows[0].count),
      total_listings: Number(listings.rows[0].count),
      total_offers: Number(offers.rows[0].count),
      total_messages: Number(messages.rows[0].count),
      total_auctions: Number(auctions.rows[0].count),
      total_bids: Number(bids.rows[0].count),
      total_reviews: Number(reviews.rows[0].count),
      pending_reports: Number(reports.rows[0].count),
      active_boosts: Number(boosts.rows[0].count),
      new_users_today: Number(newUsersToday.rows[0].count),
      new_listings_today: Number(newListingsToday.rows[0].count),
      offers_today: Number(offersToday.rows[0].count),
      active_auctions: Number(activeAuctions.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User growth over time (last 30 days)
router.get('/user-growth', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listings growth over time (last 30 days)
router.get('/listing-growth', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        category
      FROM listings
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), category
      ORDER BY date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Category distribution
router.get('/categories', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='active') as active,
        COUNT(*) FILTER (WHERE status='sold') as sold,
        AVG(price) as avg_price
      FROM listings
      GROUP BY category
      ORDER BY total DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Offer conversion rate
router.get('/conversions', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_offers,
        COUNT(*) FILTER (WHERE status='accepted') as accepted,
        COUNT(*) FILTER (WHERE status='declined') as declined,
        COUNT(*) FILTER (WHERE status='pending') as pending
      FROM offers
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top sellers
router.get('/top-sellers', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.username, u.email, u.role,
        u.rating_avg, u.rating_count, u.is_verified,
        COUNT(l.id) as listing_count,
        COUNT(l.id) FILTER (WHERE l.status='sold') as sold_count,
        u.created_at
      FROM users u
      LEFT JOIN listings l ON u.id = l.user_id
      GROUP BY u.id
      ORDER BY sold_count DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Location heatmap data
router.get('/locations', auth, isSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        location,
        COUNT(*) as listing_count,
        AVG(price) as avg_price
      FROM listings
      WHERE location IS NOT NULL
      GROUP BY location
      ORDER BY listing_count DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;