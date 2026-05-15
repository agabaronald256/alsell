import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle, Shield } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import PromptModal from '../components/PromptModal';
import toast from 'react-hot-toast';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('listings');
  const [banOpen, setBanOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  useEffect(() => {
    api.get(`/admin/users/${id}`)
      .then(setData).catch(() => toast.error('User not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBan = async (values) => {
    try {
      await api.patch(`/admin/users/${id}/ban`, { reason: values.reason });
      toast.success('User banned');
      setBanOpen(false);
      navigate('/users');
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const handleVerify = async () => {
    try {
      await api.patch(`/admin/users/${id}/verify`);
      toast.success('User verified');
      setData(d => ({ ...d, user: { ...d.user, is_verified: true } }));
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const handleRoleChange = async (values) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: values.role });
      toast.success('Role updated');
      setRoleOpen(false);
      setData(d => ({ ...d, user: { ...d.user, role: values.role } }));
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>;
  if (!data) return <div style={{ padding: 32, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>User not found</div>;

  const { user, listings, offers, reviews, reports } = data;
  const tabs = ['listings', 'offers', 'reviews', 'reports'];

  return (
    <div style={{ padding: 28 }}>
      <button onClick={() => navigate('/users')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={14} /> Back to users
      </button>

      {/* User header */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
              {user.username?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{user.username}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{user.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--gold-dim)', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{user.role}</span>
                {user.is_verified && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--green-dim)', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>✓ Verified</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!user.is_verified && (
              <button onClick={handleVerify} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--green-dim)', border: '1px solid rgba(61,214,140,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--green)', cursor: 'pointer' }}>
                <CheckCircle size={12} /> Verify
              </button>
            )}
            <button onClick={() => setRoleOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--blue-dim)', border: '1px solid rgba(75,159,255,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }}>
              <Shield size={12} /> Change role
            </button>
            {user.role !== 'banned' && user.role !== 'superadmin' && (
              <button onClick={() => setBanOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--red-dim)', border: '1px solid rgba(224,80,80,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--red)', cursor: 'pointer' }}>
                <Ban size={12} /> Ban user
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Listings', value: listings.length },
            { label: 'Offers made', value: offers.length },
            { label: 'Reviews', value: reviews.length },
            { label: 'Reports', value: reports.length, warn: reports.length > 0 },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.warn ? 'var(--red)' : 'var(--text-primary)' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          Joined {format(new Date(user.created_at), 'MMMM d, yyyy')}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${activeTab === t ? 'var(--gold-border)' : 'var(--border)'}`, background: activeTab === t ? 'var(--gold-dim)' : 'transparent', color: activeTab === t ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: activeTab === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'var(--font-sans)' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {activeTab === 'listings' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Title', 'Price', 'Category', 'Status', 'Created'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>{l.title}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>UGX {Number(l.price).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{l.category}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: l.status === 'active' ? 'var(--green-dim)' : 'var(--surface3)', color: l.status === 'active' ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{l.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{format(new Date(l.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {activeTab === 'reviews' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviews.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No reviews yet</div> :
              reviews.map(r => (
                <div key={r.id} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--gold)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.comment || 'No comment'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>by {r.reviewer_name}</div>
                </div>
              ))
            }
          </div>
        )}
        {activeTab === 'reports' && (
          <div style={{ padding: 16 }}>
            {reports.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No reports</div> :
              reports.map(r => (
                <div key={r.id} style={{ padding: '12px 14px', background: 'var(--red-dim)', border: '1px solid rgba(224,80,80,0.15)', borderRadius: 9, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>{r.reason}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.details || 'No details provided'}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 4 }}>{format(new Date(r.created_at), 'MMM d, yyyy')}</div>
                </div>
              ))
            }
          </div>
        )}
        {activeTab === 'offers' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Amount', 'Status', 'Date'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>UGX {Number(o.amount).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: o.status === 'accepted' ? 'var(--green-dim)' : o.status === 'declined' ? 'var(--red-dim)' : 'var(--surface3)', color: o.status === 'accepted' ? 'var(--green)' : o.status === 'declined' ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{o.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{format(new Date(o.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {banOpen && (
        <PromptModal
          title={`Ban ${data?.user?.username}`}
          fields={[
            { key: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'e.g. Fraudulent activity' },
          ]}
          onConfirm={handleBan}
          onClose={() => setBanOpen(false)}
        />
      )}
      {roleOpen && (
        <PromptModal
          title={`Change role — ${data?.user?.username}`}
          fields={[
            { key: 'role', label: 'New role', type: 'select', options: ['user', 'moderator', 'superadmin'] },
          ]}
          onConfirm={handleRoleChange}
          onClose={() => setRoleOpen(false)}
        />
      )}
    </div>
  );
}