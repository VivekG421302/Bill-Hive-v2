import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BrandIcon from '../components/BrandIcon';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { ready, hasAccount, user, register, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', confirm: '', name: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !hasAccount) setMode('register');
  }, [ready, hasAccount]);

  useEffect(() => {
    if (user) {
      const dest = location.state?.from || '/';
      navigate(dest, { replace: true });
    }
  }, [user, navigate, location]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password) {
      setError('Username and password are required.');
      return;
    }
    if (mode === 'register' && form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(form);
      } else {
        await login(form);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"><BrandIcon size={34} /></div>
        <h1 className="auth-title">Bill Hive</h1>
        <p className="auth-sub">
          {mode === 'register' ? 'Create your local account to get started' : 'Sign in to continue'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Username</label>
            <input value={form.username} onChange={update('username')} placeholder="e.g. vivek" autoFocus />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label>Full name (optional)</label>
              <input value={form.name} onChange={update('name')} placeholder="Your name" />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={update('password')} placeholder="••••••••" />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label>Confirm password</label>
              <input type="password" value={form.confirm} onChange={update('confirm')} placeholder="••••••••" />
            </div>
          )}

          <button className="action-btn btn-save" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {hasAccount && mode === 'register' && (
          <div className="auth-switch">
            <button type="button" onClick={() => { setMode('login'); setError(''); }}>Back to sign in</button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 18 }}>
          You'll stay signed in for 7 days on this device.
        </p>
      </div>
    </div>
  );
}
