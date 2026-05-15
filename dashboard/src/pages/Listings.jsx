import { useEffect, useState, useCallback } from 'react';
import { Search, Trash2, Star } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import Pagination from '../components/Pagination';
import PromptModal from '../components/PromptModal';
import toast from 'react-hot-toast';

export default function Listings() {
  const [data, setData] = useState({ listings: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ search: '', category: '', status: '', sort: 'newest', page: 1 });
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
      const res = await api.get(`/admin/listings?${params}`);
      setData(res);
    } catch { toast.error('Failed to load listings'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (values) => {
    try {
      await api.patch(`/admin/listings/${removeTarget.id}/remove`, { reason: values.reason });
      toast.success('Listing removed');
      setRemoveTarget(null);
      load();
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const handleFeature = async (id, current) => {
    try {
      await api.patch(`/admin/listings/${id}/feature`, { featured: !current });
      toast.success(current ? 'Listing unfeatured' : 'Listing featured');
      load();
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const statusColor = (s) => {
    if (s === 'active') return { bg: 'var(--green-dim)', color: 'var(--green)' };
    if (s === 'sold') return { bg: 'var(--blue-dim)', color: 'var(--blue)' };
    if (s === 'removed') return { bg: 'var(--red-dim)', color: 'var(--red)' };
    return { bg: 'var(--surface3)', color: 'var(--text-muted)' };
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Listings</h1>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{data.total.toLocaleString()} total listings</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', height: 38 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
            placeholder="Search listings..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
        </div>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', height: 38, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="removed">Removed</option>
          <option value="paused">Paused</option>
        </select>
        <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value, page: 1 }))}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0 12px', height: 38, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
          <option value="">All categories</option>
          {['electronics','fashion','cars','property','home','hobbies','books','sports'].map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Listing', 'Seller', 'Price', 'Category', 'Status', 'Offers', 'Reports', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</td></tr>
              ) : data.listings.map(l => {
                const sc = statusColor(l.status);
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px', maxWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.is_featured && <span style={{ color: 'var(--gold)', marginRight: 6, fontSize: 11 }}>★</span>}
                        {l.title}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{l.seller}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>UGX {Number(l.price).toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{l.category}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontFamily: 'var(--font-mono)' }}>{l.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{l.offer_count}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: Number(l.report_count) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{l.report_count}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{format(new Date(l.created_at), 'MMM d, yyyy')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleFeature(l.id, l.is_featured)}
                          style={{ background: l.is_featured ? 'var(--gold-dim)' : 'var(--surface3)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: l.is_featured ? 'var(--gold)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <Star size={11} /> {l.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                        {l.status !== 'removed' && (
                          <button onClick={() => setRemoveTarget({ id: l.id, title: l.title })}
                            style={{ background: 'var(--red-dim)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <Trash2 size={11} /> Remove
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
        <Pagination page={filters.page} pages={data.pages} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
      </div>
      {removeTarget && (
        <PromptModal
          title={`Remove "${removeTarget.title}"`}
          fields={[
            { key: 'reason', label: 'Reason for removal', type: 'text', required: true, placeholder: 'e.g. Violates terms of service' },
          ]}
          onConfirm={handleRemove}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}