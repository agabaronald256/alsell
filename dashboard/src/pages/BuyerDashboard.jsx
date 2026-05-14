import { useEffect, useState } from 'react';
import { ShoppingBag, Heart, Gavel, Star } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import toast from 'react-hot-toast';

export default function BuyerDashboard() {
  const [overview, setOverview] = useState(null);
  const [offers, setOffers] = useState([]);
  const [bids, setBids] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [activeTab, setActiveTab] = useState('offers');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          api.get('/buyer/overview'),
          api.get('/buyer/offers'),
          api.get('/buyer/bids'),
          api.get('/buyer/favourites'),
        ]);

        const [ov, of, bd, fv] = results;

        if (ov.status === 'fulfilled') setOverview(ov.value);
        else console.error('Overview failed:', ov.reason);

        if (of.status === 'fulfilled') setOffers(of.value);
        else console.error('Offers failed:', of.reason);

        if (bd.status === 'fulfilled') setBids(bd.value);
        else console.error('Bids failed:', bd.reason);

        if (fv.status === 'fulfilled') setFavourites(fv.value);
        else console.error('Favourites failed:', fv.reason);

      } catch (err) {
        toast.error('Failed to load dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>;

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Buyer Dashboard</h1>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Your buying activity and saved items</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Offers made" value={overview?.offers?.total} sub={`${overview?.offers?.pending} pending`} icon={ShoppingBag} color="var(--blue)" />
        <StatCard label="Saved listings" value={overview?.favourites?.total} icon={Heart} color="var(--red)" />
        <StatCard label="Auction bids" value={overview?.bids?.total} sub={`${overview?.bids?.active_auctions} active`} icon={Gavel} color="var(--gold)" />
        <StatCard label="Reviews given" value={overview?.reviews?.total} icon={Star} color="var(--green)" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['offers', 'bids', 'favourites'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${activeTab === t ? 'var(--gold-border)' : 'var(--border)'}`, background: activeTab === t ? 'var(--gold-dim)' : 'transparent', color: activeTab === t ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: activeTab === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {activeTab === 'offers' && (
          offers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No offers made yet</div>
          ) : offers.map(o => (
            <div key={o.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              {o.listing_photos?.[0] && <img src={o.listing_photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.listing_title}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>UGX {Number(o.amount).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>from {o.seller_name} {o.seller_verified ? '✓' : ''} · {format(new Date(o.created_at), 'MMM d')}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: o.status === 'accepted' ? 'var(--green-dim)' : o.status === 'declined' ? 'var(--red-dim)' : 'var(--gold-dim)', color: o.status === 'accepted' ? 'var(--green)' : o.status === 'declined' ? 'var(--red)' : 'var(--gold)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{o.status}</span>
            </div>
          ))
        )}
        {activeTab === 'bids' && (
          bids.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No bids placed yet</div>
          ) : bids.map(b => (
            <div key={b.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              {b.listing_photos?.[0] && <img src={b.listing_photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.listing_title}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>My bid: UGX {Number(b.amount).toLocaleString()}</div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Current: UGX {Number(b.current_price).toLocaleString()}</div>
                </div>
                {b.is_winning && <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>👑 Winning bid</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: b.auction_status === 'active' ? 'var(--green-dim)' : 'var(--surface3)', color: b.auction_status === 'active' ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{b.auction_status}</span>
            </div>
          ))
        )}
        {activeTab === 'favourites' && (
          favourites.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No saved listings</div>
          ) : favourites.map(f => (
            <div key={f.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, border: f.price_dropped ? '1px solid rgba(61,214,140,0.15)' : 'none', background: f.price_dropped ? 'rgba(61,214,140,0.03)' : 'transparent' }}>
              {f.photos?.[0] && <img src={f.photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>UGX {Number(f.price).toLocaleString()}</div>
                  {f.price_dropped && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'var(--green-dim)', color: 'var(--green)' }}>↓ {f.drop_percentage}% drop</span>
                  )}
                </div>
                {f.price_dropped && <div style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>was UGX {Number(f.price_at_save).toLocaleString()}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {f.seller} · 📍 {f.location}</div>
              </div>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: f.status === 'active' ? 'var(--green-dim)' : 'var(--surface3)', color: f.status === 'active' ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}