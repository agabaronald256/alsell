const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const generateFingerprint = (req) => {
  const ua = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  return crypto.createHash('sha256').update(`${ua}${lang}`).digest('hex').slice(0, 64);
};

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1,$2,$3) RETURNING id, email, username, role',
      [email, username, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const fingerprint = generateFingerprint(req);
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';

  try {
    const result = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'banned') {
      return res.status(403).json({
        error: 'Account suspended',
        reason: user.ban_reason,
        until: user.banned_until,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await db.query(
        'INSERT INTO login_history (user_id, ip_address, fingerprint, status) VALUES ($1,$2,$3,$4)',
        [user.id, ip, fingerprint, 'failed']
      ).catch(() => {});
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.two_fa_enabled) {
      const trusted = await db.query(
        'SELECT id FROM device_fingerprints WHERE user_id=$1 AND fingerprint=$2 AND trusted=true',
        [user.id, fingerprint]
      );
      if (!trusted.rows.length) {
        return res.status(200).json({
          requires_2fa: true,
          user_id: user.id,
          message: 'Please enter your 2FA code',
        });
      }
    }

    await db.query(`
      INSERT INTO device_fingerprints (user_id, fingerprint, user_agent, ip_address, last_seen, trusted)
      VALUES ($1,$2,$3,$4,NOW(),true)
      ON CONFLICT (user_id, fingerprint) DO UPDATE SET last_seen=NOW(), ip_address=$4
    `, [user.id, fingerprint, req.headers['user-agent'], ip]).catch(() => {});

    await db.query(
      'INSERT INTO login_history (user_id, ip_address, fingerprint, status) VALUES ($1,$2,$3,$4)',
      [user.id, ip, fingerprint, 'success']
    ).catch(() => {});

    await db.query(
      'UPDATE users SET last_login=NOW(), last_ip=$1, login_count=login_count+1 WHERE id=$2',
      [ip, user.id]
    ).catch(() => {});

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        two_fa_enabled: user.two_fa_enabled,
        trust_score: user.trust_score,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/login/2fa', async (req, res) => {
  const { user_id, token: totpToken, backup_code } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const fingerprint = generateFingerprint(req);
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';

  try {
    const speakeasy = require('speakeasy');
    const tfa = await db.query(
      'SELECT * FROM two_factor_auth WHERE user_id=$1 AND enabled=true',
      [user_id]
    );
    if (!tfa.rows.length) return res.status(400).json({ error: '2FA not set up' });

    let verified = false;

    if (backup_code) {
      const codes = tfa.rows[0].backup_codes || [];
      const idx = codes.indexOf(backup_code.toUpperCase());
      if (idx !== -1) {
        codes.splice(idx, 1);
        await db.query('UPDATE two_factor_auth SET backup_codes=$1 WHERE user_id=$2', [codes, user_id]);
        verified = true;
      }
    } else if (totpToken) {
      verified = speakeasy.totp.verify({
        secret: tfa.rows[0].secret,
        encoding: 'base32',
        token: totpToken,
        window: 2,
      });
    }

    if (!verified) {
      return res.status(400).json({ error: 'Invalid authentication code' });
    }

    const user = await db.query('SELECT * FROM users WHERE id=$1', [user_id]);
    if (!user.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = user.rows[0];

    await db.query(`
      INSERT INTO device_fingerprints (user_id, fingerprint, user_agent, ip_address, last_seen, trusted)
      VALUES ($1,$2,$3,$4,NOW(),true)
      ON CONFLICT (user_id, fingerprint) DO UPDATE SET last_seen=NOW(), trusted=true
    `, [user_id, fingerprint, req.headers['user-agent'], ip]).catch(() => {});

    await db.query(
      'INSERT INTO login_history (user_id, ip_address, fingerprint, status) VALUES ($1,$2,$3,$4)',
      [user_id, ip, fingerprint, 'success_2fa']
    ).catch(() => {});

    await db.query(
      'UPDATE users SET last_login=NOW(), last_ip=$1, login_count=login_count+1 WHERE id=$2',
      [ip, user_id]
    ).catch(() => {});

    const token = jwt.sign(
      { id: u.id, email: u.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        two_fa_enabled: u.two_fa_enabled,
        trust_score: u.trust_score,
      },
      token,
    });
  } catch (err) {
    console.error('2FA login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
