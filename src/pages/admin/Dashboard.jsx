import { useEffect, useState } from 'react';
import { fetchOrders, fetchUsers } from '../../api/admin';
import RevenueChart from '../../components/admin/RevenueChart';
import { computeDashboardStats, formatCurrency } from '../../utils/dashboardStats';

const STAT_CARDS = [
  { key: 'totalOrders', label: 'คำสั่งซื้อทั้งหมด', description: 'รายการสะสมในระบบ', iconClass: 'stat-icon-blue' },
  { key: 'totalRevenue', label: 'รายได้รวม', description: 'ยอดขายที่บันทึกแล้ว', iconClass: 'stat-icon-green', format: formatCurrency },
  { key: 'pendingCount', label: 'รอดำเนินการ', description: 'รายการที่ต้องตรวจสอบ', iconClass: 'stat-icon-yellow' },
  { key: 'customerCount', label: 'ลูกค้าทั้งหมด', description: 'สมาชิกประเภทลูกค้า', iconClass: 'stat-icon-purple' },
];

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [orders, users] = await Promise.all([
          fetchOrders(),
          fetchUsers(),
        ]);

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

  const goToReports = () => {
    if (onNavigate) {
      onNavigate('/admin/reports');
    }
  };

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <p>ภาพรวมธุรกิจวันนี้</p>
          <h2>ข้อมูลสำคัญในที่เดียว</h2>
          <span>ติดตามยอดขาย คำสั่งซื้อ และการเติบโตของลูกค้าได้อย่างรวดเร็ว</span>
        </div>
        <div className="dashboard-welcome-right">
          <div className="dashboard-welcome-status">
            <i />
            <span>ข้อมูลอัปเดตล่าสุด</span>
            <strong>{new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</strong>
          </div>
        </div>
      </section>

      {/* Summary Stats Cards */}
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
              <p className="stat-trend">{card.description}</p>
            </article>
          );
        })}
      </section>

      {/* Reports Section (ส่วนรายงาน) */}
      <section className="admin-panel dashboard-reports-panel">
        <div className="dashboard-panel-heading">
          <div>
            <span>ศูนย์รายงานและสถิติ</span>
            <h2>รายงาน (Reports)</h2>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={goToReports}
          >
            📊 ไปหน้ารายงาน →
          </button>
        </div>
      </section>

      {/* Revenue Trend Chart */}
      <section className="admin-panel dashboard-chart-panel">
        <div className="dashboard-panel-heading">
          <div><span>แนวโน้มรายได้</span><h2>รายได้ตามเดือนในปีนี้</h2></div>
          <strong>12 เดือนล่าสุด</strong>
        </div>
        <RevenueChart data={stats.monthlyRevenue} />
      </section>

      {/* Latest Orders Table */}
      <section className="admin-panel dashboard-orders-panel">
        <div className="dashboard-panel-heading">
          <div><span>รายการล่าสุด</span><h2>คำสั่งซื้อล่าสุด</h2></div>
          <strong>{stats.latestOrders.length} รายการ</strong>
        </div>
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
    </div>
  );
}
