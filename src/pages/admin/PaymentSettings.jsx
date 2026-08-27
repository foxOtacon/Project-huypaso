import { useEffect, useState } from 'react';
import { fetchPaymentSettings, savePaymentSettings } from '../../api/admin';

const PAYMENT_ERROR_TRANSLATIONS = {
  'Please complete every field for the selected payment method': 'กรุณากรอกข้อมูลของช่องทางการชำระเงินที่เลือกให้ครบทุกช่อง',
  'Payment settings were saved but could not be reloaded': 'บันทึกการตั้งค่าการชำระเงินแล้ว แต่ไม่สามารถโหลดข้อมูลล่าสุดได้',
};

function getThaiPaymentError(error) {
  const message = error?.message || '';
  return PAYMENT_ERROR_TRANSLATIONS[message] || message || 'ไม่สามารถบันทึกการตั้งค่าการชำระเงินได้';
}

export default function PaymentSettings() {
  const [form, setForm] = useState({ promptpayNumber: '', accountName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentAlert, setPaymentAlert] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPaymentSettings().then((settings) => {
      if (!active || !settings) return;
      setForm({
        promptpayNumber: settings.promptpay_number || '',
        accountName: settings.account_name || '',
      });
    }).catch((err) => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function showPaymentAlert(alertMessage, fields = [], title = 'ข้อมูลยังไม่ครบ') {
    setPaymentAlert({ title, message: alertMessage, fields });
  }


  async function submit(event) {
    event.preventDefault(); setMessage(''); setError(''); setPaymentAlert(null);
    const promptpayNumber = form.promptpayNumber.trim();
    const promptpayAccountName = form.accountName.trim();
    const promptPaySelected = Boolean(promptpayNumber || promptpayAccountName);
    const missingFields = [];

    if (promptPaySelected) {
      if (!promptpayNumber) missingFields.push('เลขพร้อมเพย์');
      if (!promptpayAccountName) missingFields.push('ชื่อบัญชีพร้อมเพย์');
    }


    const promptPayComplete = Boolean(promptpayNumber && promptpayAccountName);
    try {
      setSaving(true);
      await savePaymentSettings({
        promptpayNumber, accountName: promptpayAccountName,

      });
      setMessage('บันทึกการตั้งค่าสำเร็จ');
    } catch (err) {
      showPaymentAlert(getThaiPaymentError(err), [], 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  if (loading) return <p>กำลังโหลดการตั้งค่า...</p>;
  return <section className="admin-payment-settings">
    <div className="admin-section-heading"><div><p>Payment</p><h2>ตั้งค่าการชำระเงิน</h2></div></div>
    <form className="admin-payment-settings-form" onSubmit={submit}>
      <div className="admin-payment-settings-grid">
        <section className="admin-payment-settings-card">
          <header><p>QR Payment</p><h3>พร้อมเพย์</h3></header>
          <div className="admin-payment-qr-preview"><span>ระบบสร้าง QR Code อัตโนมัติตามเลขพร้อมเพย์และยอดสั่งซื้อ</span></div>
          <label>เลขพร้อมเพย์<input value={form.promptpayNumber} onChange={(e) => setForm((current) => ({ ...current, promptpayNumber: e.target.value }))} /></label>
          <label>ชื่อบัญชี<input value={form.accountName} onChange={(e) => setForm((current) => ({ ...current, accountName: e.target.value }))} /></label>
        </section>
      </div>
      {error ? <p className="admin-form-error" role="alert">{error}</p> : null}{message ? <p className="admin-form-success" role="status">{message}</p> : null}
      <button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</button>
    </form>
    {paymentAlert ? (
      <div className="admin-payment-alert-backdrop" role="presentation" onMouseDown={() => setPaymentAlert(null)}>
        <section
          className="admin-payment-alert-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-payment-alert-title"
          aria-describedby="admin-payment-alert-description"
          onMouseDown={(alertEvent) => alertEvent.stopPropagation()}
        >
          <div className="admin-payment-alert-icon" aria-hidden="true">!</div>
          <p className="admin-payment-alert-eyebrow">แจ้งเตือนการตั้งค่าการชำระเงิน</p>
          <h2 id="admin-payment-alert-title">{paymentAlert.title}</h2>
          <p id="admin-payment-alert-description">{paymentAlert.message}</p>
          {paymentAlert.fields.length > 0 ? (
            <ul>
              {paymentAlert.fields.map((field) => <li key={field}>{field}</li>)}
            </ul>
          ) : null}
          <button type="button" autoFocus onClick={() => setPaymentAlert(null)}>
            {paymentAlert.fields.length > 0 ? 'กลับไปกรอกข้อมูล' : 'รับทราบ'}
          </button>
        </section>
      </div>
    ) : null}
  </section>;
}
