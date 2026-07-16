const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATUS_LABELS = {
  pending: 'รอดำเนินการ',
  shipping: 'กำลังจัดส่ง',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
};

export function formatCurrency(amount) {
  return `฿${Number(amount || 0).toLocaleString('th-TH')}`;
}

export function formatThaiDate(date = new Date()) {
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function computeDashboardStats(orders, users) {
  const customers = users.filter((u) => u.role === 'customer');
  const revenueOrders = orders.filter((o) => o.order_status !== 'cancelled');
  const totalRevenue = revenueOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const pendingOrders = orders.filter((o) => o.order_status === 'pending');

  const currentYear = new Date().getFullYear();
  const monthlyRevenue = THAI_MONTHS.map((label, index) => {
    const total = revenueOrders
      .filter((o) => {
        const d = new Date(o.order_date);
        return d.getFullYear() === currentYear && d.getMonth() === index;
      })
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    return { label, value: total };
  });

  const userMap = Object.fromEntries(users.map((u) => [u.user_id, u.full_name]));

  const latestOrders = [...orders]
    .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
    .slice(0, 5)
    .map((o) => ({
      id: `#${String(o.order_id).padStart(3, '0')}`,
      customer: userMap[o.user_id] || `User ${o.user_id}`,
      amount: formatCurrency(o.total_amount),
      status: o.order_status,
      statusLabel: getStatusLabel(o.order_status),
      date: new Date(o.order_date).toLocaleDateString('th-TH'),
    }));

  return {
    totalOrders: orders.length,
    totalRevenue,
    pendingCount: pendingOrders.length,
    customerCount: customers.length,
    monthlyRevenue,
    latestOrders,
  };
}

export { THAI_MONTHS };
