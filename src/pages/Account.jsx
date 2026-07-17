import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Account() {
  const { user, updateProfile, changePassword, logout, tokenExpiryDate } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [expiry, setExpiry] = useState(null);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', email: user.email || '' });
    tokenExpiryDate().then(setExpiry);
  }, [user, tokenExpiryDate]);

  const saveProfile = async () => {
    await updateProfile(profile);
    showToast('Profile updated');
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.next !== pw.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      showToast('Password changed');
    } catch (err) {
      setPwError(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div>
      <h1 className="page-title">Account</h1>
      <p className="page-subtitle">Manage your profile and session.</p>

      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Profile</h2><p className="card-desc">Username: <strong>{user?.username}</strong></p></div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Full name</label>
            <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
          </div>
        </div>
        <div className="btn-row">
          <button className="action-btn btn-save" onClick={saveProfile}>Save profile</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Change Password</h2></div>
        </div>
        {pwError && <div className="auth-error">{pwError}</div>}
        <form onSubmit={submitPasswordChange}>
          <div className="form-group">
            <label>Current password</label>
            <input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>New password</label>
              <input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
          </div>
          <div className="btn-row">
            <button className="action-btn btn-save">Update password</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Session</h2><p className="card-desc">Your sign-in stays valid for 7 days on this device.</p></div>
        </div>
        <div className="view-detail-row">
          <span className="view-detail-label">Session expires</span>
          <span className="view-detail-value">{expiry ? expiry.toLocaleString() : '—'}</span>
        </div>
        <div className="btn-row">
          <button className="action-btn btn-danger" onClick={handleLogout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
