const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { isModerator } = require('../middleware/roles');

// Get all reports with filters
router.get('/', auth, isModerator, async (req, res) => {
  const { page = 1, limit = 20, status = 'pending' } = req.query;
  const offset = (page - 1) * limit;
  try {
    const params = [status, limit, offset];
    const result = await db.query(`
      SELECT r.*,
        reporter.username as reporter_name,
        reported.username as reported_name,
        l.title as listing_title
      FROM reports r
      LEFT JOIN users reporter ON r.reporter_id = reporter.id
      LEFT JOIN users reported ON r.reported_user_id = reported.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.status=$1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, params);
    const count = await db.query("SELECT COUNT(*) FROM reports WHERE status=$1", [status]);
    res.json({
      reports: result.rows,
      total: Number(count.rows[0].count),
      page: Number(page),
      pages: Math.ceil(Number(count.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve report
router.patch('/:id/resolve', auth, isModerator, async (req, res) => {
  const { action, note } = req.body;
  const validActions = ['dismissed', 'actioned', 'escalated'];
  if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    await db.query(
      'UPDATE reports SET status=$1, resolved_by=$2, resolved_at=NOW(), resolution_note=$3 WHERE id=$4',
      [action, req.user.id, note, req.params.id]
    );
    await db.query(
      `INSERT INTO admin_log (admin_id, action, details)
       VALUES ($1, 'resolve_report', $2)`,
      [req.user.id, JSON.stringify({ report_id: req.params.id, action, note })]
    );
    res.json({ message: 'Report resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;