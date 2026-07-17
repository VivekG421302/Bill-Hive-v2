import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="page-title">Welcome{user?.name ? `, ${user.name}` : ''} 👋</h1>
      <p className="page-subtitle">This is your Bill Hive shell — sidebar, theming, storage, and auth are all wired up and ready to build on.</p>

      <div className="form-grid">
        <Link to="/your-data" className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title">Your Data</h2>
          <p className="card-desc">Set up your company profile and logo.</p>
        </Link>
        <Link to="/settings" className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title">Settings</h2>
          <p className="card-desc">Theme, accent colour, menu position, backups.</p>
        </Link>
        <Link to="/account" className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title">Account</h2>
          <p className="card-desc">Profile, password, and session details.</p>
        </Link>
      </div>
    </div>
  );
}
