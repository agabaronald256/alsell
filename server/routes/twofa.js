const router = require('express').Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/setup', auth, async (req, res) => {
  try {
    const user = await db.query('SELECT email, username FROM users WHERE id=$1', [req.user.id]);
    if (!user.rows.length) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.generateSecret({
      name: `Alsel (${user.rows[0].email})`,
      issuer: 'Alsel Marketplace',
      length: 32,
    });

    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).slice(2, 10).toUpperCase()
    );

    await db.query(`
      INSERT INTO two_factor_auth (user_id, secret, enabled, backup_codes)
      VALUES ($1,$2,false,$3)
      ON CONFLICT (user_id) DO UPDATE SET
        secret=$2, enabled=false, backup_codes=$3
    `, [req.user.id, secret.base32, backupCodes]);

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qr_code: qrCodeUrl,
      backup_codes: backupCodes,
      otpauth_url: secret.otpauth_url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/enable', auth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'TOTP token required' });

  try {
    const tfa = await db.query(
      'SELECT * FROM two_factor_auth WHERE user_id=$1',
      [req.user.id]
    );
    if (!tfa.rows.length) return res.status(400).json({ error: 'Please set up 2FA first' });

    const verified = speakeasy.totp.verify({
      secret: tfa.rows[0].secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid code. Please check your authenticator app.' });

    await db.query(
      'UPDATE two_factor_auth SET enabled=true WHERE user_id=$1',
      [req.user.id]
    );
    await db.query(
      'UPDATE users SET two_fa_enabled=true WHERE id=$1',
      [req.user.id]
    );

    res.json({ message: '2FA enabled successfully', backup_codes: tfa.rows[0].backup_codes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disable', auth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'TOTP token required to disable 2FA' });

  try {
    const tfa = await db.query(
      'SELECT * FROM two_factor_auth WHERE user_id=$1 AND enabled=true',
      [req.user.id]
    );
    if (!tfa.rows.length) return res.status(400).json({ error: '2FA is not enabled' });

    const verified = speakeasy.totp.verify({
      secret: tfa.rows[0].secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid code' });

    await db.query('UPDATE two_factor_auth SET enabled=false WHERE user_id=$1', [req.user.id]);
    await db.query('UPDATE users SET two_fa_enabled=false WHERE id=$1', [req.user.id]);

    res.json({ message: '2FA disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify', async (req, res) => {
  const { user_id, token, backup_code } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const tfa = await db.query(
      'SELECT * FROM two_factor_auth WHERE user_id=$1 AND enabled=true',
      [user_id]
    );
    if (!tfa.rows.length) return res.status(400).json({ error: '2FA not enabled for this user' });

    if (backup_code) {
      const codes = tfa.rows[0].backup_codes || [];
      const idx = codes.indexOf(backup_code.toUpperCase());
      if (idx === -1) return res.status(400).json({ error: 'Invalid backup code' });
      codes.splice(idx, 1);
      await db.query('UPDATE two_factor_auth SET backup_codes=$1 WHERE user_id=$2', [codes, user_id]);
      return res.json({ verified: true, method: 'backup_code' });
    }

    if (!token) return res.status(400).json({ error: 'Token or backup code required' });
    const verified = speakeasy.totp.verify({
      secret: tfa.rows[0].secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid authentication code' });

    res.json({ verified: true, method: 'totp' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT enabled, created_at FROM two_factor_auth WHERE user_id=$1',
      [req.user.id]
    );
    res.json({
      enabled: result.rows[0]?.enabled || false,
      setup_at: result.rows[0]?.created_at || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
