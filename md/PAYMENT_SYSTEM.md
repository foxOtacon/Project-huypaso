# PromptPay Slip Payment

เอกสารนี้อธิบายระบบชำระเงิน PromptPay แบบโอนเงินและแนบสลิปสำหรับโปรเจกต์นี้

## ภาพรวม

ระบบปัจจุบันใช้การโอนผ่าน PromptPay และตรวจสลิปโดยแอดมินเท่านั้น

Flow การทำงาน:

1. ลูกค้าเลือกสินค้าและกรอกข้อมูลจัดส่ง
2. Frontend เรียก `POST /api/payment/create-order`
3. Backend สร้าง order และตัด stock
4. Frontend เรียก `GET /api/payment/promptpay/:orderId`
5. Backend สร้าง QR PromptPay จาก `PROMPTPAY_ID`
6. ลูกค้าโอนเงินผ่าน PromptPay
7. ลูกค้าแนบสลิป
8. Frontend ส่งสลิปไปที่ `POST /api/payment/upload-slip`
9. Admin ตรวจสลิปและกด approve / reject

## Environment

ตั้งค่าเบอร์ PromptPay ได้ใน `server/.env`

```env
PROMPTPAY_ID=0634126252
```

ถ้าไม่ตั้งค่า ระบบจะใช้ค่าเริ่มต้น `0634126252`

## API

### Create Order

```http
POST /api/payment/create-order
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "items": [
    { "product_id": 1, "quantity": 2 }
  ],
  "shipping_name": "Customer Name",
  "shipping_phone": "0812345678",
  "shipping_address": "Address"
}
```

### Generate PromptPay QR

```http
GET /api/payment/promptpay/:orderId
```

ยอดชำระต้องไม่น้อยกว่า 20 บาท

### Upload Slip

```http
POST /api/payment/upload-slip
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Fields:

- `orderId`
- `paymentMethod` = `promptpay`
- `slip` = jpg / jpeg / png ขนาดไม่เกิน 5MB

### Admin Review

```http
GET /api/payment/admin/payments
PUT /api/payment/admin/payment/:id/approve
PUT /api/payment/admin/payment/:id/reject
```

## Files

- `src/pages/PaymentPage.jsx` หน้า checkout และอัปโหลดสลิป
- `src/api/checkout.js` API helper สำหรับ order, QR, slip
- `server/routes/payment.js` route ระบบชำระเงิน
- `server/controllers/paymentController.js` controller
- `server/services/paymentService.js` business logic
- `server/models/paymentModel.js` query order/payment

## หมายเหตุ

QR ที่สร้างจาก `promptpay-qr` เป็น QR สำหรับโอนเงินโดยตรง ไม่ใช่ gateway payment จึงไม่มี webhook ยืนยันเงินเข้าอัตโนมัติ ระบบต้องให้ admin ตรวจสลิปก่อนอนุมัติคำสั่งซื้อ
