import { useEffect, useMemo, useState } from 'react';
import {
  cancelPromptPayOrder,
  createPromptPayOrder,
  fetchPromptPayQr,
  uploadPromptPaySlip,
} from '../api/checkout';
import { useRef } from 'react';
import { fetchMyOrderDetail } from '../api/customer';
import CustomerNavbar from '../components/CustomerNavbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatAddressForDisplay } from '../utils/profileAddress';
import { getImageUrl } from '../utils/imageUrl';
import { findThaiBank } from '../utils/thaiBanks';
import './PaymentPage.css';

function formatPrice(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export default function PaymentPage({ user, onNavigate, onLogout }) {
  const { token } = useAuth();
  const { items, totalAmount, clearCart } = useCart();
  const [form, setForm] = useState({
    shipping_name: user?.full_name || '',
    shipping_phone: user?.phone || '',
    shipping_address: formatAddressForDisplay(user?.address),
  });
  const [createdOrder, setCreatedOrder] = useState(null);
  const [promptPayQr, setPromptPayQr] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [validationAlert, setValidationAlert] = useState(null);
  const [cancelAlertOpen, setCancelAlertOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [resumeItems, setResumeItems] = useState([]);
  const [loadingResume, setLoadingResume] = useState(() => Boolean(new URLSearchParams(window.location.hash.split('?')[1] || '').get('orderId')));
  const [copiedPromptPay, setCopiedPromptPay] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('promptpay');
  const paymentFormRef = useRef(null);
  const displayItems = createdOrder && resumeItems.length ? resumeItems : items;
  const awaitingPayment = Boolean(createdOrder && !completed && createdOrder.order_status === 'pending' && createdOrder.payment_status === 'pending' && !createdOrder.slip_image && secondsLeft > 0);
  const selectedBank = findThaiBank(promptPayQr?.bank_name);

  function guardedNavigate(path) {
    if (awaitingPayment) setLeaveTarget(path);
    else onNavigate(path);
  }

  async function copyPromptPayNumber() {
    if (!promptPayQr?.promptpay_number) return;
    try {
      await navigator.clipboard.writeText(promptPayQr.promptpay_number);
      setCopiedPromptPay(true);
      window.setTimeout(() => setCopiedPromptPay(false), 1800);
    } catch {
      setError('ไม่สามารถคัดลอกหมายเลขพร้อมเพย์ได้');
    }
  }

  async function copyBankAccountNumber() {
    if (!promptPayQr?.bank_account_number) return;
    try {
      await navigator.clipboard.writeText(promptPayQr.bank_account_number);
      setCopiedPromptPay(true);
      window.setTimeout(() => setCopiedPromptPay(false), 1800);
    } catch {
      setError('ไม่สามารถคัดลอกเลขบัญชีได้');
    }
  }

  const canCreateOrder = useMemo(() => {
    return (
      form.shipping_name.trim() &&
      form.shipping_phone.trim() &&
      form.shipping_address.trim() &&
      totalAmount > 0 &&
      items.length > 0
    );
  }, [form, items.length, totalAmount]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateOrder(event) {
    event.preventDefault();
    setError('');

    const missingFields = [];
    if (!form.shipping_phone.trim()) missingFields.push('เบอร์โทร');
    if (!form.shipping_address.trim()) missingFields.push('ที่อยู่จัดส่ง');

    if (missingFields.length > 0) {
      setValidationAlert({
        fields: missingFields,
        firstField: !form.shipping_phone.trim() ? 'shipping_phone' : 'shipping_address',
      });
      return;
    }

    if (!canCreateOrder) {
      setError(
        'กรุณากรอกข้อมูลจัดส่งให้ครบถ้วน',
      );
      return;
    }

    const orderItems = items.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
    }));

    if (orderItems.some((item) => !Number.isInteger(item.product_id) || item.product_id <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      setError('Cart has invalid product data. Please remove the item and add it again.');
      return;
    }

    try {
      setSubmitting(true);

      const order = await createPromptPayOrder(token, {
        items: orderItems,
        shipping_name: form.shipping_name.trim(),
        shipping_phone: form.shipping_phone.trim(),
        shipping_address: form.shipping_address.trim(),
      });
      const qr = await fetchPromptPayQr(token, order.order_id);

      setCreatedOrder(order);
      setResumeItems(items);
      setPromptPayQr(qr);
      setPaymentMethod((current) => {
        if (qr.available_methods?.[current]) return current;
        return qr.available_methods?.promptpay ? 'promptpay' : 'bank_transfer';
      });
      setSecondsLeft(Number(qr.expires_in_seconds || 10 * 60));
    } catch (err) {
      if (err.message?.includes('Product not found')) {
        clearCart();
        setError('Some products in your cart are no longer available. Please add them again from the products page.');
        return;
      }

      setError(err.message || 'ไม่สามารถสร้างคำสั่งซื้อได้');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSlipChange(event) {
    const file = event.target.files?.[0] || null;
    setSlipFile(file);
    setError('');

    if (slipPreview) {
      URL.revokeObjectURL(slipPreview);
    }

    setSlipPreview(file ? URL.createObjectURL(file) : '');
  }

  async function handleUploadSlip() {
    setError('');

    if (secondsLeft <= 0) {
      setError('หมดเวลาชำระเงิน คำสั่งซื้อนี้ถูกยกเลิกแล้ว กรุณาสั่งซื้อใหม่');
      return;
    }

    if (!createdOrder || !slipFile) {
      setError('กรุณาแนบสลิปก่อนส่งตรวจสอบ');
      return;
    }

    try {
      setUploading(true);
      await uploadPromptPaySlip(token, {
        orderId: createdOrder.order_id,
        paymentMethod,
        file: slipFile,
      });
      clearCart();
      setCompleted(true);
    } catch (err) {
      setError(err.message || 'ไม่สามารถอัปโหลดสลิปได้');
    } finally {
      setUploading(false);
    }
  }

  async function handleCancelOrder() {
    if (!createdOrder || cancelling) return;

    setError('');
    setCancelling(true);

    try {
      await cancelPromptPayOrder(token, createdOrder.order_id);
      setCancelAlertOpen(false);
      setCreatedOrder(null);
      setPromptPayQr(null);
      setSecondsLeft(0);
      setSlipFile(null);

      if (slipPreview) {
        URL.revokeObjectURL(slipPreview);
        setSlipPreview('');
      }

      onNavigate('/order-status');
    } catch (err) {
      setCancelAlertOpen(false);
      setError(err.message || 'ไม่สามารถยกเลิกคำสั่งซื้อได้');
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (!createdOrder || completed || secondsLeft <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [completed, createdOrder, secondsLeft]);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('orderId');
    if (!orderId || !token) return;
    let active = true;
    Promise.all([fetchMyOrderDetail(token, orderId), fetchPromptPayQr(token, orderId)])
      .then(([order, qr]) => {
        if (!active) return;
        setCreatedOrder(order);
        setResumeItems(order.items || []);
        setForm({ shipping_name: order.shipping_name || '', shipping_phone: order.shipping_phone || '', shipping_address: formatAddressForDisplay(order.shipping_address) });
        setPromptPayQr(qr);
        setPaymentMethod((current) => {
          if (qr.available_methods?.[current]) return current;
          return qr.available_methods?.promptpay ? 'promptpay' : 'bank_transfer';
        });
        setSecondsLeft(Number(qr.expires_in_seconds || 0));
      })
      .catch((err) => active && setError(err.message || 'ไม่สามารถกลับมาชำระคำสั่งซื้อนี้ได้'))
      .finally(() => active && setLoadingResume(false));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!awaitingPayment) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [awaitingPayment]);

  useEffect(() => {
    return () => {
      if (slipPreview) {
        URL.revokeObjectURL(slipPreview);
      }
    };
  }, [slipPreview]);

  if (completed) {
    return (
      <div className="payment-page">
        <CustomerNavbar user={user} onNavigate={guardedNavigate} onLogout={() => guardedNavigate('/logout')} />

        <main className="payment-success">
          <section>
            <p>Payment Submitted</p>
            <h1>ส่งสลิปเรียบร้อย</h1>
            <span>คำสั่งซื้อ #{createdOrder.order_id} กำลังรอแอดมินตรวจสอบการชำระเงิน</span>
            <div className="payment-success-actions">
              <button type="button" onClick={() => onNavigate('/order-status')}>
                ดูคำสั่งซื้อของฉัน
              </button>
              <button type="button" onClick={() => onNavigate('/products')}>
                เลือกสินค้าต่อ
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="payment-page">
        <CustomerNavbar user={user} onNavigate={guardedNavigate} onLogout={() => guardedNavigate('/logout')} />

      <main className="payment-main">
        <section className="payment-title">
          <p>Checkout</p>
          <h1>ชำระเงิน</h1>
          <span>เลือกโอนผ่านบัญชีธนาคารหรือพร้อมเพย์ แล้วแนบสลิปเพื่อส่งให้แอดมินตรวจสอบ</span>
        </section>

        {loadingResume ? (
          <section className="payment-empty"><p>กำลังโหลดคำสั่งซื้อเดิม...</p></section>
        ) : items.length === 0 && !createdOrder ? (
          <section className="payment-empty">
            <h2>ไม่มีสินค้าในตะกร้า</h2>
            <p>กรุณาเลือกสินค้าก่อนชำระเงิน</p>
            <button type="button" onClick={() => onNavigate('/products')}>
              ไปเลือกสินค้า
            </button>
          </section>
        ) : (
          <form ref={paymentFormRef} className="payment-layout" onSubmit={handleCreateOrder}>
            <section className="payment-card">
              <h2>ข้อมูลจัดส่ง</h2>
              <label>
                ชื่อผู้รับ
                <input
                  value={form.shipping_name}
                  onChange={(event) => updateField('shipping_name', event.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                  disabled={Boolean(createdOrder)}
                />
              </label>
              <label>
                เบอร์โทร
                <input
                  name="shipping_phone"
                  value={form.shipping_phone}
                  onChange={(event) => updateField('shipping_phone', event.target.value)}
                  placeholder="เบอร์โทรสำหรับติดต่อ"
                  disabled={Boolean(createdOrder)}
                />
              </label>
              <label>
                ที่อยู่จัดส่ง
                <textarea
                  name="shipping_address"
                  value={form.shipping_address}
                  onChange={(event) => updateField('shipping_address', event.target.value)}
                  placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                  rows="4"
                  disabled={Boolean(createdOrder)}
                />
              </label>
            </section>

            <section className="payment-card">
              <h2>{paymentMethod === 'bank_transfer' ? 'โอนผ่านบัญชีธนาคาร' : 'PromptPay'}</h2>
              <div className="payment-method-selector" aria-label="เลือกวิธีชำระเงิน">
                <button
                  type="button"
                  className={paymentMethod === 'bank_transfer' ? 'active' : ''}
                  aria-pressed={paymentMethod === 'bank_transfer'}
                  disabled={Boolean(promptPayQr && !promptPayQr.available_methods?.bank_transfer)}
                  onClick={() => setPaymentMethod('bank_transfer')}
                >
                  โอนผ่านบัญชีธนาคาร
                </button>
                <button
                  type="button"
                  className={paymentMethod === 'promptpay' ? 'active' : ''}
                  aria-pressed={paymentMethod === 'promptpay'}
                  disabled={Boolean(promptPayQr && !promptPayQr.available_methods?.promptpay)}
                  onClick={() => setPaymentMethod('promptpay')}
                >
                  พร้อมเพย์
                </button>
              </div>
              {paymentMethod === 'bank_transfer' && promptPayQr?.available_methods?.bank_transfer ? (
                <div className="payment-bank-transfer-box">
                  <header className="payment-bank-brand">
                    {selectedBank
                      ? <img src={selectedBank.logo} alt="" aria-hidden="true" />
                      : <span className="payment-bank-logo-fallback" aria-hidden="true">฿</span>}
                    <div><p>ธนาคาร</p><strong>{promptPayQr.bank_name}</strong></div>
                  </header>
                  <p>เลขบัญชี</p><strong>{promptPayQr.bank_account_number}</strong>
                  <p>ชื่อบัญชี</p><strong>{promptPayQr.bank_account_name}</strong>
                  <button type="button" onClick={copyBankAccountNumber}>{copiedPromptPay ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}</button>
                  <div><span>ยอดที่ต้องชำระ</span><b>{formatPrice(createdOrder?.total_amount || totalAmount)}</b></div>
                  <small>กรุณาโอนให้ตรงตามยอดและอัปโหลดสลิปก่อนหมดเวลา</small>
                </div>
              ) : null}
              {paymentMethod === 'promptpay' ? <div className="payment-bank-box">
                <strong>ยอดที่ต้องชำระ {formatPrice(createdOrder?.total_amount || totalAmount)}</strong>
                {promptPayQr ? <span>ชื่อบัญชี: {promptPayQr.account_name}</span> : null}
                {promptPayQr ? <span>หมายเลขพร้อมเพย์: {promptPayQr.promptpay_number}</span> : null}
                <span>หลังโอนเงินแล้วแนบสลิปเพื่อส่งตรวจสอบ</span>
              </div> : null}

              {promptPayQr && paymentMethod === 'promptpay' && promptPayQr.available_methods?.promptpay && (
                <div className="payment-qr-box">
                  <img src={getImageUrl(promptPayQr.qr_code || promptPayQr.qrCode)} alt="PromptPay QR Code" />
                  <strong>ชื่อบัญชี: {promptPayQr.account_name}</strong>
                  <span>หมายเลขพร้อมเพย์: {promptPayQr.promptpay_number}</span>
                  <button type="button" className="payment-copy-promptpay" onClick={copyPromptPayNumber}>{copiedPromptPay ? 'คัดลอกแล้ว' : 'คัดลอกหมายเลขพร้อมเพย์'}</button>
                  <span>ยอดชำระ {formatPrice(promptPayQr.amount)}</span>
                  <small>Order ID: {promptPayQr.order_id || promptPayQr.orderId}</small>
                  <small>
                    {secondsLeft > 0
                      ? `กรุณาแนบสลิปภายใน ${formatCountdown(secondsLeft)}`
                      : 'หมดเวลาชำระเงิน คำสั่งซื้อถูกยกเลิกแล้ว'}
                  </small>
                </div>
              )}

              {createdOrder && (
                <label>
                  แนบสลิปโอนเงิน
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleSlipChange}
                    disabled={secondsLeft <= 0}
                  />
                </label>
              )}

              {slipPreview && (
                <img className="payment-slip-preview" src={slipPreview} alt="ตัวอย่างสลิปโอนเงิน" />
              )}
            </section>

            <aside className="payment-summary">
              <h2>สรุปรายการ</h2>
              <div className="payment-summary-list">
                {displayItems.map((item) => (
                  <div key={item.product_id}>
                    <span>
                      {item.product_name}
                      <small>x {item.quantity}</small>
                    </span>
                    <strong>{formatPrice(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <div className="payment-total">
                <span>ยอดรวม</span>
                <strong>{formatPrice(createdOrder?.total_amount || totalAmount)}</strong>
              </div>
              {error && <p className="payment-error">{error}</p>}
              {createdOrder && secondsLeft <= 0 && (
                <p className="payment-error">
                  หมดเวลาชำระเงิน เนื่องจากไม่ได้แนบสลิป คำสั่งซื้อถูกยกเลิกแล้ว
                </p>
              )}
              {!createdOrder ? (
                <div className="payment-checkout-actions">
                  <button type="submit" disabled={submitting || items.length === 0}>
                    {submitting ? 'กำลังโหลด' : 'ชำระเงิน'}
                  </button>
                  
                </div>
              ) : (
                <div className="payment-summary-actions">
                  <button
                    type="button"
                    onClick={handleUploadSlip}
                    disabled={!slipFile || uploading || cancelling || secondsLeft <= 0}
                  >
                    {uploading ? 'กำลังส่งสลิป...' : 'ส่งสลิปให้ตรวจสอบ'}
                  </button>
                  <button
                    type="button"
                    className="payment-cancel-order"
                    onClick={() => setCancelAlertOpen(true)}
                    disabled={uploading || cancelling}
                  >
                    ยกเลิกคำสั่งซื้อ
                  </button>
                </div>
              )}
            </aside>
          </form>
        )}
      </main>

      {validationAlert && (
        <div className="payment-alert-backdrop" role="presentation" onMouseDown={() => setValidationAlert(null)}>
          <section
            className="payment-alert-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-alert-title"
            aria-describedby="payment-alert-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="payment-alert-icon" aria-hidden="true">!</div>
            <div className="payment-alert-content">
              <p>ข้อมูลยังไม่ครบ</p>
              <h2 id="payment-alert-title">กรุณากรอกข้อมูลจัดส่ง</h2>
              <div id="payment-alert-description">
                {validationAlert.fields.map((field) => <span key={field}>✓ {field}</span>)}
              </div>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => {
                const fieldName = validationAlert.firstField;
                setValidationAlert(null);
                window.requestAnimationFrame(() => paymentFormRef.current?.elements[fieldName]?.focus());
              }}
            >
              กลับไปกรอกข้อมูล
            </button>
          </section>
        </div>
      )}

      {cancelAlertOpen && (
        <div className="payment-alert-backdrop" role="presentation" onMouseDown={() => !cancelling && setCancelAlertOpen(false)}>
          <section
            className="payment-alert-dialog payment-cancel-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-cancel-title"
            aria-describedby="payment-cancel-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="payment-alert-icon payment-cancel-icon" aria-hidden="true">!</div>
            <div className="payment-alert-content">
              <p>ยืนยันการยกเลิก</p>
              <h2 id="payment-cancel-title">คุณต้องการยกเลิกคำสั่งซื้อนี้หรือไม่?</h2>
              <div id="payment-cancel-description" className="payment-cancel-description">
                ระบบจะคืนสินค้าเข้าสต็อก และพาคุณกลับไปแก้ไขสินค้าในตะกร้า
              </div>
            </div>
            <div className="payment-cancel-actions">
              <button type="button" onClick={() => setCancelAlertOpen(false)} disabled={cancelling}>
                กลับ
              </button>
              <button type="button" autoFocus onClick={handleCancelOrder} disabled={cancelling}>
                {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}
              </button>
            </div>
          </section>
        </div>
      )}

      {leaveTarget && (
        <div className="payment-alert-backdrop" role="presentation" onMouseDown={() => setLeaveTarget(null)}>
          <section className="payment-alert-dialog" role="alertdialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="payment-alert-icon" aria-hidden="true">!</div>
            <div className="payment-alert-content">
              <p>ยังไม่ได้ชำระเงิน</p>
              <h2>คำสั่งซื้อของคุณยังไม่ได้ชำระเงิน</h2>
              <div className="payment-cancel-description">หากออกจากหน้านี้ คุณสามารถกลับมาชำระต่อได้จากประวัติการสั่งซื้อก่อนหมดเวลาชำระ</div>
            </div>
            <div className="payment-cancel-actions">
              <button type="button" autoFocus onClick={() => setLeaveTarget(null)}>ชำระเงินต่อ</button>
              <button type="button" onClick={() => { const target = leaveTarget; setLeaveTarget(null); if (target === '/logout') onLogout?.(); else onNavigate(target); }}>ออกจากหน้านี้</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
