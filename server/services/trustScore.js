const db = require('../db');

const computeTrustScore = async (userId) => {
  try {
    const [user, reviews, offers, transactions] = await Promise.all([
      db.query('SELECT * FROM users WHERE id=$1', [userId]),
      db.query('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE seller_id=$1', [userId]),
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='accepted') as accepted,
          COUNT(*) FILTER (WHERE status='declined') as declined
        FROM offers o
        LEFT JOIN listings l ON o.listing_id=l.id
        WHERE l.user_id=$1
      `, [userId]),
      db.query(`
        SELECT COUNT(*) as sold
        FROM listings WHERE user_id=$1 AND status='sold'
      `, [userId]),
    ]);

    if (!user.rows.length) return 0;
    const u = user.rows[0];
    const r = reviews.rows[0];
    const o = offers.rows[0];
    const t = transactions.rows[0];

    const avgRating = parseFloat(r.avg_rating) || 0;
    const ratingScore = Math.round(avgRating * 6);

    let verificationScore = 0;
    if (u.is_verified) verificationScore += 15;

    const soldCount = parseInt(t.sold) || 0;
    const activityScore = Math.min(20, soldCount * 2);

    const accountAgeMonths = Math.floor(
      (Date.now() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    const ageScore = Math.min(15, accountAgeMonths);

    const totalOffers = parseInt(o.total) || 0;
    const respondedOffers = parseInt(o.accepted) + parseInt(o.declined) || 0;
    const responseRate = totalOffers > 0 ? respondedOffers / totalOffers : 0;
    const responseScore = Math.round(responseRate * 10);

    const totalScore = ratingScore + verificationScore + activityScore + ageScore + responseScore;

    await db.query(`
      INSERT INTO trust_scores (user_id, total_score, rating_score, verification_score, activity_score, age_score, response_score, computed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        total_score=$2, rating_score=$3, verification_score=$4,
        activity_score=$5, age_score=$6, response_score=$7,
        computed_at=NOW()
    `, [userId, totalScore, ratingScore, verificationScore, activityScore, ageScore, responseScore]);

    await db.query('UPDATE users SET trust_score=$1 WHERE id=$2', [totalScore, userId]);

    return totalScore;
  } catch (err) {
    console.error('Trust score error:', err.message);
    return 0;
  }
};

const getTrustLevel = (score) => {
  if (score >= 80) return { level: 'Platinum', color: '#A0C4FF', icon: '◈' };
  if (score >= 60) return { level: 'Gold', color: '#C9A84C', icon: '◆' };
  if (score >= 40) return { level: 'Silver', color: '#9E9E9E', icon: '◇' };
  if (score >= 20) return { level: 'Bronze', color: '#CD7F32', icon: '○' };
  return { level: 'New', color: '#666', icon: '·' };
};

module.exports = { computeTrustScore, getTrustLevel };
