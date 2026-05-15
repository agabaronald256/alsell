import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { CheckCircle, XCircle, ArrowUp } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import PromptModal from '../components/PromptModal';

export default function Reports() {
  const [data, setData] = useState({ reports: [], total: 0, pages: 1 });
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/reports?status=${status}&page=${page}`);
      setData(res);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (s) => {
    setStatus(s);
    setPage(1);
  };

  const resolve = async (id, action, note) => {
    try {
      await api.patch(`/admin/reports/${id}/resolve`, { action, note });
      toast.success(`Report ${action}`);
      load();
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Reports</h1>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{data.total} {status} reports</div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['pending', 'actioned', 'dismissed', 'escalated'].map(s => (
          <button key={s} onClick={() => handleStatusChange(s)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${status === s ? 'var(--gold-border)' : 'var(--border)'}`, background: status === s ? 'var(--gold-dim)' : 'transparent', color: status === s ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: status === s ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>
        ) : data.reports.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            No {status} reports
          </div>
        ) : data.reports.map(r => (
          <div key={r.id} style={{ background: 'var(--surface)', border: `1px solid ${r.status === 'pending' ? 'rgba(224,80,80,0.2)' : 'var(--border)'}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>{r.reason}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>Reporter: <span style={{ color: 'var(--text-secondary)' }}>{r.reporter_name}</span></span>
                  {r.reported_name && <span>Reported: <span style={{ color: 'var(--text-secondary)' }}>{r.reported_name}</span></span>}
                  {r.listing_title && <span>Listing: <span style={{ color: 'var(--text-secondary)' }}>{r.listing_title}</span></span>}
                </div>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}
              </div>
            </div>
            {r.details && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>{r.details}</div>}
            {r.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setActionTarget(r)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--green-dim)', border: '1px solid rgba(61,214,140,0.2)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: 'var(--green)', cursor: 'pointer' }}>
                  <CheckCircle size={12} /> Action taken
                </button>
                <button onClick={() => resolve(r.id, 'dismissed')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <XCircle size={12} /> Dismiss
                </button>
                <button onClick={() => resolve(r.id, 'escalated')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--blue-dim)', border: '1px solid rgba(75,159,255,0.2)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }}>
                  <ArrowUp size={12} /> Escalate
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Pagination page={page} pages={data.pages} onPageChange={setPage} />
      {actionTarget && (
        <PromptModal
          title="Action taken"
          fields={[
            { key: 'note', label: 'Describe the action taken', type: 'text', required: true, placeholder: 'e.g. Listing removed, user warned' },
          ]}
          onConfirm={async (values) => {
            await resolve(actionTarget.id, 'actioned', values.note);
            setActionTarget(null);
          }}
          onClose={() => setActionTarget(null)}
        />
      )}
    </div>
  );
}