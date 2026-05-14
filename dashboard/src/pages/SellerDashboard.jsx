import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, TrendingUp, Star, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import toast from 'react-hot-toast';

export default function SellerDashboard() {
  const [overview, setOverview] = useState(null);
  const [listings, setListings] = useState([]);
  const [offers, setOffers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activity, setActivity] = useState({ listings: [], offers: [] });
  const [loading, setLoading] = useState(true);
  const [listingFilter, setListingFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          api.get('/seller/overview'),
          api.get('/seller/listings'),
          api.get('/seller/offers'),
          api.get('/seller/reviews'),
          api.get('/seller/activity'),
        ]);

        const [ov, ls, of, rv, ac] = results;

        if (ov.status === 'fulfilled') setOverview(ov.value);
        else console.error('Overview failed:', ov.reason);

        if (ls.status === 'fulfilled') setListings(ls.value.listings || []);
        else console.error('Listings failed:', ls.reason);

        if (of.status === 'fulfilled') setOffers(of.value);
        else console.error('Offers failed:', of.reason);

        if (rv.status === 'fulfilled') setReviews(rv.value);
        else console.error('Reviews failed:', rv.reason);

        if (ac.status === 'fulfilled') {
          setActivity({
            listings: (ac.value.listings || []).map(d => ({
              ...d,
              date: format(parseISO(d.date), 'MMM d'),
            })),
            offers: (ac.value.offers || []).map(d => ({
              ...d,
              date: format(parseISO(d.date), 'MMM d'),
            })),
          });
        } else console.error('Activity failed:', ac.reason);

      } catch (err) {
        toast.error('Failed to load dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleStatusChange = async (listingId, status) => {
    try {
      await api.patch(`/listings/${listingId}`, { status });
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, status } : l));
      toast.success('Listing updated');
    } catch { toast.error('Failed to update listing'); }
  };

  const handleOfferAction = async (offerId, action) => {
    try {
      await api.patch(`/offers/${offerId}/${action}`);
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: action === 'accept' ? 'accepted' : 'declined' } : o));
      toast.success(`Offer ${action}ed`);
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading your dashboard...</div>;
  if (!loading && !overview) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Seller Dashboard</div>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        No seller data yet. Post your first listing on the marketplace to get started.
      </div>
    </div>
  );

  const filteredListings = listingFilter ? listings.filter(l => l.status === listingFilter) : listings;

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Seller Dashboard</h1>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Your selling performance and listings</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total listings" value={overview?.listings?.total} sub={`${overview?.listings?.active} active · ${overview?.listings?.sold} sold`} icon={Package} color="var(--gold)" />
        <StatCard label="Incoming offers" value={overview?.offers?.total} sub={`${overview?.offers?.pending} pending`} icon={TrendingUp} color="var(--green)" />
        <StatCard label="Avg rating" value={overview?.reviews?.avg_rating ? `★ ${Number(overview.reviews.avg_rating).toFixed(1)}` : '—'} sub={`${overview?.reviews?.total} reviews`} icon={Star} color="var(--gold)" />
        <StatCard label="Active boosts" value={overview?.boosts?.active_boosts} icon={Zap} color="var(--gold)" />
      </div>

      {/* Activity chart */}
      {(activity.listings.length > 0 || activity.offers.length > 0) && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Activity — last 30 days</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={activity.listings}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(240,239,233,0.3)', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(240,239,233,0.3)', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12, fontFamily: 'DM Mono' }} />
              <Area type="monotone" dataKey="count" stroke="#C9A84C" fill="url(#actGrad)" strokeWidth={2} dot={false} name="Listings" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Listings */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>My listings</div>
            <select value={listingFilter} onChange={e => setListingFilter(e.target.value)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-mono)' }}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {filteredListings.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No listings</div>
            ) : filteredListings.map(l => (
              <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {l.photos?.[0] && <img src={l.photos[0]} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>UGX {Number(l.price).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span>{l.offer_count} offers</span>
                    <span>{l.favourite_count} saves</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: l.status === 'active' ? 'var(--green-dim)' : l.status === 'sold' ? 'var(--blue-dim)' : 'var(--surface3)', color: l.status === 'active' ? 'var(--green)' : l.status === 'sold' ? 'var(--blue)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{l.status}</span>
                  {l.status === 'active' && (
                    <button onClick={() => handleStatusChange(l.id, 'paused')} style={{ fontSize: 10, background: 'var(--surface3)', border: 'none', borderRadius: 5, padding: '2px 7px', color: 'var(--text-muted)', cursor: 'pointer' }}>Pause</button>
                  )}
                  {l.status === 'paused' && (
                    <button onClick={() => handleStatusChange(l.id, 'active')} style={{ fontSize: 10, background: 'var(--green-dim)', border: 'none', borderRadius: 5, padding: '2px 7px', color: 'var(--green)', cursor: 'pointer' }}>Activate</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incoming offers */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Incoming offers</div>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {offers.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No offers yet</div>
            ) : offers.map(o => (
              <div key={o.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', flex: 1, paddingRight: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.listing_title}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: o.status === 'accepted' ? 'var(--green-dim)' : o.status === 'declined' ? 'var(--red-dim)' : 'var(--gold-dim)', color: o.status === 'accepted' ? 'var(--green)' : o.status === 'declined' ? 'var(--red)' : 'var(--gold)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{o.status}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)', marginBottom: 4 }}>UGX {Number(o.amount).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>from {o.buyer_name} · {o.buyer_rating ? `★ ${Number(o.buyer_rating).toFixed(1)}` : 'No rating'}</div>
                {o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleOfferAction(o.id, 'accept')} style={{ flex: 1, background: 'var(--green-dim)', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, color: 'var(--green)', cursor: 'pointer', fontWeight: 600 }}>Accept</button>
                    <button onClick={() => handleOfferAction(o.id, 'decline')} style={{ flex: 1, background: 'var(--red-dim)', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, color: 'var(--red)', cursor: 'pointer', fontWeight: 600 }}>Decline</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent reviews</div>
        </div>
        {reviews.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No reviews yet</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: 'var(--gold)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{format(new Date(r.created_at), 'MMM d')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{r.comment || 'No comment'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {r.reviewer_name} · {r.listing_title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}