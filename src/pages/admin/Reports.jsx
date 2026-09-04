import { useEffect, useMemo, useState } from 'react';
import { fetchAdminPayments, fetchCategories, fetchOrderItems, fetchOrders, fetchProducts, fetchUsers } from '../../api/admin';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatCurrency, getStatusLabel } from '../../utils/dashboardStats';

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];


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

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active section tab ('all', 'sales', 'top-products', 'inventory', 'customer-behavior', 'order-status')
  const [activeTab, setActiveTab] = useState('all');

  // Sales report filter state
  const now = new Date();
  const [salesPeriod, setSalesPeriod] = useState('month'); // today, week, month, last-month, by-month, custom
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1 - 12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Inventory filter state
  const [stockStatusFilter, setStockStatusFilter] = useState('all'); // all, low, out, sufficient

  // Available years for Month-Year selector
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);

    orders.forEach((o) => {
      if (o.order_date) {
        const y = new Date(o.order_date).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [orders]);

  // Fetch real database API data
  useEffect(() => {
    async function loadReportData() {
      try {
        const [ordersData, usersData, productsData, itemsData, categoriesData, paymentsData] = await Promise.all([
          fetchOrders(),
          fetchUsers(),
          fetchProducts(),
          fetchOrderItems().catch(() => []),
          fetchCategories().catch(() => []),
          fetchAdminPayments().catch(() => []),
        ]);

        setOrders(ordersData || []);
        setUsers(usersData || []);
        setProducts(productsData || []);
        setOrderItems(itemsData || []);
        setCategories(categoriesData || []);
        setPayments(paymentsData || []);
      } catch (err) {
        setError(err.message || 'ไม่สามารถโหลดข้อมูลรายงานได้');
      } finally {
        setLoading(false);
      }
    }

    loadReportData();
  }, []);

  // Maps & lookup indexes
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [Number(c.category_id), c.category_name])),
    [categories]
  );

  const productMap = useMemo(
    () => new Map(products.map((p) => [Number(p.product_id), p])),
    [products]
  );

  const userMap = useMemo(
    () => new Map(users.map((u) => [Number(u.user_id), u])),
    [users]
  );

  // Filtered Sales Period Data Calculation
  const salesData = useMemo(() => {
    const validOrders = orders.filter((o) => o.order_status !== 'cancelled');
    const currentDate = new Date();

    // Date bounds calculation
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (salesPeriod === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (salesPeriod === 'week') {
      start.setDate(currentDate.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (salesPeriod === 'month') {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (salesPeriod === 'last-month') {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59, 999);
    } else if (salesPeriod === 'by-month') {
      const year = Number(selectedYear) || currentDate.getFullYear();
      const month = Number(selectedMonth) || currentDate.getMonth() + 1;
      start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      end = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (salesPeriod === 'custom') {
      if (customStart) {
        start = new Date(customStart + 'T00:00:00');
      } else {
        start.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        end = new Date(customEnd + 'T23:59:59');
      }
    }

    const filteredPeriodOrders = validOrders.filter((o) => {
      const d = new Date(o.order_date);
      return d >= start && d <= end;
    });

    // Date range display text
    let dateRangeText = '';
    if (salesPeriod === 'today') {
      dateRangeText = `วันนี้ (${currentDate.toLocaleDateString('th-TH')})`;
    } else if (salesPeriod === 'week') {
      dateRangeText = `7 วันที่ผ่านมา (${start.toLocaleDateString('th-TH')} - ${end.toLocaleDateString('th-TH')})`;
    } else if (salesPeriod === 'month') {
      dateRangeText = `เดือน${THAI_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`;
    } else if (salesPeriod === 'last-month') {
      const lm = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      dateRangeText = `เดือน${THAI_MONTHS[lm.getMonth()]} ${lm.getFullYear() + 543}`;
    } else if (salesPeriod === 'by-month') {
      dateRangeText = `เดือน${THAI_MONTHS[selectedMonth - 1]} พ.ศ. ${Number(selectedYear) + 543}`;
    } else if (salesPeriod === 'custom') {
      const sStr = customStart ? new Date(customStart).toLocaleDateString('th-TH') : 'เริ่มต้น';
      const eStr = customEnd ? new Date(customEnd).toLocaleDateString('th-TH') : 'ปัจจุบัน';
      dateRangeText = `ช่วงวันที่: ${sStr} ถึง ${eStr}`;
    }

    // Today, Week, Month totals
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(currentDate.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const salesToday = validOrders
      .filter((o) => new Date(o.order_date) >= todayStart)
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const salesWeek = validOrders
      .filter((o) => new Date(o.order_date) >= weekStart)
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const salesMonth = validOrders
      .filter((o) => new Date(o.order_date) >= monthStart)
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const periodRevenue = filteredPeriodOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const periodOrdersCount = filteredPeriodOrders.length;

    // Estimate profit margin (35% default estimated margin if cost is unspecified)
    const estimatedNetProfit = periodRevenue * 0.35;

    // Points for sales chart (e.g. 7 data points depending on span)
    const pointCount = 7;
    const timeSpan = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
    const stepDays = timeSpan / pointCount;

    const chartPoints = Array.from({ length: pointCount }, (_, i) => {
      const pStart = new Date(start);
      pStart.setDate(pStart.getDate() + Math.floor(i * stepDays));
      const pEnd = new Date(start);
      pEnd.setDate(pEnd.getDate() + Math.floor((i + 1) * stepDays));

      const val = validOrders
        .filter((o) => {
          const d = new Date(o.order_date);
          return d >= pStart && d < pEnd;
        })
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      return {
        label: pStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        revenue: val,
        profit: val * 0.35,
      };
    });

    const maxChartRevenue = Math.max(...chartPoints.map((p) => p.revenue), 1);

    return {
      salesToday,
      salesWeek,
      salesMonth,
      periodRevenue,
      periodOrdersCount,
      estimatedNetProfit,
      chartPoints,
      maxChartRevenue,
      filteredOrders: filteredPeriodOrders,
      dateRangeText,
    };
  }, [orders, salesPeriod, selectedMonth, selectedYear, customStart, customEnd]);


  // Top Selling Products Calculation
  const topProductsData = useMemo(() => {
    const productSalesMap = new Map();

    // Map order items to sales quantities and revenue
    orderItems.forEach((item) => {
      const pId = Number(item.product_id);
      const product = productMap.get(pId);
      const price = Number(item.price || product?.price || 0);
      const qty = Number(item.quantity || 1);
      const amount = price * qty;

      if (!productSalesMap.has(pId)) {
        productSalesMap.set(pId, {
          productId: pId,
          name: product?.product_name || `สินค้า #${pId}`,
          imageUrl: product?.image_url || '',
          category: categoryMap.get(Number(product?.category_id)) || 'อื่น ๆ',
          stock: Number(product?.stock_quantity || 0),
          unitsSold: 0,
          totalRevenue: 0,
        });
      }

      const existing = productSalesMap.get(pId);
      existing.unitsSold += qty;
      existing.totalRevenue += amount;
    });

    // Also include active products that have 0 sales so report is complete
    products.forEach((product) => {
      const pId = Number(product.product_id);
      if (!productSalesMap.has(pId)) {
        productSalesMap.set(pId, {
          productId: pId,
          name: product.product_name || `สินค้า #${pId}`,
          imageUrl: product.image_url || '',
          category: categoryMap.get(Number(product.category_id)) || 'อื่น ๆ',
          stock: Number(product.stock_quantity || 0),
          unitsSold: 0,
          totalRevenue: 0,
        });
      }
    });

    const list = [...productSalesMap.values()].sort((a, b) => b.unitsSold - a.unitsSold || b.totalRevenue - a.totalRevenue);
    const overallRevenueSum = list.reduce((sum, item) => sum + item.totalRevenue, 0);

    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      sharePercent: overallRevenueSum > 0 ? ((item.totalRevenue / overallRevenueSum) * 100).toFixed(1) : '0.0',
      needsReorder: item.stock <= 5,
    }));
  }, [orderItems, products, productMap, categoryMap]);

  // Inventory / Stock Report Data
  const inventoryData = useMemo(() => {
    const soldQuantityMap = new Map();
    orderItems.forEach((item) => {
      const pId = Number(item.product_id);
      const qty = Number(item.quantity || 1);
      soldQuantityMap.set(pId, (soldQuantityMap.get(pId) || 0) + qty);
    });

    const list = products.map((p) => {
      const pId = Number(p.product_id);
      const totalSold = soldQuantityMap.get(pId) || 0;

      const stock = Number(p.stock_quantity || 0);
      let status = 'sufficient';
      let statusLabel = '🟢 มีสินค้าเพียงพอ';

      if (stock === 0) {
        status = 'out';
        statusLabel = '🔴 สินค้าหมด (Out of Stock)';
      } else if (stock <= 5) {
        status = 'low';
        statusLabel = '🟡 สินค้าใกล้หมด (Low Stock)';
      }

      return {
        productId: p.product_id,
        sku: p.sku || `PROD-${String(p.product_id).padStart(4, '0')}`,
        name: p.product_name,
        category: categoryMap.get(Number(p.category_id)) || 'ทั่วไป',
        price: p.price,
        stock,
        totalSold,
        status,
        statusLabel,
      };
    });

    const lowStockList = list.filter((i) => i.status === 'low');
    const outOfStockList = list.filter((i) => i.status === 'out');

    let filtered = list;
    if (stockStatusFilter === 'low') filtered = list.filter((i) => i.status === 'low');
    else if (stockStatusFilter === 'out') filtered = list.filter((i) => i.status === 'out');
    else if (stockStatusFilter === 'sufficient') filtered = list.filter((i) => i.status === 'sufficient');

    return {
      all: list,
      filtered,
      lowCount: lowStockList.length,
      outCount: outOfStockList.length,
      totalCount: list.length,
      lowStockList,
      outOfStockList,
    };
  }, [products, orderItems, categoryMap, stockStatusFilter]);

  // Customer Behavior Analytics
  const customerBehaviorData = useMemo(() => {
    const customerUsers = users.filter((u) => u.role === 'customer' || !u.role);
    const validOrders = orders.filter((o) => o.order_status !== 'cancelled');

    const ordersByUser = new Map();
    validOrders.forEach((o) => {
      const uId = String(o.user_id);
      if (!ordersByUser.has(uId)) ordersByUser.set(uId, []);
      ordersByUser.get(uId).push(o);
    });

    const rows = customerUsers.map((u) => {
      const uId = String(u.user_id);
      const userOrders = ordersByUser.get(uId) || [];
      const isNew = userOrders.length <= 1;
      const totalSpend = userOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      return {
        userId: u.user_id,
        name: u.full_name || `ลูกค้า #${u.user_id}`,
        email: u.email || '-',
        phone: u.phone || '-',
        isNew,
        orderCount: userOrders.length,
        totalSpend,
        aov: userOrders.length > 0 ? totalSpend / userOrders.length : 0,
      };
    });

    const purchasingCustomers = rows.filter((r) => r.orderCount > 0);
    const newCustomersCount = rows.filter((r) => r.isNew).length;
    const returningCustomersCount = rows.filter((r) => !r.isNew).length;
    const repeatBuyersCount = rows.filter((r) => r.orderCount >= 2).length;

    const repeatRate =
      purchasingCustomers.length > 0
        ? ((repeatBuyersCount / purchasingCustomers.length) * 100).toFixed(1)
        : '0.0';

    const totalRev = validOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const overallAov = validOrders.length > 0 ? totalRev / validOrders.length : 0;

    const ordersFromNew = rows.filter((r) => r.isNew).reduce((sum, r) => sum + r.orderCount, 0);
    const ordersFromReturning = rows.filter((r) => !r.isNew).reduce((sum, r) => sum + r.orderCount, 0);

    return {
      rows,
      totalCustomers: customerUsers.length,
      newCustomersCount,
      returningCustomersCount,
      repeatBuyersCount,
      repeatRate,
      overallAov,
      ordersFromNew,
      ordersFromReturning,
    };
  }, [users, orders]);

  // Order Status Report & Delayed Orders Alert
  const orderStatusData = useMemo(() => {
    const paymentMap = new Map(payments.map((p) => [Number(p.order_id), p]));
    const now = new Date();

    const counts = {
      pending: { label: 'รอชำระเงิน', count: 0, sum: 0, badgeClass: 'status-pending' },
      paid: { label: 'ชำระเงินแล้ว', count: 0, sum: 0, badgeClass: 'status-paid' },
      preparing: { label: 'กำลังเตรียมสินค้า', count: 0, sum: 0, badgeClass: 'status-preparing' },
      shipping: { label: 'กำลังจัดส่ง', count: 0, sum: 0, badgeClass: 'status-shipping' },
      completed: { label: 'จัดส่งสำเร็จ', count: 0, sum: 0, badgeClass: 'status-completed' },
      cancelled: { label: 'ยกเลิก', count: 0, sum: 0, badgeClass: 'status-cancelled' },
    };

    const delayedShippingOrders = [];

    orders.forEach((o) => {
      const payment = paymentMap.get(Number(o.order_id));
      let effectiveStatus = o.order_status;

      if (o.order_status === 'pending' && payment?.payment_status === 'approved') {
        effectiveStatus = 'paid';
      }

      if (counts[effectiveStatus]) {
        counts[effectiveStatus].count += 1;
        counts[effectiveStatus].sum += Number(o.total_amount || 0);
      }

      // Check if order is in shipping status for > 3 days (delayed)
      if (effectiveStatus === 'shipping' && o.order_date) {
        const diffDays = (now - new Date(o.order_date)) / (1000 * 60 * 60 * 24);
        if (diffDays > 3) {
          const cust = userMap.get(Number(o.user_id));
          delayedShippingOrders.push({
            orderId: o.order_id,
            code: `ORD${String(o.order_id).padStart(3, '0')}`,
            customerName: o.shipping_name || cust?.full_name || `ลูกค้า ${o.user_id}`,
            date: new Date(o.order_date).toLocaleDateString('th-TH'),
            daysInShipping: Math.floor(diffDays),
            trackingCarrier: o.shipping_carrier || '-',
            trackingNumber: o.tracking_number || '-',
          });
        }
      }
    });

    return {
      counts,
      totalOrders: orders.length,
      delayedShippingOrders,
    };
  }, [orders, payments, userMap]);

  // Paginations for sub-tables
  const topProductsPagination = usePagination(topProductsData, 8);
  const inventoryPagination = usePagination(inventoryData.filtered, 8, [stockStatusFilter]);
  const customerPagination = usePagination(customerBehaviorData.rows, 8);

  // CSV Export Handlers
  const handleExportSalesReport = () => {
    const headers = ['วันที่', 'รายได้ประจำช่วง (บาท)', 'ประมาณการกำไร (บาท)'];
    const rows = salesData.chartPoints.map((p) => [p.label, p.revenue, Math.round(p.profit)]);
    exportToCSV(`Sales_Report_${salesPeriod}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const handleExportTopProductsReport = () => {
    const headers = ['อันดับ', 'ชื่อสินค้า', 'หมวดหมู่', 'จำนวนขายได้ (ชิ้น)', 'ยอดขายรวม (บาท)', 'สต็อกคงเหลือ', 'สัดส่วนยอดขาย (%)'];
    const rows = topProductsData.map((p) => [p.rank, p.name, p.category, p.unitsSold, p.totalRevenue, p.stock, p.sharePercent]);
    exportToCSV(`Top_Selling_Products_Report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const handleExportInventoryReport = () => {
    const headers = ['ลำดับ', 'ชื่อสินค้า', 'หมวดหมู่', 'สต็อกคงเหลือ', 'ขายแล้ว (ชิ้น)', 'สถานะสต็อก'];
    const rows = inventoryData.all.map((i, idx) => [idx + 1, i.name, i.category, i.stock, i.totalSold, i.statusLabel]);
    exportToCSV(`Inventory_Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  if (loading) {
    return <div className="admin-loading">กำลังโหลดข้อมูลรายงานระบบ...</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <div className="reports-page">
      {/* 1. TOP OVERVIEW SUMMARY HEADER */}
      <section className="reports-summary-hero">
        <article className="hero-kpi-card green">
          <div className="kpi-icon">💰</div>
          <div>
            <span>ยอดขายรวมทั้งหมด</span>
            <strong>{formatCurrency(salesData.periodRevenue)}</strong>
            <small>ยอดบันทึกในช่วงที่เลือก</small>
          </div>
        </article>

        <article className="hero-kpi-card blue">
          <div className="kpi-icon">📦</div>
          <div>
            <span>จำนวนออเดอร์</span>
            <strong>{salesData.periodOrdersCount} รายการ</strong>
            <small>คำสั่งซื้อทั้งหมด</small>
          </div>
        </article>

        <article className="hero-kpi-card purple">
          <div className="kpi-icon">👥</div>
          <div>
            <span>ลูกค้าในระบบ</span>
            <strong>{customerBehaviorData.totalCustomers} คน</strong>
            <small>ลูกค้าใหม่ {customerBehaviorData.newCustomersCount} คน</small>
          </div>
        </article>

        <article className="hero-kpi-card orange">
          <div className="kpi-icon">⚠️</div>
          <div>
            <span>สินค้าคงเหลือ</span>
            <strong>{inventoryData.totalCount} รายการ</strong>
            <small className={inventoryData.lowCount > 0 ? 'text-danger-bold' : ''}>
              เตือนใกล้หมด: {inventoryData.lowCount} รายการ
            </small>
          </div>
        </article>
      </section>

      {/* 2. REPORT NAVIGATION TABS */}
      <nav className="reports-tab-nav" aria-label="หมวดหมู่รายงาน">
        <button
          type="button"
          className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
         รายงานทั้งหมด
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          รายงานยอดขาย
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'top-products' ? 'active' : ''}`}
          onClick={() => setActiveTab('top-products')}
        >
          สินค้าขายดี
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          สินค้าคงเหลือ
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'customer-behavior' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer-behavior')}
        >
          พฤติกรรมลูกค้า
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'order-status' ? 'active' : ''}`}
          onClick={() => setActiveTab('order-status')}
        >
          สถานะคำสั่งซื้อ
        </button>
      </nav>

      {/* SECTION A: SALES REPORT (รายงานยอดขาย) */}
      {(activeTab === 'all' || activeTab === 'sales') && (
        <section className="admin-panel reports-section" id="sales-report">
          <div className="reports-section-header">
            <div>
              <span className="reports-subhead">Sales Report</span>
              <h2>รายงานยอดขายและรายได้</h2>
              {salesData.dateRangeText && (
                <span className="date-filter-summary">
                  📆 {salesData.dateRangeText}
                </span>
              )}
            </div>

            {/* Filter Period Buttons & Controls */}
            <div className="reports-sales-toolbar">
              <div className="period-btn-group">
                <button
                  type="button"
                  className={salesPeriod === 'today' ? 'active' : ''}
                  onClick={() => setSalesPeriod('today')}
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  className={salesPeriod === 'week' ? 'active' : ''}
                  onClick={() => setSalesPeriod('week')}
                >
                  7 วันที่ผ่านมา
                </button>
                <button
                  type="button"
                  className={salesPeriod === 'month' ? 'active' : ''}
                  onClick={() => setSalesPeriod('month')}
                >
                  เดือนนี้
                </button>
                <button
                  type="button"
                  className={salesPeriod === 'last-month' ? 'active' : ''}
                  onClick={() => setSalesPeriod('last-month')}
                >
                  เดือนที่ผ่านมา
                </button>
                <button
                  type="button"
                  className={salesPeriod === 'by-month' ? 'active' : ''}
                  onClick={() => setSalesPeriod('by-month')}
                >
                  📅 เลือกเดือน-ปี
                </button>
                <button
                  type="button"
                  className={salesPeriod === 'custom' ? 'active' : ''}
                  onClick={() => setSalesPeriod('custom')}
                >
                  🗓️ กรองช่วงวันที่
                </button>
              </div>

              {salesPeriod === 'by-month' && (
                <div className="month-year-inputs">
                  <label htmlFor="select-report-month">
                    <span>เดือน:</span>
                    <select
                      id="select-report-month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                      {THAI_MONTHS.map((m, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label htmlFor="select-report-year">
                    <span>ปี:</span>
                    <select
                      id="select-report-year"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          {y} (พ.ศ. {y + 543})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {salesPeriod === 'custom' && (
                <div className="custom-date-inputs">
                  <label htmlFor="report-custom-start">
                    <span>เริ่ม:</span>
                    <input
                      id="report-custom-start"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </label>
                  <span className="date-sep">ถึง</span>
                  <label htmlFor="report-custom-end">
                    <span>สิ้นสุด:</span>
                    <input
                      id="report-custom-end"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <button type="button" className="report-btn-export" onClick={handleExportSalesReport}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="sales-kpi-subgrid">
            <article className="sub-kpi">
              <span>ยอดขายประจำวัน (วันนี้)</span>
              <strong>{formatCurrency(salesData.salesToday)}</strong>
            </article>
            <article className="sub-kpi">
              <span>ยอดขายประจำสัปดาห์</span>
              <strong>{formatCurrency(salesData.salesWeek)}</strong>
            </article>
            <article className="sub-kpi">
              <span>ยอดขายประจำเดือน</span>
              <strong>{formatCurrency(salesData.salesMonth)}</strong>
            </article>
            <article className="sub-kpi highlight-green">
              <span>รายได้รวมตามช่วงเวลาที่เลือก</span>
              <strong>{formatCurrency(salesData.periodRevenue)}</strong>
              <small>{salesData.periodOrdersCount} คำสั่งซื้อ</small>
            </article>
            <article className="sub-kpi highlight-gold">
              <span>ประมาณการกำไรสุทธิ</span>
              <strong>{formatCurrency(salesData.estimatedNetProfit)}</strong>
              <small>ประมาณการกำไรขั้นต้น ~35%</small>
            </article>
          </div>

          {/* Revenue & Profit Visual Chart */}
          <div className="sales-chart-wrapper">
            <h3>แนวโน้มรายได้และประมาณการกำไรตามช่วงเวลา</h3>
            <div className="sales-bar-chart">
              {salesData.chartPoints.map((point, index) => {
                const maxVal = salesData.maxChartRevenue || 1;
                const heightPercent = (point.revenue / maxVal) * 100;

                return (
                  <div key={`${point.label}-${index}`} className="bar-column">
                    <div className="bar-val">{formatCurrency(point.revenue)}</div>
                    <div className="bar-container">
                      <div className="bar-fill revenue-bar" style={{ height: `${Math.max(8, heightPercent)}%` }} />
                    </div>
                    <span className="bar-label">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* SECTION B: TOP SELLING PRODUCTS REPORT (รายงานสินค้าขายดี) */}
      {(activeTab === 'all' || activeTab === 'top-products') && (
        <section className="admin-panel reports-section" id="top-selling">
          <div className="reports-section-header">
            <div>
              <span className="reports-subhead">Top-Selling Products</span>
              <h2>รายงานสินค้าขายดี</h2>
            </div>
            <button type="button" className="report-btn-export" onClick={handleExportTopProductsReport}>
              Export CSV
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table report-table">
              <thead>
                <tr>
                  <th>อันดับ</th>
                  <th>สินค้า</th>
                  <th>หมวดหมู่</th>
                  <th>จำนวนที่ขายได้</th>
                  <th>ยอดขายรวม</th>
                  <th>สินค้าคงเหลือ</th>
                  <th>สัดส่วนยอดขาย</th>
                  <th>คำแนะนำสต็อก</th>
                </tr>
              </thead>
              <tbody>
                {topProductsPagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-table-empty">
                      ยังไม่มีข้อมูลการขายสินค้า
                    </td>
                  </tr>
                ) : (
                  topProductsPagination.pageItems.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <span className={`rank-badge rank-${item.rank}`}>#{item.rank}</span>
                      </td>
                      <td>
                        <div className="table-product-cell">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="report-product-img" loading="lazy" decoding="async" />
                          ) : (
                            <div className="report-product-placeholder">📦</div>
                          )}
                          <div>
                            <strong>{item.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <strong>{item.unitsSold.toLocaleString('th-TH')}</strong> ชิ้น
                      </td>
                      <td>{formatCurrency(item.totalRevenue)}</td>
                      <td>
                        <span className={item.stock <= 5 ? 'text-danger-bold' : ''}>
                          {item.stock} ชิ้น
                        </span>
                      </td>
                      <td>
                        <div className="share-bar-cell">
                          <span>{item.sharePercent}%</span>
                          <div className="mini-progress-bar">
                            <div style={{ width: `${Math.min(100, Number(item.sharePercent))}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        {item.stock <= 0 ? (
                          <span className="status-badge status-cancelled">🔴 หมดสต็อก! สั่งเพิ่มด่วน</span>
                        ) : item.stock <= 5 ? (
                          <span className="status-badge status-pending">⚠️ ใกล้หมด แนะนำเพิ่มสต็อก</span>
                        ) : (
                          <span className="status-badge status-completed">🟢 เพียงพอ</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={topProductsPagination.page}
            totalPages={topProductsPagination.totalPages}
            onPageChange={topProductsPagination.setPage}
          />
        </section>
      )}

      {/* SECTION C: INVENTORY / STOCK REPORT (รายงานสินค้าคงเหลือ) */}
      {(activeTab === 'all' || activeTab === 'inventory') && (
        <section className="admin-panel reports-section" id="inventory-report">
          <div className="reports-section-header">
            <div>
              <span className="reports-subhead">Inventory & Stock Status</span>
              <h2>รายงานสินค้าคงเหลือและสถานะสต็อก</h2>
            </div>

            <div className="inventory-controls">
              <label>
                <span>กรองสถานะสต็อก:</span>
                <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)}>
                  <option value="all">สินค้าทั้งหมด ({inventoryData.totalCount})</option>
                  <option value="low">สินค้าใกล้หมด ({inventoryData.lowCount})</option>
                  <option value="out">สินค้าหมด ({inventoryData.outCount})</option>
                  <option value="sufficient">สินค้ามีเพียงพอ</option>
                </select>
              </label>

              <button type="button" className="report-btn-export" onClick={handleExportInventoryReport}>
                Export CSV
              </button>
            </div>
          </div>

          {/* LOW STOCK ALERT BANNER */}
          {(inventoryData.lowCount > 0 || inventoryData.outCount > 0) && (
            <div className="inventory-alert-banner" role="alert">
              <div className="alert-icon">⚠️</div>
              <div>
                <h4>การแจ้งเตือนสต็อกสินค้า!</h4>
                <p>
                  พบสินค้าหมดสต็อก <strong>{inventoryData.outCount}</strong> รายการ และสินค้าใกล้หมด (≤ 5 ชิ้น)
                  อีก <strong>{inventoryData.lowCount}</strong> รายการ กรุณาพิจารณาสั่งเติมสต็อก
                </p>
              </div>
            </div>
          )}

          <div className="admin-table-wrap">
            <table className="admin-table report-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ชื่อสินค้า</th>
                  <th>หมวดหมู่</th>
                  <th>ราคาขาย</th>
                  <th>สต็อกคงเหลือ</th>
                  <th>จำนวนที่ขายได้แล้ว</th>
                  <th>สถานะสต็อก</th>
                </tr>
              </thead>
              <tbody>
                {inventoryPagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      ไม่พบรายการสินค้าในสถานะที่เลือก
                    </td>
                  </tr>
                ) : (
                  inventoryPagination.pageItems.map((item, index) => (
                    <tr key={item.productId}>
                      <td>{(inventoryPagination.page - 1) * inventoryPagination.pageSize + index + 1}</td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{item.category}</td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>
                        <strong className={item.stock <= 5 ? 'text-danger-bold' : ''}>
                          {item.stock} ชิ้น
                        </strong>
                      </td>
                      <td>{item.totalSold} ชิ้น</td>
                      <td>
                        <span className={`status-badge ${item.status === 'out' ? 'status-cancelled' : item.status === 'low' ? 'status-pending' : 'status-completed'}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={inventoryPagination.page}
            totalPages={inventoryPagination.totalPages}
            onPageChange={inventoryPagination.setPage}
          />
        </section>
      )}

      {/* SECTION D: CUSTOMER BEHAVIOR REPORT (รายงานพฤติกรรมลูกค้า) */}
      {(activeTab === 'all' || activeTab === 'customer-behavior') && (
        <section className="admin-panel reports-section" id="customer-behavior-report">
          <div className="reports-section-header">
            <div>
              <span className="reports-subhead">Customer Analytics</span>
              <h2>รายงานพฤติกรรมลูกค้า</h2>
            </div>
          </div>

          <div className="report-kpi-grid">
            <article className="report-kpi-card green">
              <span className="report-kpi-label">ลูกค้าใหม่</span>
              <strong className="report-kpi-value">{customerBehaviorData.newCustomersCount} คน</strong>
              <span className="report-kpi-sub">สั่งซื้อ 1 ครั้ง</span>
            </article>

            <article className="report-kpi-card blue">
              <span className="report-kpi-label">ลูกค้าเก่ากลับมาซื้อซ้ำ</span>
              <strong className="report-kpi-value">{customerBehaviorData.returningCustomersCount} คน</strong>
              <span className="report-kpi-sub">สั่งซื้อตั้งแต่ 2 ครั้งขึ้นไป</span>
            </article>

            <article className="report-kpi-card purple">
              <span className="report-kpi-label">อัตราการซื้อซ้ำ</span>
              <strong className="report-kpi-value">{customerBehaviorData.repeatRate}%</strong>
              <span className="report-kpi-sub">Repeat Purchase Rate</span>
            </article>

            <article className="report-kpi-card gold">
              <span className="report-kpi-label">ยอดซื้อเฉลี่ยต่อออเดอร์ (AOV)</span>
              <strong className="report-kpi-value">{formatCurrency(customerBehaviorData.overallAov)}</strong>
              <span className="report-kpi-sub">Average Order Value</span>
            </article>

            <article className="report-kpi-card teal">
              <span className="report-kpi-label">ออเดอร์จากลูกค้าใหม่</span>
              <strong className="report-kpi-value">{customerBehaviorData.ordersFromNew} ออเดอร์</strong>
              <span className="report-kpi-sub">คิดเป็นรายได้ใหม่</span>
            </article>

            <article className="report-kpi-card orange">
              <span className="report-kpi-label">ออเดอร์จากลูกค้าเก่า</span>
              <strong className="report-kpi-value">{customerBehaviorData.ordersFromReturning} ออเดอร์</strong>
              <span className="report-kpi-sub">ความภักดีต่อแบรนด์</span>
            </article>
          </div>

          <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
            <table className="admin-table report-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>ช่องทางติดต่อ</th>
                  <th>ประเภท</th>
                  <th>จำนวนออเดอร์</th>
                  <th>ยอดซื้อรวม</th>
                  <th>ยอดซื้อเฉลี่ย/ออเดอร์ (AOV)</th>
                </tr>
              </thead>
              <tbody>
                {customerPagination.pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      ยังไม่มีข้อมูลลูกค้า
                    </td>
                  </tr>
                ) : (
                  customerPagination.pageItems.map((c, index) => (
                    <tr key={c.userId}>
                      <td>{(customerPagination.page - 1) * customerPagination.pageSize + index + 1}</td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <div>{c.email}</div>
                        <small className="text-muted">{c.phone}</small>
                      </td>
                      <td>
                        <span className={`report-tag ${c.isNew ? 'tag-new' : 'tag-returning'}`}>
                          {c.isNew ? 'ลูกค้าใหม่' : 'ลูกค้าเก่า'}
                        </span>
                      </td>
                      <td>
                        <strong>{c.orderCount}</strong> ออเดอร์
                      </td>
                      <td>{formatCurrency(c.totalSpend)}</td>
                      <td>{formatCurrency(c.aov)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={customerPagination.page}
            totalPages={customerPagination.totalPages}
            onPageChange={customerPagination.setPage}
          />
        </section>
      )}

      {/* SECTION E: ORDER STATUS REPORT (รายงานสถานะคำสั่งซื้อ) */}
      {(activeTab === 'all' || activeTab === 'order-status') && (
        <section className="admin-panel reports-section" id="order-status-report">
          <div className="reports-section-header">
            <div>
              <span className="reports-subhead">Order Status Breakdown</span>
              <h2>รายงานสถานะคำสั่งซื้อและการจัดส่ง</h2>
            </div>
          </div>

          {/* DELAYED SHIPPING ALERT BANNER */}
          {orderStatusData.delayedShippingOrders.length > 0 && (
            <div className="inventory-alert-banner warning" role="alert">
              <div className="alert-icon">🚚</div>
              <div>
                <h4>เตือนออเดอร์จัดส่งนานผิดปกติ (&gt; 3 วัน)!</h4>
                <p>
                  พบคำสั่งซื้ออยู่ในสถานะกำลังจัดส่งเกิน 3 วัน จำนวน{' '}
                  <strong>{orderStatusData.delayedShippingOrders.length}</strong> รายการ กรุณาตรวจสอบลิงก์ติดตามพัสดุ
                </p>
                <ul className="delayed-orders-list">
                  {orderStatusData.delayedShippingOrders.map((d) => (
                    <li key={d.orderId}>
                      <strong>{d.code}</strong> ({d.customerName}) - อยู่ในสถานะจัดส่งมาแล้ว {d.daysInShipping} วัน [{d.trackingCarrier}: {d.trackingNumber}]
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="report-kpi-grid">
            {Object.entries(orderStatusData.counts).map(([key, st]) => (
              <article key={key} className="report-kpi-card">
                <span className="report-kpi-label">{st.label}</span>
                <strong className="report-kpi-value">{st.count} รายการ</strong>
                <span className="report-kpi-sub">{formatCurrency(st.sum)}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
