import { useEffect, useState } from 'react';
import { fetchPaymentSettings, savePaymentSettings } from '../../api/admin';
import { THAI_BANKS } from '../../utils/thaiBanks';

const PAYMENT_ERROR_TRANSLATIONS = {
  'Please complete every field for the selected payment method': 'กรุณากรอกข้อมูลของช่องทางการชำระเงินที่เลือกให้ครบทุกช่อง',
  'PromptPay QR image is required': 'กรุณาอัปโหลดรูป QR Code พร้อมเพย์',
  'Only jpg, png, and webp QR images are allowed': 'รองรับเฉพาะรูป QR Code ชนิด JPG, PNG และ WebP',
  'Payment settings were saved but could not be reloaded': 'บันทึกการตั้งค่าการชำระเงินแล้ว แต่ไม่สามารถโหลดข้อมูลล่าสุดได้',
};

function getThaiPaymentError(error) {
  const message = error?.message || '';
  return PAYMENT_ERROR_TRANSLATIONS[message] || message || 'ไม่สามารถบันทึกการตั้งค่าการชำระเงินได้';
}

export default function PaymentSettings() {
  const [form, setForm] = useState({ promptpayNumber: '', accountName: '', bankName: '', bankAccountNumber: '', bankAccountName: '' });
  const [qrUrl, setQrUrl] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [preview, setPreview] = useState('');
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
        bankName: settings.bank_name || '',
        bankAccountNumber: settings.bank_account_number || '',
        bankAccountName: settings.bank_account_name || '',
      });
      setQrUrl(settings.qr_image_url || '');
    }).catch((err) => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function showPaymentAlert(alertMessage, fields = [], title = 'ข้อมูลยังไม่ครบ') {
    setPaymentAlert({ title, message: alertMessage, fields });
  }

  function selectQr(event) {
    const file = event.target.files?.[0] || null;
    setMessage(''); setError(''); setPaymentAlert(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showPaymentAlert('รองรับเฉพาะรูป QR Code ชนิด JPG, PNG และ WebP', ['รูป QR Code ที่เป็นไฟล์ JPG, PNG หรือ WebP'], 'ไฟล์รูปไม่ถูกต้อง'); return; }
    if (file.size > 5 * 1024 * 1024) { showPaymentAlert('รูป QR Code ต้องมีขนาดไม่เกิน 5 MB', ['รูป QR Code ขนาดไม่เกิน 5 MB'], 'ไฟล์รูปมีขนาดใหญ่เกินไป'); return; }
    if (preview) URL.revokeObjectURL(preview);
    setQrFile(file); setPreview(URL.createObjectURL(file));
  }

  async function submit(event) {
    event.preventDefault(); setMessage(''); setError(''); setPaymentAlert(null);
    const promptpayNumber = form.promptpayNumber.trim();
    const promptpayAccountName = form.accountName.trim();
    const bankName = form.bankName.trim();
    const bankAccountNumber = form.bankAccountNumber.trim();
    const bankAccountName = form.bankAccountName.trim();
    const promptPaySelected = Boolean(promptpayNumber || promptpayAccountName || qrFile);
    const bankSelected = Boolean(bankName || bankAccountNumber || bankAccountName);
    const missingFields = [];

    if (promptPaySelected) {
      if (!promptpayNumber) missingFields.push('เลขพร้อมเพย์');
      if (!promptpayAccountName) missingFields.push('ชื่อบัญชีพร้อมเพย์');
      if (!qrFile && !qrUrl) missingFields.push('รูป QR Code พร้อมเพย์');
    }
    if (bankSelected) {
      if (!bankName) missingFields.push('กรุณาเลือกธนาคาร');
      if (!bankAccountNumber) missingFields.push('เลขบัญชีธนาคาร');
      if (!bankAccountName) missingFields.push('ชื่อบัญชีธนาคาร');
    }

    if (missingFields.length > 0) {
      const alertMessage = bankSelected && !bankName
        ? 'ยังไม่ได้เลือกธนาคาร กรุณาเลือกธนาคารและกรอกข้อมูลบัญชีให้ครบ'
        : 'กรุณากรอกข้อมูลของช่องทางการชำระเงินที่เลือกให้ครบทุกช่อง';
      showPaymentAlert(alertMessage, missingFields);
      return;
    }

    const promptPayComplete = Boolean(promptpayNumber && promptpayAccountName && (qrFile || qrUrl));
    const bankComplete = Boolean(bankName && bankAccountNumber && bankAccountName);
    if (!promptPayComplete && !bankComplete) {
      showPaymentAlert(
        'ยังไม่ได้เลือกธนาคาร กรุณาเลือกธนาคารและกรอกข้อมูลบัญชีให้ครบ',
        ['กรุณาเลือกธนาคาร', 'เลขบัญชีธนาคาร', 'ชื่อบัญชีธนาคาร'],
      );
      return;
    }
    try {
      setSaving(true);
      const saved = await savePaymentSettings({
        promptpayNumber, accountName: promptpayAccountName, qrFile,
        bankName, bankAccountNumber, bankAccountName,
      });
      setQrUrl(saved.qr_image_url); setQrFile(null); setPreview(''); setMessage('บันทึกการตั้งค่าสำเร็จ');
    } catch (err) {
      showPaymentAlert(getThaiPaymentError(err), [], 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  if (loading) return <p>กำลังโหลดการตั้งค่า...</p>;
  const selectedBank = THAI_BANKS.find((bank) => bank.name === form.bankName);
  return <section className="admin-payment-settings">
    <div className="admin-section-heading"><div><p>Payment</p><h2>ตั้งค่าการชำระเงิน</h2></div></div>
    <form className="admin-payment-settings-form" onSubmit={submit}>
      <div className="admin-payment-settings-grid">
        <section className="admin-payment-settings-card">
          <header><p>QR Payment</p><h3>พร้อมเพย์</h3></header>
          <div className="admin-payment-qr-preview">{preview || qrUrl ? <img src={preview || qrUrl} alt="QR Code PromptPay ปัจจุบัน" /> : <span>ยังไม่มีรูป QR Code</span>}</div>
          <label>เลขพร้อมเพย์<input value={form.promptpayNumber} onChange={(e) => setForm((current) => ({ ...current, promptpayNumber: e.target.value }))} /></label>
          <label>ชื่อบัญชี<input value={form.accountName} onChange={(e) => setForm((current) => ({ ...current, accountName: e.target.value }))} /></label>
          <label className="admin-payment-file">เปลี่ยนรูป QR Code<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectQr} /></label>
        </section>
        <section className="admin-payment-settings-card">
          <header><p>Bank Transfer</p><h3>โอนผ่านบัญชีธนาคาร</h3></header>
          <div className="admin-bank-transfer-preview">
            {selectedBank
              ? <img src={selectedBank.logo} alt={`โลโก้${selectedBank.name}`} />
              : <span className="admin-bank-transfer-logo-fallback" aria-hidden="true">฿</span>}
            <div>
              <small>บัญชีสำหรับรับโอน</small>
              <strong>{form.bankName || 'กรุณาเลือกธนาคาร'}</strong>
            </div>
          </div>
          <label>
            เลือกธนาคาร
            <select
              value={form.bankName}
              onChange={(e) => setForm((current) => ({ ...current, bankName: e.target.value }))}
            >
              <option value="">-- เลือกธนาคาร --</option>
              {form.bankName && !selectedBank ? (
                <option value={form.bankName}>{form.bankName} (ข้อมูลเดิม)</option>
              ) : null}
              {THAI_BANKS.map((bank) => (
                <option key={bank.code} value={bank.name}>{bank.name}</option>
              ))}
            </select>
          </label>
          <label>เลขบัญชี<input value={form.bankAccountNumber} onChange={(e) => setForm((current) => ({ ...current, bankAccountNumber: e.target.value }))} /></label>
          <label>ชื่อบัญชีธนาคาร<input value={form.bankAccountName} onChange={(e) => setForm((current) => ({ ...current, bankAccountName: e.target.value }))} /></label>
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
