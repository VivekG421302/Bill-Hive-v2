import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dbGet } from '../db/indexedDB';

const currency = (n, symbol = '₹') => `${symbol}${(parseFloat(n) || 0).toFixed(2)}`;
const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

const QUICK_ACTIONS = [
  { to: '/create-bill', label: 'Create Bill', icon: IconCreateBill },
  { to: '/items', label: 'Add Item', icon: IconItems },
  { to: '/customers', label: 'Customers', icon: IconCustomers },
  { to: '/stock', label: 'Stock', icon: IconStock }
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ currencySymbol: '₹' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([dbGet('bills'), dbGet('items'), dbGet('settings')]).then(([b, it, se]) => {
      setBills(Array.isArray(b) ? b : []);
      setItems(Array.isArray(it) ? it : []);
      if (se) setSettings((prev) => ({ ...prev, ...se }));
      setLoaded(true);
    });
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let todaySales = 0;
    let todayBillCount = 0;
    let outstanding = 0;

    bills.forEach((b) => {
      const created = new Date(b.createdAt || b.invoiceDate);
      if (created >= startOfDay) { todaySales += b.grandTotal || 0; todayBillCount += 1; }
      outstanding += parseFloat(b.dueAmount) || 0;
    });

    const lowStock = items.filter((it) => it.trackStock !== false && (it.stock || 0) <= 5).length;
    const recentBills = [...bills].reverse().slice(0, 5);

    return { todaySales, todayBillCount, outstanding, lowStock, recentBills };
  }, [bills, items]);

  const hasAnyData = bills.length > 0 || items.length > 0;

  return (
    <div>
      <h1 className="page-title">Welcome{user?.name ? `, ${user.name}` : ''} 👋</h1>
      <p className="page-subtitle">Here's how things are looking today.</p>

      {!loaded ? null : !hasAnyData ? (
        <div className="card">
          <div className="empty-state">
            <IconHome size={40} />
            <p className="empty-state-text">Get started by adding your company details, a few items, and creating your first bill.</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="action-btn btn-save" onClick={() => navigate('/your-data')}>Set Up Company</button>
              <button className="action-btn btn-outline" onClick={() => navigate('/items')}>Add Items</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card stat-card-highlight">
              <span className="stat-label">Today's Sales</span>
              <span className="stat-value">{currency(stats.todaySales, settings.currencySymbol)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Bills Today</span>
              <span className="stat-value">{stats.todayBillCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Outstanding Dues</span>
              <span className="stat-value">{currency(stats.outstanding, settings.currencySymbol)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Low Stock Items</span>
              <span className="stat-value">{stats.lowStock}</span>
            </div>
          </div>

          <div className="dashboard-quick-actions">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.to} to={a.to} className="quick-action-card">
                <a.icon />
                <span>{a.label}</span>
              </Link>
            ))}
          </div>

          <div className="bill-section" style={{ marginTop: 18 }}>
            <div className="section-header"><IconClock /><h2>Recent Bills</h2></div>
            {stats.recentBills.length === 0 ? (
              <p className="empty-state-text" style={{ margin: 0 }}>No bills yet — <Link to="/create-bill">create your first one</Link>.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Amount</th></tr></thead>
                  <tbody>
                    {stats.recentBills.map((b) => (
                      <tr key={b.id} className="table-row-clickable" onClick={() => navigate('/past-bills')}>
                        <td className="cell-strong">{b.invoiceNo}</td>
                        <td className="cell-muted">{formatDate(b.invoiceDate)}</td>
                        <td>{b.customerName}</td>
                        <td>{currency(b.grandTotal, settings.currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {stats.lowStock > 0 && (
            <div className="dashboard-alert" onClick={() => navigate('/stock')}>
              <IconAlert />
              <span>{stats.lowStock} item{stats.lowStock !== 1 ? 's' : ''} running low on stock — tap to review.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IconHome({ size = 22 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
function IconClock() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>); }
function IconAlert() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>); }
function IconCreateBill() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>); }
function IconItems() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinejoin="round" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinejoin="round" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>); }
function IconCustomers() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>); }
function IconStock() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
