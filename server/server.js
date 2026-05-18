const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const db = require('./db');
const { computeTrustScore } = require('./services/trustScore');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowed = [
        process.env.CLIENT_URL,
        process.env.DASHBOARD_URL,
        'http://localhost:5173',
        'http://localhost:5174',
      ].filter(Boolean);
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL,
      process.env.DASHBOARD_URL,
      'http://localhost:5173',
      'http://localhost:5174',
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/images', require('./routes/images'));
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// ── Google OAuth ───────────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
  callbackURL: '/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const username = profile.displayName.replace(/\s+/g, '').toLowerCase();
    const avatar_url = profile.photos[0]?.value;

    let user = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!user.rows.length) {
      user = await db.query(
        `INSERT INTO users (email, username, password_hash, avatar_url)
         VALUES ($1,$2,'google_oauth',$3) RETURNING *`,
        [email, username, avatar_url]
      );
    }
    return done(null, user.rows[0]);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id=$1', [id]);
    done(null, result.rows[0]);
  } catch (err) { done(err); }
});

// Google auth routes
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login` }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    const user = { id: req.user.id, email: req.user.email, username: req.user.username };
    res.redirect(`${process.env.CLIENT_URL}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/favourites', require('./routes/favourites'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/auctions', require('./routes/auctions'));
const endExpiredAuctions = require('./jobs/endAuctions');
const checkPriceDrops = require('./jobs/checkPriceDrops');
app.use('/api/bundles', require('./routes/bundles'));
app.use('/api/boosts', require('./routes/boosts'));
app.use('/api/admin/analytics', require('./routes/admin-analytics'));
app.use('/api/admin/users', require('./routes/admin-users'));
app.use('/api/admin/listings', require('./routes/admin-listings'));
app.use('/api/admin/reports', require('./routes/admin-reports'));
app.use('/api/seller', require('./routes/seller-dashboard'));
app.use('/api/buyer', require('./routes/buyer-dashboard'));
app.use('/api/2fa', require('./routes/twofa'));
app.use('/api/trust', require('./routes/trust'));
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Alsel API running — Phase 4' });
});

// ── Socket.io ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join_room', (offer_id) => {
    socket.join(offer_id);
    console.log(`Socket ${socket.id} joined room ${offer_id}`);
  });
  socket.on('send_message', async (data) => {
    const { offer_id, sender_id, sender_name, body } = data;
    try {
      const result = await db.query(
        `INSERT INTO messages (offer_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *`,
        [offer_id, sender_id, body]
      );
      io.to(offer_id).emit('receive_message', { ...result.rows[0], sender_name });
    } catch (err) {
      console.error('Message error:', err.message);
    }
  });
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Alsel server running on port ${PORT} — Phase 4`);
  setInterval(endExpiredAuctions, 60 * 1000);
  endExpiredAuctions();
  // Cleanup expired boosts every 5 minutes
  const { cleanupExpiredBoosts } = require('./routes/boosts');
  const runBoostCleanup = () => cleanupExpiredBoosts().catch(err => console.error('Boost cleanup error:', err.message));
  setInterval(runBoostCleanup, 5 * 60 * 1000);
  runBoostCleanup();
  // Check price drops every hour
  setInterval(checkPriceDrops, 60 * 60 * 1000);
  checkPriceDrops();
  // Recompute trust scores every hour
  setInterval(async () => {
    try {
      const users = await db.query('SELECT id FROM users WHERE role != $1', ['banned']);
      for (const u of users.rows) {
        await computeTrustScore(u.id);
      }
      console.log(`Trust scores updated for ${users.rows.length} users`);
    } catch (err) {
      console.error('Trust score cron error:', err.message);
    }
  }, 60 * 60 * 1000);
});