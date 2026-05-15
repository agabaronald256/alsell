import { useState } from 'react';
import Modal from './Modal';

export default function PromptModal({ title, fields, onConfirm, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach(f => { init[f.key] = ''; });
    return init;
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const missing = fields.find(f => f.required && !values[f.key]);
    if (missing) return;
    setLoading(true);
    try {
      await onConfirm(values);
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {fields.map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</label>
            {f.type === 'select' ? (
              <select value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type || 'text'} value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder} required={f.required}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px' }}>
        <button onClick={onClose} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          style={{ flex: 2, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, color: 'var(--black)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Submitting...' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
