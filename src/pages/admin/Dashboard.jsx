import { useEffect, useState } from 'react';
import { fetchOrders, fetchUsers } from '../../api/admin';
import RevenueChart from '../../components/admin/RevenueChart';
import { computeDashboardStats, formatCurrency } from '../../utils/dashboardStats';

const STAT_CARDS = [
  { key: 'totalOrders', label: 'คำสั่งซื้อ', iconClass: 'stat-icon-blue', trendType: 'up' },
  { key: 'totalRevenue', label: 'รายได้', iconClass: 'stat-icon-green', trendType: 'up', format: formatCurrency },
  { key: 'pendingCount', label: 'รอดำเนินการ', iconClass: 'stat-icon-yellow', trendType: 'warn' },
  { key: 'customerCount', label: 'ลูกค้า', iconClass: 'stat-icon-purple', trendType: 'up' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [orders, users] = await Promise.all([fetchOrders(), fetchUsers()]);
        setStats(computeDashboardStats(orders, users));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <div className="admin-loading">กำลังโหลดข้อมูล...</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <>
      <section className="stat-grid">
        {STAT_CARDS.map((card) => {
          const raw = stats[card.key];
          const value = card.format ? card.format(raw) : raw;

          return (
            <article key={card.key} className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">{card.label}</span>
                <span className={`stat-icon ${card.iconClass}`} />
              </div>
              <p className="stat-value">{value}</p>
              <p className={`stat-trend stat-trend-${card.trendType}`}>{card.trend}</p>
            </article>
          );
        })}
      </section>

      <section className="admin-panel">
        <h2>รายได้ตามเดือนในปีนี้</h2>
        <RevenueChart data={stats.monthlyRevenue} />
      </section>

      <section className="admin-panel">
        <h2>คำสั่งซื้อล่าสุด</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.latestOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    ยังไม่มีคำสั่งซื้อ
                  </td>
                </tr>
              ) : (
                stats.latestOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.amount}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>{order.statusLabel}</span>
                    </td>
                    <td>{order.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
