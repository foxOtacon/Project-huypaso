import { useMemo, useState } from 'react';
import Pagination from '../Pagination';
import usePagination from '../../hooks/usePagination';
import { formatCurrency } from '../../utils/dashboardStats';

function exportToCSV(filename, headers, rows) {
  const processRow = (row) =>
    row
      .map((val) => {
        let stringVal = val === null || val === undefined ? '' : String(val);
        stringVal = stringVal.replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',');

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(processRow)].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function CustomerBehaviorReportModal({ orders = [], users = [], onClose }) {
  const [period, setPeriod] = useState('30d'); // 7d, 30d, 90d, all, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all'); // all, new, returning
  const [searchQuery, setSearchQuery] = useState('');

  // Determine date bounds
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = null;

    if (period === '7d') {
      start = new Date();
      start.setDate(end.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      start = new Date();
      start.setDate(end.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (period === '90d') {
      start = new Date();
      start.setDate(end.getDate() - 90);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'custom') {
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        end.setTime(new Date(customEnd).getTime());
        end.setHours(23, 59, 59, 999);
      }
    }

    return { startDate: start, endDate: end };
  }, [period, customStart, customEnd]);

  // Compute Customer Metrics & Detail Rows
  const { metrics, customerRows } = useMemo(() => {
    const validCustomers = users.filter((u) => u.role === 'customer' || !u.role);
    const validOrders = orders.filter((o) => o.order_status !== 'cancelled');

    // Group orders by user_id
    const ordersByUser = new Map();
    validOrders.forEach((order) => {
      const uId = String(order.user_id);
      if (!ordersByUser.has(uId)) {
        ordersByUser.set(uId, []);
      }
      ordersByUser.get(uId).push(order);
    });

    let periodOrders = validOrders;
    if (startDate) {
      periodOrders = validOrders.filter((o) => {
        const d = new Date(o.order_date);
        return d >= startDate && d <= endDate;
      });
    }

    // Build row data for each customer
    const rawRows = validCustomers.map((user) => {
      const uId = String(user.user_id);
      const userOrdersAll = ordersByUser.get(uId) || [];
      const userOrdersPeriod = startDate
        ? userOrdersAll.filter((o) => {
            const d = new Date(o.order_date);
            return d >= startDate && d <= endDate;
          })
        : userOrdersAll;

      const userCreatedAt = user.created_at ? new Date(user.created_at) : null;

      // Is customer new in this period?
      const isNew = startDate
        ? userCreatedAt && userCreatedAt >= startDate && userCreatedAt <= endDate
        : userOrdersAll.length <= 1;

      const totalSpendAll = userOrdersAll.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const totalSpendPeriod = userOrdersPeriod.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const orderCountPeriod = userOrdersPeriod.length;
      const orderCountAll = userOrdersAll.length;

      const sortedDates = [...userOrdersAll]
        .map((o) => new Date(o.order_date))
        .sort((a, b) => a - b);

      const firstOrderDate = sortedDates[0] || userCreatedAt;
      const lastOrderDate = sortedDates[sortedDates.length - 1] || null;

      return {
        userId: user.user_id,
        name: user.full_name || `ลูกค้า #${user.user_id}`,
        email: user.email || '-',
        phone: user.phone || '-',
        isNew,
        customerType: isNew ? 'ลูกค้าใหม่' : 'ลูกค้าเก่า (กลับมาซื้อซ้ำ)',
        orderCountPeriod,
        orderCountAll,
        totalSpendPeriod,
        totalSpendAll,
        aovPeriod: orderCountPeriod > 0 ? totalSpendPeriod / orderCountPeriod : 0,
        firstOrderDate: firstOrderDate ? firstOrderDate.toLocaleDateString('th-TH') : '-',
        lastOrderDate: lastOrderDate ? lastOrderDate.toLocaleDateString('th-TH') : '-',
        channel: 'ออนไลน์ (Web)',
      };
    });

    // Calculate Summary Metrics
    const purchasingCustomers = rawRows.filter((r) => r.orderCountPeriod > 0);
    const newCustomersCount = rawRows.filter((r) => r.isNew).length;
    const returningCustomersCount = purchasingCustomers.filter((r) => !r.isNew).length;
    const repeatCustomersCount = rawRows.filter((r) => r.orderCountAll >= 2).length;

    const totalPurchasingInSystem = rawRows.filter((r) => r.orderCountAll > 0).length;
    const repeatRate =
      totalPurchasingInSystem > 0
        ? ((repeatCustomersCount / totalPurchasingInSystem) * 100).toFixed(1)
        : '0.0';

    const totalPeriodRevenue = periodOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalPeriodOrderCount = periodOrders.length;
    const aovOverall =
      totalPeriodOrderCount > 0 ? (totalPeriodRevenue / totalPeriodOrderCount).toFixed(0) : 0;
    const avgOrdersPerCustomer =
      purchasingCustomers.length > 0
        ? (totalPeriodOrderCount / purchasingCustomers.length).toFixed(2)
        : '0.00';

    // Apply filters for the detailed table
    let filtered = rawRows;

    if (customerTypeFilter === 'new') {
      filtered = filtered.filter((r) => r.isNew);
    } else if (customerTypeFilter === 'returning') {
      filtered = filtered.filter((r) => !r.isNew);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          String(r.userId).includes(q)
      );
    }

    return {
      metrics: {
        newCustomersCount,
        returningCustomersCount,
        repeatCustomersCount,
        repeatRate,
        aovOverall,
        avgOrdersPerCustomer,
        totalPurchasingCount: purchasingCustomers.length,
      },
      customerRows: filtered,
    };
  }, [orders, users, startDate, endDate, customerTypeFilter, searchQuery]);

  const pagination = usePagination(customerRows, 8, [period, customerTypeFilter, searchQuery, customStart, customEnd]);

  const handleExportCSV = () => {
    const headers = [
      'ID ลูกค้า',
      'ชื่อ-นามสกุล',
      'อีเมล',
      'เบอร์โทรศัพท์',
      'ประเภทลูกค้า',
      'จำนวนคำสั่งซื้อ (ช่วงที่เลือก)',
      'ยอดซื้อรวม (฿)',
      'ยอดซื้อเฉลี่ย/ออเดอร์ (฿)',
      'สั่งซื้อครั้งแรก',
      'สั่งซื้อล่าสุด',
    ];

    const rows = customerRows.map((r) => [
      r.userId,
      r.name,
      r.email,
      r.phone,
      r.customerType,
      r.orderCountPeriod,
      r.totalSpendPeriod,
      Math.round(r.aovPeriod),
      r.firstOrderDate,
      r.lastOrderDate,
    ]);

    exportToCSV(`Customer_Behavior_Report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="report-modal-header">
          <div>
            <span className="report-badge">📊 Customer Behavior Report</span>
            <h2>รายงานพฤติกรรมลูกค้า</h2>
            <p>วิเคราะห์อัตราการซื้อซ้ำ ยอดซื้อเฉลี่ย และการเติบโตของฐานลูกค้า</p>
          </div>
          <button type="button" className="report-modal-close" onClick={onClose} aria-label="ปิด">
            ×
          </button>
        </header>

        {/* Filter Bar */}
        <section className="report-filter-panel">
          <div className="report-filter-group">
            <label>
              <span>ช่วงวันที่</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="7d">7 วันล่าสุด</option>
                <option value="30d">30 วันล่าสุด</option>
                <option value="90d">90 วันล่าสุด</option>
                <option value="all">ทั้งหมด</option>
                <option value="custom">กำหนดเอง</option>
              </select>
            </label>

            {period === 'custom' && (
              <div className="report-custom-dates">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span>ถึง</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}

            <label>
              <span>ประเภทลูกค้า</span>
              <select
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="new">ลูกค้าใหม่</option>
                <option value="returning">ลูกค้าเก่า / ซื้อซ้ำ</option>
              </select>
            </label>

            <label className="report-search-label">
              <span>ค้นหา</span>
              <input
                type="search"
                placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>

          <div className="report-actions">
            <button type="button" className="report-btn-export" onClick={handleExportCSV}>
              📥 Export CSV
            </button>
          </div>
        </section>

        {/* KPI Summary Grid (6 cards) */}
        <section className="report-kpi-grid">
          <article className="report-kpi-card green">
            <span className="report-kpi-label">ลูกค้าใหม่</span>
            <strong className="report-kpi-value">{metrics.newCustomersCount} คน</strong>
            <span className="report-kpi-sub">บัญชีใหม่ในช่วงเวลานี้</span>
          </article>

          <article className="report-kpi-card blue">
            <span className="report-kpi-label">ลูกค้าเก่ากลับมาซื้อซ้ำ</span>
            <strong className="report-kpi-value">{metrics.returningCustomersCount} คน</strong>
            <span className="report-kpi-sub">สั่งซื้อในรอบนี้</span>
          </article>

          <article className="report-kpi-card purple">
            <span className="report-kpi-label">จำนวนลูกค้าที่ซื้อซ้ำ</span>
            <strong className="report-kpi-value">{metrics.repeatCustomersCount} คน</strong>
            <span className="report-kpi-sub">ซื้อสะสม 2 ครั้งขึ้นไป</span>
          </article>

          <article className="report-kpi-card gold">
            <span className="report-kpi-label">อัตราการซื้อซ้ำ</span>
            <strong className="report-kpi-value">{metrics.repeatRate}%</strong>
            <span className="report-kpi-sub">Repeat Purchase Rate</span>
          </article>

          <article className="report-kpi-card teal">
            <span className="report-kpi-label">ยอดซื้อเฉลี่ยต่อคน (AOV)</span>
            <strong className="report-kpi-value">{formatCurrency(metrics.aovOverall)}</strong>
            <span className="report-kpi-sub">Average Order Value</span>
          </article>

          <article className="report-kpi-card orange">
            <span className="report-kpi-label">ออเดอร์เฉลี่ยต่อลูกค้า</span>
            <strong className="report-kpi-value">{metrics.avgOrdersPerCustomer} รายการ</strong>
            <span className="report-kpi-sub">คำสั่งซื้อ/คน</span>
          </article>
        </section>

        {/* Data Table */}
        <section className="report-table-section">
          <div className="report-table-header">
            <h3>ตารางข้อมูลพฤติกรรมลูกค้า ({customerRows.length} รายการ)</h3>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table report-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ชื่อลูกค้า</th>
                  <th>ช่องทางติดต่อ</th>
                  <th>ประเภท</th>
                  <th>จำนวนออเดอร์</th>
                  <th>ยอดซื้อรวม</th>
                  <th>ยอดเฉลี่ย/ออเดอร์</th>
                  <th>สั่งซื้อล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-table-empty">
                      ไม่พบข้อมูลลูกค้าตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  pagination.pageItems.map((c) => (
                    <tr key={c.userId}>
                      <td>#{c.userId}</td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <div>{c.email}</div>
                        <small className="text-muted">{c.phone}</small>
                      </td>
                      <td>
                        <span
                          className={`report-tag ${c.isNew ? 'tag-new' : 'tag-returning'}`}
                        >
                          {c.customerType}
                        </span>
                      </td>
                      <td>
                        <strong>{c.orderCountPeriod}</strong> ออเดอร์
                      </td>
                      <td>{formatCurrency(c.totalSpendPeriod)}</td>
                      <td>{formatCurrency(c.aovPeriod)}</td>
                      <td>{c.lastOrderDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
          />
        </section>

        <footer className="report-modal-footer">
          <button type="button" className="report-btn-close" onClick={onClose}>
            ปิดรายงาน
          </button>
        </footer>
      </div>
    </div>
  );
}
