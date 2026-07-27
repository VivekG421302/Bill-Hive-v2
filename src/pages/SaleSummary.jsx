import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/api';

const currency = (n, symbol = '₹') => `${symbol}${(parseFloat(n) || 0).toFixed(2)}`;

export default function SaleSummary() {
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [settings, setSettings] = useState({ currencySymbol: '₹' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([apiGet('bills'), apiGet('returns'), apiGet('items'), apiGet('settings')]).then(([b, r, it, s]) => {
      setBills(Array.isArray(b) ? b : []);
      setReturns(Array.isArray(r) ? r : []);
      setCatalogItems(Array.isArray(it) ? it : []);
      if (s) setSettings((prev) => ({ ...prev, ...s }));
      setLoaded(true);
    });
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0, week = 0, month = 0, allTime = 0;
    let todayReturns = 0, monthReturns = 0;

    bills.forEach((b) => {
      const created = new Date(b.createdAt || b.invoiceDate);
      allTime += b.grandTotal;
      if (created >= startOfDay) today += b.grandTotal;
      if (created >= startOfWeek) week += b.grandTotal;
      if (created >= startOfMonth) month += b.grandTotal;
    });

    returns.forEach((r) => {
      const created = new Date(r.date || r.createdAt);
      const amt = r.refundAmount || 0;
      if (created >= startOfDay) todayReturns += amt;
      if (created >= startOfMonth) monthReturns += amt;
    });

    const totalReturns = returns.reduce((s, r) => s + (r.refundAmount || 0), 0);

    return {
      today, week, month, allTime, billCount: bills.length, totalReturns,
      netToday: today - todayReturns, netMonth: month - monthReturns
    };
  }, [bills, returns]);

  const brandBreakdown = useMemo(() => {
    const brandSales = {};
    let total = 0;
    bills.forEach((b) => {
      (b.lineItems || []).forEach((item) => {
        const catalogItem = catalogItems.find((i) => i.name === item.name);
        const brand = (catalogItem && catalogItem.brand) ? catalogItem.brand : 'Unbranded';
        const amt = item.total || 0;
        brandSales[brand] = (brandSales[brand] || 0) + amt;
        total += amt;
      });
    });
    return { entries: Object.entries(brandSales).sort((a, b) => b[1] - a[1]), total };
  }, [bills, catalogItems]);

  const topItems = useMemo(() => {
    const tally = {};
    bills.forEach((b) => {
      (b.lineItems || []).forEach((item) => {
        const key = item.name || 'Unnamed';
        if (!tally[key]) tally[key] = { qty: 0, amount: 0 };
        tally[key].qty += parseFloat(item.qty) || 0;
        tally[key].amount += item.total || 0;
      });
    });
    const top = Object.entries(tally).sort((a, b) => b[1].amount - a[1].amount).slice(0, 8);
    const max = top.length ? top[0][1].amount : 1;
    return { top, max };
  }, [bills]);

  const symbol = settings.currencySymbol;

  const cards = [
    { label: "Today's Sales", value: currency(stats.today, symbol) },
    { label: 'Net Sales Today', value: currency(stats.netToday, symbol), highlight: true },
    { label: 'This Week', value: currency(stats.week, symbol) },
    { label: 'This Month', value: currency(stats.month, symbol) },
    { label: 'Net Sales Monthly', value: currency(stats.netMonth, symbol), highlight: true },
    { label: 'All-Time Sales', value: currency(stats.allTime, symbol) },
    { label: 'Total Bills', value: stats.billCount },
    { label: 'Total Refunded', value: currency(stats.totalReturns, symbol) }
  ];

  return (
    <div>
      <h1 className="page-title">Sale Summary</h1>
      <p className="page-subtitle">View your sales analytics.</p>

      {!loaded ? null : bills.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconChart size={40} />
            <p className="empty-state-text">No sales data yet. Numbers will show up here once you save your first bill.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {cards.map((c) => (
              <div key={c.label} className={`stat-card${c.highlight ? ' stat-card-highlight' : ''}`}>
                <span className="stat-label">{c.label}</span>
                <span className="stat-value">{c.value}</span>
              </div>
            ))}
          </div>

          <div className="summary-cards-grid">
            <div className="bill-section">
              <div className="section-header"><IconBrand /><h2>Sales by Brand</h2></div>
              {brandBreakdown.entries.length === 0 ? (
                <p className="empty-state-text" style={{ margin: 0 }}>No brand sales data yet.</p>
              ) : (
                brandBreakdown.entries.map(([brand, amt]) => {
                  const pct = brandBreakdown.total > 0 ? ((amt / brandBreakdown.total) * 100).toFixed(1) : 0;
                  return (
                    <div key={brand} className="top-item-row">
                      <div className="top-item-info">
                        <span className="top-item-name">{brand}</span>
                        <span className="top-item-meta">{currency(amt, symbol)} · {pct}%</span>
                      </div>
                      <div className="top-item-bar-track"><div className="top-item-bar top-item-bar-brand" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bill-section">
              <div className="section-header"><IconBox /><h2>Top Selling Items</h2></div>
              {topItems.top.length === 0 ? (
                <p className="empty-state-text" style={{ margin: 0 }}>No sales data yet.</p>
              ) : (
                topItems.top.map(([name, data]) => (
                  <div key={name} className="top-item-row">
                    <div className="top-item-info">
                      <span className="top-item-name">{name}</span>
                      <span className="top-item-meta">{data.qty} sold · {currency(data.amount, symbol)}</span>
                    </div>
                    <div className="top-item-bar-track"><div className="top-item-bar" style={{ width: `${(data.amount / topItems.max) * 100}%` }} /></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IconChart({ size = 22 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>); }
function IconBrand() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12.01V2h10.01l8.58 8.58a2 2 0 0 1 0 2.83z" strokeLinejoin="round" /><line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" /></svg>); }
function IconBox() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinejoin="round" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinejoin="round" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>); }
