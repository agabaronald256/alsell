import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, TrendingUp, Star, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

export default function SellerDashboard() {
  const [overview, setOverview] = useState(null);
  const [listings, setListings] = useState([]);
  const [listingPages, setListingPages] = useState(1);
  const [offers, setOffers] = useState([]);
  const [offerPages, setOfferPages] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [reviewPages, setReviewPages] = useState(1);
  const [activity, setActivity] = useState({ listings: [], offers: [] });
  const [loading, setLoading] = useState(true);
  const [listingFilter, setListingFilter] = useState('');
  const [listingPage, setListingPage] = useState(1);
  const [offerPage, setOfferPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [editingListing, setEditingListing] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          api.get('/seller/overview'),
          api.get(`/seller/listings?page=${listingPage}`),
          api.get(`/seller/offers?page=${offerPage}`),
          api.get(`/seller/reviews?page=${reviewPage}`),
          api.get('/seller/activity'),
        ]);

        const [ov, ls, of, rv, ac] = results;

        if (ov.status === 'fulfilled') setOverview(ov.value);
        else console.error('Overview failed:', ov.reason);

        if (ls.status === 'fulfilled') { setListings(ls.value.listings || []); setListingPages(ls.value.pages || 1); }
        else console.error('Listings failed:', ls.reason);

        if (of.status === 'fulfilled') { setOffers(of.value.offers || []); setOfferPages(of.value.pages || 1); }
        else console.error('Offers failed:', of.reason);

        if (rv.status === 'fulfilled') { setReviews(rv.value.reviews || []); setReviewPages(rv.value.pages || 1); }
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
  }, [listingPage, offerPage, reviewPage]);

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
                  <button onClick={() => setEditingListing(l)} style={{ fontSize: 10, background: 'var(--gold-dim)', border: 'none', borderRadius: 5, padding: '2px 7px', color: 'var(--gold)', cursor: 'pointer' }}>Edit</button>
                </div>
              </div>
            ))}
            </div>
            <Pagination page={listingPage} pages={listingPages} onPageChange={setListingPage} />
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
            <Pagination page={offerPage} pages={offerPages} onPageChange={setOfferPage} />
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
      <Pagination page={reviewPage} pages={reviewPages} onPageChange={setReviewPage} />
    </div>
      {editingListing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, overflow: 'hidden' }}>
            <div style={{ background: 'var(--black)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)' }}>Edit listing</div>
              <button onClick={() => setEditingListing(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
            <DashboardEditForm
              listing={editingListing}
              onSave={async (form) => {
                try {
                  await api.patch(`/listings/${editingListing.id}`, form);
                  setListings(prev => prev.map(l => l.id === editingListing.id ? { ...l, ...form } : l));
                  setEditingListing(null);
                  toast.success('Listing updated!');
                } catch (err) {
                  toast.error(err.error || 'Failed to update');
                }
              }}
              onCancel={() => setEditingListing(null)}
            />
          </div>
        </div>
      )}
  );
}

function DashboardEditForm({ listing, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: listing.title || '',
    description: listing.description || '',
    price: listing.price || '',
    condition: listing.condition || 'Used',
    location: listing.location || '',
    status: listing.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const inputStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' };
  const labelStyle = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...form, price: Number(form.price) });
    setSaving(false);
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
      <div><label style={labelStyle}>Title</label><input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
      <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, height: 80, resize: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      <div><label style={labelStyle}>Price (UGX)</label><input style={inputStyle} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
      <div>
        <label style={labelStyle}>Condition</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Brand new', 'Like new', 'Used', 'For parts'].map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, condition: c }))}
              style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${form.condition === c ? 'var(--gold)' : 'var(--border)'}`, background: form.condition === c ? 'var(--gold-dim)' : 'transparent', color: form.condition === c ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div><label style={labelStyle}>Location</label><input style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
      <div>
        <label style={labelStyle}>Status</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {['active', 'paused', 'sold'].map(s => (
            <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
              style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${form.status === s ? 'var(--gold)' : 'var(--border)'}`, background: form.status === s ? 'var(--gold-dim)' : 'transparent', color: form.status === s ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, color: 'var(--black)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}