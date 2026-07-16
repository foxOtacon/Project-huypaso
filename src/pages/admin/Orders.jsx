import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import {
  fetchOrderItems,
  fetchOrders,
  fetchProducts,
  fetchShippingCarriers,
  fetchUsers,
  updateOrder,
} from '../../api/admin';
import { formatCurrency, getStatusLabel } from '../../utils/dashboardStats';
import { getSafeTrackingUrl } from '../../utils/tracking';

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'shipping', label: 'กำลังจัดส่ง' },
  { value: 'completed', label: 'จัดส่งเรียบร้อยแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const EDITABLE_STATUSES = STATUS_OPTIONS.filter((status) => status.value !== 'all');

function formatOrderCode(orderId) {
  return `ORD${String(orderId).padStart(3, '0')}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  return new Date(dateValue).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function buildOrderRows(orders, users, orderItems, products) {
  const userMap = new Map(users.map((user) => [Number(user.user_id), user]));
  const productMap = new Map(products.map((product) => [Number(product.product_id), product]));

  const itemsByOrder = orderItems.reduce((grouped, item) => {
    const orderId = Number(item.order_id);
    const list = grouped.get(orderId) || [];
    list.push({
      ...item,
      product: productMap.get(Number(item.product_id)),
    });
    grouped.set(orderId, list);
    return grouped;
  }, new Map());

  return [...orders]
    .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
    .map((order) => {
      const customer = userMap.get(Number(order.user_id));
      const items = itemsByOrder.get(Number(order.order_id)) || [];

      return {
        ...order,
        code: formatOrderCode(order.order_id),
        customerName: order.shipping_name || customer?.full_name || `ลูกค้า ${order.user_id}`,
        customerPhone: order.shipping_phone || customer?.phone || '-',
        customerEmail: customer?.email || '-',
        shippingAddress: order.shipping_address || customer?.address || '-',
        items,
        itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      };
    });
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shippingCarriers, setShippingCarriers] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', customer: '', orderCode: '' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [trackingForm, setTrackingForm] = useState({
    tracking_number: '',
    shipping_carrier: '',
    tracking_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadOrders() {
      try {
        const [ordersData, usersData, orderItemsData, productsData, carrierData] = await Promise.all([
          fetchOrders(),
          fetchUsers(),
          fetchOrderItems(),
          fetchProducts(),
          fetchShippingCarriers(),
        ]);

        setOrders(ordersData);
        setUsers(usersData);
        setOrderItems(orderItemsData);
        setProducts(productsData);
        setShippingCarriers(carrierData.filter((carrier) => carrier.status !== 'inactive'));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  const rows = useMemo(
    () => buildOrderRows(orders, users, orderItems, products),
    [orders, users, orderItems, products],
  );

  const filteredRows = useMemo(() => {
    const customerQuery = normalizeText(filters.customer);
    const orderQuery = normalizeText(filters.orderCode);

    return rows.filter((order) => {
      const matchesStatus = filters.status === 'all' || order.order_status === filters.status;
      const matchesCustomer = !customerQuery || normalizeText(order.customerName).includes(customerQuery);
      const matchesOrder =
        !orderQuery ||
        normalizeText(order.code).includes(orderQuery) ||
        String(order.order_id).includes(orderQuery);

      return matchesStatus && matchesCustomer && matchesOrder;
    });
  }, [filters, rows]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((order) => order.order_status === 'pending').length,
      shipping: rows.filter((order) => order.order_status === 'shipping').length,
      completed: rows.filter((order) => order.order_status === 'completed').length,
    }),
    [rows],
  );

  const openOrder = (order) => {
    setSelectedOrder(order);
    setSelectedStatus(order.order_status);
    setTrackingForm({
      tracking_number: order.tracking_number || '',
      shipping_carrier: order.shipping_carrier || '',
      tracking_url: order.tracking_url || '',
    });
  };

  const closeOrder = () => {
    if (saving) return;
    setSelectedOrder(null);
  };

  const handleSaveStatus = async () => {
    if (!selectedOrder || selectedStatus === selectedOrder.order_status) {
      closeOrder();
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updated = await updateOrder(selectedOrder.order_id, {
        order_status: selectedStatus,
        tracking_number: trackingForm.tracking_number.trim(),
        shipping_carrier: trackingForm.shipping_carrier.trim(),
        tracking_url: trackingForm.tracking_url.trim(),
      });
      setOrders((current) =>
        current.map((order) => (order.order_id === updated.order_id ? updated : order)),
      );
      setSelectedOrder((current) => (current ? { ...current, ...updated } : current));
      setSelectedOrder(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pagination = usePagination(filteredRows, 10, [filters]);

  if (loading) {
    return <div className="admin-loading">กำลังโหลดคำสั่งซื้อ...</div>;
  }

  if (error && rows.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <>
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="orders-stat-grid">
        <article className="orders-stat-card">
          <span>คำสั่งซื้อทั้งหมด</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="orders-stat-card">
          <span>รอการชำระเงิน</span>
          <strong>{stats.pending}</strong>
        </article>
        <article className="orders-stat-card">
          <span>กำลังจัดส่ง</span>
          <strong>{stats.shipping}</strong>
        </article>
        <article className="orders-stat-card">
          <span>จัดส่งเรียบร้อย</span>
          <strong>{stats.completed}</strong>
        </article>
      </section>

      <section className="orders-filter-panel" aria-label="ค้นหาคำสั่งซื้อ">
        <label>
          สถานะ
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          ลูกค้า
          <input
            type="search"
            value={filters.customer}
            placeholder="ค้นหาชื่อลูกค้า"
            onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))}
          />
        </label>
        <label>
          หมายเลขคำสั่งซื้อ
          <input
            type="search"
            value={filters.orderCode}
            placeholder="ค้นหาหมายเลข"
            onChange={(event) => setFilters((current) => ({ ...current, orderCode: event.target.value }))}
          />
        </label>
        <button type="button" onClick={() => setFilters({ status: 'all', customer: '', orderCode: '' })}>
          ล้างตัวกรอง
        </button>
      </section>

      <section className="admin-panel orders-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table orders-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>หมายเลขคำสั่งซื้อ</th>
                <th>ลูกค้า</th>
                <th>จำนวนสินค้า</th>
                <th>ยอดรวม</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((order, index) => (
                  <tr key={order.order_id}>
                    <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    <td className="orders-code">{order.code}</td>
                    <td>
                      <strong>{order.customerName}</strong>
                      <span>{order.customerPhone}</span>
                    </td>
                    <td>
                      <span className="orders-item-count">{order.itemCount || order.items.length}</span>
                    </td>
                    <td className="orders-total">{formatCurrency(order.total_amount)}</td>
                    <td>
                      <span className={`status-badge status-${order.order_status}`}>
                        {getStatusLabel(order.order_status)}
                      </span>
                    </td>
                    <td>{formatDate(order.order_date)}</td>
                    <td>
                      <button type="button" className="orders-detail-button" onClick={() => openOrder(order)}>
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
      </section>

      {selectedOrder ? (
        <div className="orders-modal-backdrop" role="presentation" onMouseDown={closeOrder}>
          <section
            className="orders-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="orders-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="orders-modal-header">
              <h2 id="orders-modal-title">คำสั่งซื้อ {selectedOrder.code}</h2>
              <button type="button" aria-label="ปิด" onClick={closeOrder}>
                ×
              </button>
            </header>

            <div className="orders-modal-content">
              <section>
                <h3>ข้อมูลลูกค้า</h3>
                <p>ชื่อ: {selectedOrder.customerName}</p>
                <p>เบอร์โทร: {selectedOrder.customerPhone}</p>
                <p>อีเมล: {selectedOrder.customerEmail}</p>
                <p>ที่อยู่: {selectedOrder.shippingAddress}</p>
              </section>

              <section>
                <h3>รายการสินค้า</h3>
                {selectedOrder.items.length === 0 ? (
                  <p>ไม่มีรายการสินค้า</p>
                ) : (
                  <div className="orders-modal-items">
                    {selectedOrder.items.map((item) => (
                      <div key={item.order_item_id} className="orders-modal-item">
                        <span>{item.product?.product_name || `สินค้า ${item.product_id}`}</span>
                        <span>
                          {Number(item.quantity || 0).toLocaleString('th-TH')} × {formatCurrency(item.price)} ={' '}
                          {formatCurrency(Number(item.quantity || 0) * Number(item.price || 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <strong className="orders-modal-total">รวมทั้งสิ้น {formatCurrency(selectedOrder.total_amount)}</strong>
              </section>

              <section>
                <h3>ข้อมูลอื่น ๆ</h3>
                <p>วันที่สั่งซื้อ: {formatDate(selectedOrder.order_date)}</p>
                <p>สถานะปัจจุบัน: {getStatusLabel(selectedOrder.order_status)}</p>
              </section>

              <section>
                <h3>ข้อมูลติดตามพัสดุ</h3>
                <div className="orders-tracking-fields">
                  <label>
                    เลขพัสดุ
                    <input
                      value={trackingForm.tracking_number}
                      onChange={(event) => setTrackingForm((current) => ({ ...current, tracking_number: event.target.value }))}
                      placeholder="เช่น TH123456789"
                    />
                    {trackingForm.tracking_number && getSafeTrackingUrl(trackingForm.tracking_url) ? (
                      <a
                        className="orders-tracking-preview"
                        href={getSafeTrackingUrl(trackingForm.tracking_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ทดลองเปิดลิงก์: {trackingForm.tracking_number} ↗
                      </a>
                    ) : null}
                  </label>
                  <label>
                    บริษัทขนส่ง
                    <select
                      value={trackingForm.shipping_carrier}
                      onChange={(event) => {
                        const carrier = shippingCarriers.find((item) => item.carrier_name === event.target.value);
                        setTrackingForm((current) => ({
                          ...current,
                          shipping_carrier: event.target.value,
                          tracking_url: carrier?.tracking_url || current.tracking_url,
                        }));
                      }}
                    >
                      <option value="">เลือกบริษัทขนส่ง</option>
                      {shippingCarriers.map((carrier) => (
                        <option key={carrier.carrier_id} value={carrier.carrier_name}>
                          {carrier.carrier_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ลิงก์ติดตามพัสดุ
                    <input
                      value={trackingForm.tracking_url}
                      onChange={(event) => setTrackingForm((current) => ({ ...current, tracking_url: event.target.value }))}
                      placeholder="https://..."
                    />
                    <small>เลขพัสดุจะแสดงเป็นลิงก์นี้ในหน้าของลูกค้า</small>
                  </label>
                </div>
              </section>
            </div>

            <footer className="orders-modal-actions">
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
                {EDITABLE_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button type="button" className="orders-save-button" onClick={handleSaveStatus} disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button type="button" className="orders-close-button" onClick={closeOrder} disabled={saving}>
                ปิด
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

