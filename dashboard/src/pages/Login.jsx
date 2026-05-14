import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/auth';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      const allowedRoles = ['superadmin', 'moderator', 'staff', 'user'];
      if (!allowedRoles.includes(data.user.role) && data.user.role === 'banned') {
        toast.error('Account suspended');
        return;
      }
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.username}`);
      const role = data.user.role;
      if (role === 'superadmin' || role === 'moderator' || role === 'staff') {
        navigate('/overview');
      } else {
        navigate('/seller');
      }
    } catch (err) {
      toast.error(err.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', letterSpacing: -1, marginBottom: 4 }}>
            al<span style={{ color: 'var(--text-primary)' }}>sel</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>dashboard</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            management console v1.0
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--gold-border)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
            <input
              type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--gold-border)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: 'var(--gold)', color: 'var(--black)', border: 'none', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s' }}>
            {loading ? 'Authenticating...' : 'Sign in to dashboard'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Alsel Management Console · Restricted access
        </div>
      </div>
    </div>
  );
}