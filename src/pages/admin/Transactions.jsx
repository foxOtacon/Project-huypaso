import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import {
  fetchOrderItems,
  fetchOrders,
  approveAdminPayment,
  fetchAdminPayments,
  fetchPayments,
  fetchProducts,
  fetchUsers,
  rejectAdminPayment,
} from '../../api/admin';
import { formatCurrency } from '../../utils/dashboardStats';
import { formatAddressForDisplay } from '../../utils/profileAddress';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอตรวจสอบ' },
  { value: 'approved', label: 'อนุมัติ' },
  { value: 'rejected', label: 'ปฏิเสธ' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'promptpay', label: 'พร้อมเพย์' },
  { value: 'bank_transfer', label: 'โอนธนาคาร' },
];

const PAYMENT_STATUS_LABELS = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติ',
  rejected: 'ปฏิเสธ',
};

const PAYMENT_METHOD_LABELS = {
  promptpay: 'พร้อมเพย์',
  bank_transfer: 'โอนธนาคาร',
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  return new Date(dateValue).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildTransactionRows(payments, orders, users, orderItems, products) {
  const orderMap = new Map(orders.map((order) => [Number(order.order_id), order]));
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

  return [...payments]
    .sort((a, b) => new Date(b.payment_date || 0) - new Date(a.payment_date || 0))
    .map((payment) => {
      const order = orderMap.get(Number(payment.order_id)) || payment;
      const customer = order ? userMap.get(Number(order.user_id)) : null;
      const items = order ? itemsByOrder.get(Number(order.order_id)) || [] : [];

      return {
        ...payment,
        order,
        items,
        code: payment.transaction_ref || `TXN${String(payment.payment_id).padStart(4, '0')}`,
        customerName: order?.shipping_name || payment.full_name || customer?.full_name || 'ไม่พบข้อมูลลูกค้า',
        customerPhone: order?.shipping_phone || payment.phone || customer?.phone || '-',
        customerEmail: payment.email || customer?.email || '-',
        shippingAddress: formatAddressForDisplay(order?.shipping_address || payment.shipping_address || customer?.address) || '-',
        methodLabel: PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method,
        statusLabel: PAYMENT_STATUS_LABELS[payment.payment_status] || payment.payment_status,
      };
    });
}

export default function Transactions() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', method: 'all', search: '' });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTransactions() {
      try {
        const [paymentsData, ordersData, usersData, orderItemsData, productsData] = await Promise.all([
          fetchAdminPayments().catch(() => fetchPayments()),
          fetchOrders(),
          fetchUsers(),
          fetchOrderItems(),
          fetchProducts(),
        ]);

        setPayments(paymentsData);
        setOrders(ordersData);
        setUsers(usersData);
        setOrderItems(orderItemsData);
        setProducts(productsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, []);

  const rows = useMemo(
    () => buildTransactionRows(payments, orders, users, orderItems, products),
    [payments, orders, users, orderItems, products],
  );

  const filteredRows = useMemo(() => {
    const query = normalizeText(filters.search);

    return rows.filter((transaction) => {
      const matchesStatus =
        filters.status === 'all' || transaction.payment_status === filters.status;
      const matchesMethod =
        filters.method === 'all' || transaction.payment_method === filters.method;
      const matchesSearch =
        !query ||
        normalizeText(transaction.customerName).includes(query) ||
        normalizeText(transaction.code).includes(query) ||
        normalizeText(transaction.customerPhone).includes(query);

      return matchesStatus && matchesMethod && matchesSearch;
    });
  }, [filters, rows]);

  const updateSelectedPayment = async (status) => {
    if (!selectedTransaction || selectedTransaction.payment_status === status) return;

    setSaving(true);
    setError('');

    try {
      const updated =
        status === 'approved'
          ? await approveAdminPayment(selectedTransaction.payment_id)
          : await rejectAdminPayment(selectedTransaction.payment_id);

      setPayments((current) =>
        current.map((payment) =>
          payment.payment_id === updated.payment_id ? updated : payment,
        ),
      );
      setSelectedTransaction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pagination = usePagination(filteredRows, 10, [filters]);

  if (loading) {
    return <div className="admin-loading">กำลังโหลดธุรกรรม...</div>;
  }

  if (error && rows.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <>
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="transactions-filter-panel" aria-label="ค้นหาธุรกรรม">
        <label>
          สถานะ
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
          >
            {PAYMENT_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          ช่องทางการชำระ
          <select
            value={filters.method}
            onChange={(event) =>
              setFilters((current) => ({ ...current, method: event.target.value }))
            }
          >
            {PAYMENT_METHOD_OPTIONS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          ค้นหา
          <input
            type="search"
            value={filters.search}
            placeholder="ค้นหาชื่อลูกค้า หรือ รหัสธุรกรรม"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
        </label>
      </section>

      <section className="admin-panel transactions-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table transactions-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>ชื่อลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>ยอดเงิน</th>
                <th>ช่องทาง</th>
                <th>สลิป</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-table-empty">
                    ไม่พบธุรกรรมที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((transaction, index) => (
                  <tr key={transaction.payment_id}>
                    <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    <td>{transaction.customerName}</td>
                    <td>{transaction.customerPhone}</td>
                    <td className="transactions-amount">{formatCurrency(transaction.amount)}</td>
                    <td>
                      <span className={`payment-method-badge payment-method-${transaction.payment_method}`}>
                        {transaction.methodLabel}
                      </span>
                    </td>
                    <td>
                      {transaction.slip_image ? (
                        <a className="transactions-slip-link" href={transaction.slip_image} target="_blank" rel="noreferrer">
                          เปิดสลิป
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`payment-status-badge payment-status-${transaction.payment_status}`}>
                        {transaction.statusLabel}
                      </span>
                    </td>
                    <td>{formatDate(transaction.payment_date)}</td>
                    <td>
                      <button
                        type="button"
                        className="orders-detail-button"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
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

      {selectedTransaction ? (
        <div className="transactions-drawer-backdrop" role="presentation" onMouseDown={() => setSelectedTransaction(null)}>
          <aside
            className="transactions-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transactions-drawer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="transactions-drawer-header">
              <h2 id="transactions-drawer-title">รายละเอียดธุรกรรม</h2>
              <button type="button" aria-label="ปิด" onClick={() => setSelectedTransaction(null)}>
                ×
              </button>
            </header>

            <div className="transactions-drawer-content">
              <section>
                <h3>ข้อมูลธุรกรรม</h3>
                <dl>
                  <dt>รหัสธุรกรรม</dt>
                  <dd>{selectedTransaction.code}</dd>
                  <dt>วันที่</dt>
                  <dd>{formatDate(selectedTransaction.payment_date)}</dd>
                  <dt>ช่องทาง</dt>
                  <dd>{selectedTransaction.methodLabel}</dd>
                  <dt>ยอดเงิน</dt>
                  <dd>{formatCurrency(selectedTransaction.amount)}</dd>
                </dl>
              </section>

              <section>
                <h3>ข้อมูลลูกค้า</h3>
                <div className="transactions-info-box">
                  <p>ชื่อ: {selectedTransaction.customerName}</p>
                  <p>อีเมล: {selectedTransaction.customerEmail}</p>
                  <p>เบอร์โทร: {selectedTransaction.customerPhone}</p>
                </div>
              </section>

              <section>
                <h3>สินค้าที่สั่ง</h3>
                {selectedTransaction.items.length === 0 ? (
                  <p className="transactions-muted">ไม่มีรายการสินค้า</p>
                ) : (
                  <div className="transactions-items">
                    {selectedTransaction.items.map((item) => (
                      <div key={item.order_item_id} className="transactions-item">
                        <span>{item.product?.product_name || `สินค้า ${item.product_id}`}</span>
                        <span>จำนวน: {Number(item.quantity || 0).toLocaleString('th-TH')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {selectedTransaction.slip_image ? (
                <section>
                  <h3>หลักฐานการชำระเงิน</h3>
                  <a className="transactions-slip-link" href={selectedTransaction.slip_image} target="_blank" rel="noreferrer">
                    เปิดสลิป
                  </a>
                </section>
              ) : null}
            </div>

            <footer className="transactions-drawer-actions">
              <button
                type="button"
                className="transactions-approve-button"
                disabled={saving || selectedTransaction.payment_status === 'approved'}
                onClick={() => updateSelectedPayment('approved')}
              >
                ✓ อนุมัติ
              </button>
              <button
                type="button"
                className="transactions-reject-button"
                disabled={saving || selectedTransaction.payment_status === 'rejected'}
                onClick={() => updateSelectedPayment('rejected')}
              >
                X ปฏิเสธ
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}

