import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Ban, CheckCircle, Shield } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import PromptModal from '../components/PromptModal';
import toast from 'react-hot-toast';

export default function Users() {
  const [data, setData] = useState({ users: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ search: '', role: '', verified: '', sort: 'newest', page: 1 });
  const [loading, setLoading] = useState(true);
  const [banTarget, setBanTarget] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
      const res = await api.get(`/admin/users?${params}`);
      setData(res);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleBan = async (values) => {
    try {
      await api.patch(`/admin/users/${banTarget.userId}/ban`, { reason: values.reason, duration_days: values.duration_days ? Number(values.duration_days) : null });
      toast.success(`${banTarget.username} banned`);
      setBanTarget(null);
      load();
    } catch (err) { toast.error(err.error || 'Failed to ban user'); }
  };

  const handleVerify = async (userId, username) => {
    try {
      await api.patch(`/admin/users/${userId}/verify`);
      toast.success(`${username} verified`);
      load();
    } catch (err) { toast.error(err.error || 'Failed to verify'); }
  };

  const roleColor = (role) => {
    if (role === 'superadmin') return { bg: 'var(--gold-dim)', color: 'var(--gold)' };
    if (role === 'moderator') return { bg: 'var(--blue-dim)', color: 'var(--blue)' };
    if (role === 'banned') return { bg: 'var(--red-dim)', color: 'var(--red)' };
    return { bg: 'var(--surface3)', color: 'var(--text-muted)' };
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Users</h1>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{data.total.toLocaleString()} total users</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', height: 38 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
            placeholder="Search email or username..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
        </div>
        <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value, page: 1 }))}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', height: 38, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="superadmin">Super admin</option>
          <option value="banned">Banned</option>
        </select>
        <select value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value, page: 1 }))}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', height: 38, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most_listings">Most listings</option>
          <option value="highest_rated">Highest rated</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Role', 'Listings', 'Offers', 'Rating', 'Verified', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</td></tr>
              ) : data.users.map(u => {
                const rc = roleColor(u.role);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate(`/users/${u.id}`)}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{u.username}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: rc.bg, color: rc.color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{u.listing_count}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{u.offer_count}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
                      {u.rating_avg ? `★ ${Number(u.rating_avg).toFixed(1)}` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: u.is_verified ? 'var(--green)' : 'var(--text-muted)' }}>
                      {u.is_verified ? '✓ Yes' : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {format(new Date(u.created_at), 'MMM d, yyyy')}
                    </td>
                    <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!u.is_verified && (
                          <button onClick={() => handleVerify(u.id, u.username)}
                            style={{ background: 'var(--green-dim)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <CheckCircle size={11} /> Verify
                          </button>
                        )}
                        {u.role !== 'banned' && u.role !== 'superadmin' && (
                          <button onClick={() => setBanTarget({ userId: u.id, username: u.username })}
                            style={{ background: 'var(--red-dim)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <Ban size={11} /> Ban
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination page={filters.page} pages={data.pages} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
      </div>
      {banTarget && (
        <PromptModal
          title={`Ban ${banTarget.username}`}
          fields={[
            { key: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'e.g. Fraudulent activity' },
            { key: 'duration_days', label: 'Duration (days) — leave empty for permanent', type: 'number' },
          ]}
          onConfirm={handleBan}
          onClose={() => setBanTarget(null)}
        />
      )}
    </div>
  );
}