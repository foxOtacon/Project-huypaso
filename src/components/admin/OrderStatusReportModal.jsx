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

const STATUS_CONFIG = {
  pending: { label: 'รอชำระเงิน', color: 'yellow', badgeClass: 'status-pending' },
  paid: { label: 'ชำระเงินแล้ว', color: 'blue', badgeClass: 'status-paid' },
  preparing: { label: 'กำลังจัดเตรียมสินค้า', color: 'purple', badgeClass: 'status-preparing' },
  shipping: { label: 'กำลังจัดส่ง', color: 'teal', badgeClass: 'status-shipping' },
  completed: { label: 'สำเร็จแล้ว', color: 'green', badgeClass: 'status-completed' },
  cancelled: { label: 'ยกเลิก', color: 'red', badgeClass: 'status-cancelled' },
};

function formatOrderCode(orderId) {
  return `ORD${String(orderId).padStart(3, '0')}`;
}

export default function OrderStatusReportModal({ orders = [], users = [], orderItems = [], payments = [], onClose }) {
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Date range calculation
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

  // Compute processed orders and status breakdown
  const { statusStats, filteredOrders } = useMemo(() => {
    const userMap = new Map(users.map((u) => [Number(u.user_id), u]));
    const paymentMap = new Map(payments.map((p) => [Number(p.order_id), p]));

    // Map item counts per order
    const itemCounts = new Map();
    orderItems.forEach((item) => {
      const oId = Number(item.order_id);
      itemCounts.set(oId, (itemCounts.get(oId) || 0) + Number(item.quantity || 1));
    });

    // Map each order with precise status categorization
    const enrichedOrders = orders.map((o) => {
      const customer = userMap.get(Number(o.user_id));
      const payment = paymentMap.get(Number(o.order_id));

      let effectiveStatus = o.order_status;
      if (o.order_status === 'pending' && payment?.payment_status === 'approved') {
        effectiveStatus = 'paid';
      } else if (o.order_status === 'preparing') {
        effectiveStatus = 'preparing';
      }

      return {
        ...o,
        code: formatOrderCode(o.order_id),
        effectiveStatus,
        statusLabel: STATUS_CONFIG[effectiveStatus]?.label || getStatusLabelFallback(effectiveStatus),
        customerName: o.shipping_name || customer?.full_name || `ลูกค้า ${o.user_id}`,
        customerPhone: o.shipping_phone || customer?.phone || '-',
        itemCount: itemCounts.get(Number(o.order_id)) || 1,
        channel: 'ออนไลน์ (Web)',
        formattedDate: o.order_date ? new Date(o.order_date).toLocaleDateString('th-TH') : '-',
      };
    });

    // Filter by Date Range
    let dateFiltered = enrichedOrders;
    if (startDate) {
      dateFiltered = enrichedOrders.filter((o) => {
        const d = new Date(o.order_date);
        return d >= startDate && d <= endDate;
      });
    }

    // Calculate Breakdown per Status
    const stats = {
      pending: { count: 0, sum: 0 },
      paid: { count: 0, sum: 0 },
      preparing: { count: 0, sum: 0 },
      shipping: { count: 0, sum: 0 },
      completed: { count: 0, sum: 0 },
      cancelled: { count: 0, sum: 0 },
      totalCount: dateFiltered.length,
      totalSum: dateFiltered.reduce((total, o) => total + Number(o.total_amount || 0), 0),
    };

    dateFiltered.forEach((o) => {
      const key = stats[o.effectiveStatus] ? o.effectiveStatus : 'pending';
      stats[key].count += 1;
      stats[key].sum += Number(o.total_amount || 0);
    });

    // Apply Status & Search filters for table
    let tableRows = dateFiltered;
    if (statusFilter !== 'all') {
      tableRows = tableRows.filter((o) => o.effectiveStatus === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tableRows = tableRows.filter(
        (o) =>
          o.code.toLowerCase().includes(q) ||
          String(o.order_id).includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q)
      );
    }

    return { statusStats: stats, filteredOrders: tableRows };
  }, [orders, users, orderItems, payments, startDate, endDate, statusFilter, searchQuery]);

  const pagination = usePagination(filteredOrders, 8, [period, statusFilter, searchQuery, customStart, customEnd]);

  const handleExportCSV = () => {
    const headers = [
      'หมายเลขคำสั่งซื้อ',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'วันที่สั่งซื้อ',
      'สถานะคำสั่งซื้อ',
      'ช่องทาง',
      'จำนวนสินค้า (ชิ้น)',
      'ยอดรวม (฿)',
    ];

    const rows = filteredOrders.map((o) => [
      o.code,
      o.customerName,
      o.customerPhone,
      o.formattedDate,
      o.statusLabel,
      o.channel,
      o.itemCount,
      o.total_amount,
    ]);

    exportToCSV(`Order_Status_Report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="report-modal-header">
          <div>
            <span className="report-badge">📦 Order Status Report</span>
            <h2>รายงานสถานะคำสั่งซื้อ</h2>
            <p>สรุปจำนวนและยอดรวมคำสั่งซื้อแยกตามสถานะการดำเนินงาน</p>
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
              <span>สถานะคำสั่งซื้อ</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รอชำระเงิน</option>
                <option value="paid">ชำระเงินแล้ว</option>
                <option value="preparing">กำลังจัดเตรียมสินค้า</option>
                <option value="shipping">กำลังจัดส่ง</option>
                <option value="completed">สำเร็จแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </label>

            <label className="report-search-label">
              <span>ค้นหา</span>
              <input
                type="search"
                placeholder="ค้นหาออเดอร์, ชื่อลูกค้า..."
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

        {/* Status Breakdown KPI Cards (6 Cards) */}
        <section className="report-kpi-grid">
          <article className="report-kpi-card yellow">
            <span className="report-kpi-label">⏳ รอชำระเงิน</span>
            <strong className="report-kpi-value">{statusStats.pending.count} รายการ</strong>
            <span className="report-kpi-sub">{formatCurrency(statusStats.pending.sum)}</span>
          </article>

          <article className="report-kpi-card blue">
            <span className="report-kpi-label">💳 ชำระเงินแล้ว</span>
            <strong className="report-kpi-value">{statusStats.paid.count} รายการ</strong>
            <span className="report-kpi-sub">{formatCurrency(statusStats.paid.sum)}</span>
          </article>

          <article className="report-kpi-card purple">
            <span className="report-kpi-label">📦 กำลังจัดเตรียมสินค้า</span>
            <strong className="report-kpi-value">{statusStats.preparing.count} รายการ</strong>
            <span className="report-kpi-sub">{formatCurrency(statusStats.preparing.sum)}</span>
          </article>

          <article className="report-kpi-card teal">
            <span className="report-kpi-label">🚚 กำลังจัดส่ง</span>
            <strong className="report-kpi-value">{statusStats.shipping.count} รายการ</strong>
            <span className="report-kpi-sub">{formatCurrency(statusStats.shipping.sum)}</span>
          </article>

          <article className="report-kpi-card green">
            <span className="report-kpi-label">✅ สำเร็จแล้ว</span>
            <strong className="report-kpi-value">{statusStats.completed.count} รายการ</strong>
            <span className="report-kpi-sub">{formatCurrency(statusStats.completed.sum)}</span>
          </article>

          <article className="report-kpi-card red">
            <span className="report-kpi-label">❌ ยกเลิก</span>
            <strong className="report-kpi-value">{statusStats.cancelled.count} รายการ</strong>
            <span className="report-kpi-sub">{formatCurrency(statusStats.cancelled.sum)}</span>
          </article>
        </section>

        {/* Data Table */}
        <section className="report-table-section">
          <div className="report-table-header">
            <h3>ตารางรายการคำสั่งซื้อ ({filteredOrders.length} รายการ)</h3>
            <strong>ยอดรวม: {formatCurrency(filteredOrders.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0))}</strong>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table report-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>ลูกค้า</th>
                  <th>วันที่</th>
                  <th>ช่องทาง</th>
                  <th>จำนวนสินค้า</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      ไม่พบรายการคำสั่งซื้อตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  pagination.pageItems.map((o) => (
                    <tr key={o.order_id}>
                      <td>
                        <strong>{o.code}</strong>
                      </td>
                      <td>
                        <div>{o.customerName}</div>
                        <small className="text-muted">{o.customerPhone}</small>
                      </td>
                      <td>{o.formattedDate}</td>
                      <td>{o.channel}</td>
                      <td>{o.itemCount} ชิ้น</td>
                      <td>
                        <strong>{formatCurrency(o.total_amount)}</strong>
                      </td>
                      <td>
                        <span className={`status-badge status-${o.effectiveStatus}`}>
                          {o.statusLabel}
                        </span>
                      </td>
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

function getStatusLabelFallback(status) {
  const map = {
    pending: 'รอชำระเงิน',
    paid: 'ชำระเงินแล้ว',
    preparing: 'กำลังจัดเตรียมสินค้า',
    shipping: 'กำลังจัดส่ง',
    completed: 'สำเร็จแล้ว',
    cancelled: 'ยกเลิก',
  };
  return map[status] || status;
}
