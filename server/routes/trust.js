const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { computeTrustScore, getTrustLevel } = require('../services/trustScore');

router.get('/user/:user_id', async (req, res) => {
  try {
    const score = await computeTrustScore(req.params.user_id);
    const level = getTrustLevel(score);
    const breakdown = await db.query(
      'SELECT * FROM trust_scores WHERE user_id=$1',
      [req.params.user_id]
    );
    res.json({
      score,
      level,
      breakdown: breakdown.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const score = await computeTrustScore(req.user.id);
    const level = getTrustLevel(score);
    const breakdown = await db.query(
      'SELECT * FROM trust_scores WHERE user_id=$1',
      [req.user.id]
    );
    const user = await db.query(
      'SELECT is_verified, two_fa_enabled, rating_avg, rating_count, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({
      score,
      level,
      breakdown: breakdown.rows[0] || null,
      user: user.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/login-history', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM login_history WHERE user_id=$1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/devices', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM device_fingerprints WHERE user_id=$1
       ORDER BY last_seen DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/devices/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM device_fingerprints WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Device removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
