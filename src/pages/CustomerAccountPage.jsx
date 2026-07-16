import { useEffect, useState } from 'react';
import { fetchMyOrderDetail, fetchMyOrders } from '../api/customer';
import CustomerNavbar from '../components/CustomerNavbar';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { buildTrackingLink, copyTrackingNumber } from '../utils/tracking';
import { useAuth } from '../context/AuthContext';
import './CustomerAccountPage.css';

const pageContent = {
  eyebrow: 'Orders & Payment',
  title: 'สถานะคำสั่งซื้อและชำระเงิน',
  description: 'ติดตามคำสั่งซื้อ สถานะจัดส่ง และผลตรวจสอบสลิปชำระเงินในหน้าเดียว',
  empty: 'ยังไม่มีคำสั่งซื้อ',
};

const ORDER_STATUS_LABELS = {
  pending: 'รอดำเนินการ',
  shipping: 'กำลังจัดส่ง',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
};

const PAYMENT_STATUS_LABELS = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getOrderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status || '-';
}

function getPaymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || (status ? status : 'ยังไม่ส่งสลิป');
}

export default function CustomerAccountPage({ user, onNavigate, onLogout }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [trackingNotice, setTrackingNotice] = useState('');
  const latestOrder = orders[0];
  const orderPagination = usePagination(orders, 5);

  async function loadOrders() {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const rows = await fetchMyOrders(token);
      setOrders(rows);
    } catch (err) {
      setError(err.message || 'ไม่สามารถโหลดคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  }

  async function openOrderDetail(orderId) {
    if (!token) return;

    try {
      setDetailLoading(true);
      setDetailError('');
      setTrackingNotice('');
      const detail = await fetchMyOrderDetail(token, orderId);
      setSelectedOrder(detail);
    } catch (err) {
      setDetailError(err.message || 'ไม่สามารถโหลดรายละเอียดคำสั่งซื้อได้');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [token]);

  return (
    <div className="customer-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="customer-main">
        <section className="customer-hero-panel">
          <p>{pageContent.eyebrow}</p>
          <h1>{pageContent.title}</h1>
          <span>{pageContent.description}</span>
        </section>

        <section className="customer-status-card">
          <div>
            <p>สถานะล่าสุด</p>
            <h2>
              {loading
                ? 'กำลังโหลด...'
                : latestOrder
                  ? `คำสั่งซื้อ #${latestOrder.order_id} - ${getOrderStatusLabel(latestOrder.order_status)} / ชำระเงิน: ${getPaymentStatusLabel(latestOrder.payment_status)}`
                  : pageContent.empty}
            </h2>
          </div>
          <button type="button" onClick={loadOrders} disabled={loading}>
            {loading ? 'กำลังรีเฟรช...' : 'รีเฟรชสถานะ'}
          </button>
        </section>

        {error ? <p className="customer-error">{error}</p> : null}
        {detailError ? <p className="customer-error">{detailError}</p> : null}

        <section className="customer-orders" aria-label={pageContent.title}>
          {loading ? (
            <p className="customer-empty">กำลังโหลดข้อมูล...</p>
          ) : orders.length === 0 ? (
            <div className="customer-empty-state">
              <h2>{pageContent.empty}</h2>
              <button type="button" onClick={() => onNavigate('/products')}>
                เลือกสินค้า
              </button>
            </div>
          ) : (
            orderPagination.pageItems.map((order) => (
              <article className="customer-order-card" key={`${order.order_id}-${order.payment_id || 'order'}`}>
                <div className="customer-order-main">
                  <div>
                    <p>Order #{order.order_id}</p>
                    <h2>{formatCurrency(order.total_amount)}</h2>
                    <span>{formatDate(order.order_date)}</span>
                  </div>
                  <div className="customer-status-stack">
                    <span className={`customer-badge customer-badge-${order.order_status}`}>
                      {getOrderStatusLabel(order.order_status)}
                    </span>
                    <span className={`customer-payment-badge customer-payment-${order.payment_status || 'none'}`}>
                      {getPaymentStatusLabel(order.payment_status)}
                    </span>
                  </div>
                </div>

                <dl className="customer-order-meta">
                  <div>
                    <dt>ผู้รับ</dt>
                    <dd>{order.shipping_name || '-'}</dd>
                  </div>
                  <div>
                    <dt>เบอร์โทร</dt>
                    <dd>{order.shipping_phone || '-'}</dd>
                  </div>
                  <div>
                    <dt>สถานะชำระเงิน</dt>
                    <dd>{getPaymentStatusLabel(order.payment_status)}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="customer-detail-button"
                  onClick={() => openOrderDetail(order.order_id)}
                  disabled={detailLoading}
                >
                  {detailLoading ? 'กำลังโหลด...' : 'ดูรายละเอียด'}
                </button>
              </article>
            ))
          )}
        </section>
        {!loading && orders.length > 0 ? (
          <Pagination page={orderPagination.page} totalPages={orderPagination.totalPages} onPageChange={orderPagination.setPage} className="customer-pagination" />
        ) : null}
      </main>

      {selectedOrder && (
        <div className="customer-modal-backdrop" role="presentation" onMouseDown={() => setSelectedOrder(null)}>
          <section
            className="customer-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="customer-detail-header">
              <div>
                <p>รายละเอียดคำสั่งซื้อ</p>
                <h2 id="customer-detail-title">Order #{selectedOrder.order_id}</h2>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} aria-label="ปิดรายละเอียด">
                ×
              </button>
            </header>

            <div className="customer-detail-summary">
              <span>{getOrderStatusLabel(selectedOrder.order_status)}</span>
              <span>{getPaymentStatusLabel(selectedOrder.payment_status)}</span>
              <strong>{formatCurrency(selectedOrder.total_amount)}</strong>
            </div>

            <dl className="customer-detail-info">
              <div>
                <dt>วันที่สั่งซื้อ</dt>
                <dd>{formatDate(selectedOrder.order_date)}</dd>
              </div>
              <div>
                <dt>ผู้รับ</dt>
                <dd>{selectedOrder.shipping_name || '-'}</dd>
              </div>
              <div>
                <dt>เบอร์โทร</dt>
                <dd>{selectedOrder.shipping_phone || '-'}</dd>
              </div>
              <div>
                <dt>ที่อยู่จัดส่ง</dt>
                <dd>{selectedOrder.shipping_address || '-'}</dd>
              </div>
              <div>
                <dt>เลขอ้างอิงชำระเงิน</dt>
                <dd>{selectedOrder.transaction_ref || '-'}</dd>
              </div>
              <div>
                <dt>บริษัทขนส่ง</dt>
                <dd>{selectedOrder.shipping_carrier || '-'}</dd>
              </div>
              <div>
                <dt>เลขพัสดุ</dt>
                <dd>
                  {(() => {
                    const link = buildTrackingLink({
                      trackingUrl: selectedOrder.tracking_url,
                      trackingNumber: selectedOrder.tracking_number,
                      carrierName: selectedOrder.shipping_carrier,
                    });

                    return selectedOrder.tracking_number && link.url ? (
                      <>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={async () => {
                            if (link.prefilled) {
                              setTrackingNotice('ส่งเลขพัสดุไปยังเว็บไซต์ติดตามแล้ว');
                              return;
                            }

                            const copied = await copyTrackingNumber(selectedOrder.tracking_number);
                            setTrackingNotice(
                              copied
                                ? 'คัดลอกเลขพัสดุแล้ว กรุณาวางในช่องค้นหาของเว็บไซต์ปลายทาง'
                                : 'เว็บไซต์นี้ไม่รองรับการกรอกเลขอัตโนมัติ กรุณาคัดลอกเลขพัสดุไปวาง',
                            );
                          }}
                        >
                          {selectedOrder.tracking_number} ↗
                        </a>
                        {trackingNotice ? <small className="tracking-link-notice">{trackingNotice}</small> : null}
                      </>
                    ) : (
                      selectedOrder.tracking_number || '-'
                    );
                  })()}
                </dd>
              </div>
            </dl>

            <div className="customer-detail-items">
              <h3>รายการสินค้า</h3>
              {selectedOrder.items?.length ? (
                selectedOrder.items.map((item) => (
                  <div className="customer-detail-item" key={item.order_item_id}>
                    <div>
                      <strong>{item.product_name || `สินค้า ${item.product_id}`}</strong>
                      <span>{item.quantity} x {formatCurrency(item.price)}</span>
                    </div>
                    <b>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</b>
                  </div>
                ))
              ) : (
                <p className="customer-empty">ไม่มีรายการสินค้า</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}




