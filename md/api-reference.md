# API Reference — Huypaso

เอกสารนี้สรุป API จากโค้ดใน `server/index.js` และ `server/routes/*` ตามสถานะปัจจุบันของโปรเจกต์

อัปเดตล่าสุด: 24 กรกฎาคม 2026

## Base URL

ระหว่างพัฒนาในเครื่อง:

```text
http://localhost:5000
```

เมื่อ deploy:

```text
https://<backend-domain>
```

ตัวอย่าง URL เต็ม:

```text
http://localhost:5000/api/products
```

## รูปแบบการยืนยันตัวตน

| ชื่อในเอกสาร | Header | ผู้เรียก |
|---|---|---|
| Public | ไม่ต้องส่ง | ทุกคน |
| JWT | `Authorization: Bearer <token>` | ผู้ใช้ที่เข้าสู่ระบบ |
| Admin | `Authorization: Bearer <token>` | ผู้ใช้ role `admin` |
| Automation | `x-automation-key: <N8N_API_KEY>` | Backend/n8n เท่านั้น |

ตัวอย่าง JWT:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

ตัวอย่าง n8n:

```http
x-automation-key: <ค่าที่ตรงกับ N8N_API_KEY>
```

## รูปแบบ Response

สำเร็จ:

```json
{
  "success": true,
  "data": {}
}
```

ผิดพลาด:

```json
{
  "success": false,
  "message": "ข้อความอธิบาย"
}
```

สถานะที่พบบ่อย:

| Status | ความหมาย |
|---|---|
| `200` | สำเร็จ |
| `201` | สร้างข้อมูลสำเร็จ |
| `400` | Body, parameter หรือ foreign key ไม่ถูกต้อง |
| `401` | ไม่มี token/key หรือ token/key ไม่ถูกต้อง |
| `403` | ไม่มีสิทธิ์หรือบัญชีถูกระงับ |
| `404` | ไม่พบข้อมูลหรือ route |
| `409` | ข้อมูลซ้ำหรือสถานะขัดแย้ง |
| `410` | คำสั่งซื้อหมดอายุ |
| `500` | ข้อผิดพลาดภายในเซิร์ฟเวอร์ |

## คำเตือนด้านความปลอดภัย

API CRUD ต่อไปนี้ยังไม่มี middleware ตรวจ JWT ในโค้ดปัจจุบัน จึงเป็น Public ทั้งการอ่าน เพิ่ม แก้ไข และลบ:

- `/api/users`
- `/api/categories`
- `/api/products`
- `/api/cart`
- `/api/cart-items`
- CRUD ของ `/api/orders`
- `/api/order-items`
- `/api/payments`
- `/api/user-product-views`
- `/api/uploads`
- `/api/shipping-carriers`

ไม่ควรเปิด backend นี้ต่ออินเทอร์เน็ตใน production จนกว่าจะกำหนด authentication และ authorization ให้ endpoint เหล่านี้

## 1. API Status

### `GET /`

สิทธิ์: Public

ใช้ตรวจว่า API ทำงานอยู่

Response `200`:

```json
{
  "success": true,
  "message": "Village Products API",
  "endpoints": {}
}
```

## 2. Authentication — `/api/auth`

### Endpoint

| Method | Endpoint | สิทธิ์ | Input | ผลลัพธ์ |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | JSON สมัครสมาชิก | `201` user และ JWT |
| `POST` | `/api/auth/login` | Public | `email`, `password` | `200` user และ JWT |
| `POST` | `/api/auth/google` | Public | `credential` จาก Google | `200` user และ JWT |
| `GET` | `/api/auth/google/start` | Public | ไม่มี | Redirect ไป Google |
| `GET` | `/api/auth/google/callback` | Public | Query `code` หรือ `error` | Redirect กลับ frontend |
| `GET` | `/api/auth/me` | JWT | ไม่มี | ข้อมูลบัญชีปัจจุบัน |
| `PUT` | `/api/auth/me` | JWT | JSON ฟิลด์ที่ต้องการแก้ | ข้อมูลบัญชีล่าสุด |

### สมัครสมาชิก

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "full_name": "สมชาย ใจดี",
  "email": "somchai@example.com",
  "password": "12345678",
  "phone": "0812345678",
  "address": "เชียงใหม่"
}
```

ฟิลด์บังคับ: `full_name`, `email`, `password` โดยรหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร

### เข้าสู่ระบบ

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "somchai@example.com",
  "password": "12345678"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {},
    "token": "<JWT>"
  }
}
```

### แก้ไขบัญชีตัวเอง

ฟิลด์ที่อนุญาต:

```text
full_name, email, phone, address, password
```

ต้องส่งอย่างน้อยหนึ่งฟิลด์ รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร

### Auth errors

| สถานการณ์ | Status/code |
|---|---|
| ไม่มี Bearer token | `401 Unauthorized` |
| Token หมดอายุ | `401 TOKEN_EXPIRED` |
| Token ไม่ถูกต้อง | `401 TOKEN_INVALID` |
| Session ไม่ตรงกับบัญชี | `401 SESSION_INVALID` |
| บัญชีถูกระงับ | `403 ACCOUNT_SUSPENDED` |
| Role ไม่ผ่าน | `403 Forbidden` |

## 3. Users — `/api/users`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Body | Response |
|---|---|---|---|
| `GET` | `/api/users` | ไม่มี | ผู้ใช้ทั้งหมด |
| `GET` | `/api/users/:id` | ไม่มี | ผู้ใช้ตาม ID |
| `POST` | `/api/users` | ดูฟิลด์ด้านล่าง | `201` ผู้ใช้ใหม่ |
| `PUT` | `/api/users/:id` | ฟิลด์ที่ต้องการแก้ | ผู้ใช้ล่าสุด |
| `DELETE` | `/api/users/:id` | ไม่มี | ข้อความยืนยัน |

สร้างผู้ใช้:

```json
{
  "full_name": "Admin",
  "email": "admin@example.com",
  "password": "12345678",
  "role": "admin",
  "phone": "0812345678",
  "address": "เชียงใหม่",
  "status": "active"
}
```

ฟิลด์บังคับ: `full_name`, `email`, `password`

ค่าเริ่มต้น: `role = customer`, `status = active`

ฟิลด์แก้ไข:

```text
full_name, email, password, password_hash, role, phone, address, status
```

Response จะตัด `password_hash` ออก

## 4. รูปแบบ CRUD มาตรฐาน

Resource ในหัวข้อต่อไปนี้ใช้ controller รูปแบบเดียวกัน:

| Method | รูปแบบ Endpoint | การทำงาน |
|---|---|---|
| `GET` | `/resource` | อ่านทั้งหมด เรียง ID จากมากไปน้อย |
| `GET` | `/resource/:id` | อ่านหนึ่งรายการ |
| `POST` | `/resource` | สร้างรายการ |
| `PUT` | `/resource/:id` | แก้ไขฟิลด์ที่ส่งมา |
| `DELETE` | `/resource/:id` | ลบรายการ |

Query filter, search และ pagination ยังไม่รองรับใน generic CRUD

Response ของการอ่านทั้งหมด:

```json
{
  "success": true,
  "data": []
}
```

## 5. Categories — `/api/categories`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/categories` | ไม่มี |
| `GET` | `/api/categories/:id` | Path `id` |
| `POST` | `/api/categories` | `category_name` บังคับ |
| `PUT` | `/api/categories/:id` | `category_name` |
| `DELETE` | `/api/categories/:id` | Path `id` |

```json
{
  "category_name": "กาแฟ"
}
```

## 6. Products — `/api/products`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/products` | ไม่มี |
| `GET` | `/api/products/:id` | Path `id` |
| `POST` | `/api/products` | JSON สินค้า |
| `PUT` | `/api/products/:id` | ฟิลด์สินค้าที่ต้องการแก้ |
| `DELETE` | `/api/products/:id` | Path `id` |

สร้างสินค้า:

```json
{
  "product_name": "กาแฟคั่ว",
  "category_id": 1,
  "description": "กาแฟจากชุมชน",
  "price": 250,
  "unit": "ถุง",
  "image_url": "/uploads/products/coffee.jpg",
  "production_source": "ห้วยหยวกปากโซ",
  "stock_quantity": 20,
  "created_by": 1
}
```

ฟิลด์บังคับ:

```text
product_name, category_id, unit, created_by
```

ฟิลด์ที่อนุญาต:

```text
product_name, category_id, description, price, unit,
image_url, production_source, stock_quantity, created_by
```

## 7. News — `/api/news`

| Method | Endpoint | สิทธิ์ | Input/ผลลัพธ์ |
|---|---|---|---|
| `GET` | `/api/news` | Public | ข่าว `published` ทั้งหมด |
| `GET` | `/api/news/:id` | Public | ข่าว `published` ตาม ID |
| `GET` | `/api/news/admin/all` | Admin | ข่าวทุกสถานะ |
| `POST` | `/api/news` | Admin | สร้างข่าว |
| `PUT` | `/api/news/:id` | Admin | แก้ข่าว |
| `DELETE` | `/api/news/:id` | Admin | ลบข่าว |

สร้างข่าว:

```json
{
  "title": "ข่าวชุมชน",
  "summary": "สรุปข่าว",
  "content": "เนื้อหาข่าว",
  "image_url": "/uploads/news/example.jpg",
  "category": "กิจกรรม",
  "status": "published"
}
```

ฟิลด์บังคับ: `title`, `content`

ฟิลด์ที่อนุญาต:

```text
title, summary, content, image_url, category, status, created_by
```

สถานะ: `draft` หรือ `published`

## 8. Cart — `/api/cart`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/cart` | ไม่มี |
| `GET` | `/api/cart/:id` | Path `id` |
| `POST` | `/api/cart` | `user_id` บังคับ |
| `PUT` | `/api/cart/:id` | `user_id` |
| `DELETE` | `/api/cart/:id` | Path `id` |

## 9. Cart Items — `/api/cart-items`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/cart-items` | ไม่มี |
| `GET` | `/api/cart-items/:id` | Path `id` |
| `POST` | `/api/cart-items` | `cart_id`, `product_id` บังคับ |
| `PUT` | `/api/cart-items/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/cart-items/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
cart_id, product_id, quantity, unit_price
```

## 10. Orders — `/api/orders`

### รายการสั่งซื้อของผู้ใช้

| Method | Endpoint | สิทธิ์ | ผลลัพธ์ |
|---|---|---|---|
| `GET` | `/api/orders/my` | JWT | Order ของผู้ใช้ปัจจุบัน พร้อมข้อมูล payment |
| `GET` | `/api/orders/my/:id` | JWT | Order ของผู้ใช้ พร้อม `items` |

`GET /api/orders/my/:id` ตรวจว่า order เป็นของผู้ใช้ หากไม่ใช่จะตอบ `404`

### Orders CRUD

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/orders` | ไม่มี |
| `GET` | `/api/orders/:id` | Path `id` |
| `POST` | `/api/orders` | `user_id` บังคับ |
| `PUT` | `/api/orders/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/orders/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
user_id, total_amount, order_status,
shipping_name, shipping_phone, shipping_address,
tracking_number, shipping_carrier, tracking_url
```

## 11. Order Items — `/api/order-items`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/order-items` | ไม่มี |
| `GET` | `/api/order-items/:id` | Path `id` |
| `POST` | `/api/order-items` | `order_id`, `product_id` บังคับ |
| `PUT` | `/api/order-items/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/order-items/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
order_id, product_id, quantity, price
```

## 12. Payments CRUD — `/api/payments`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/payments` | ไม่มี |
| `GET` | `/api/payments/:id` | Path `id` |
| `POST` | `/api/payments` | `order_id`, `payment_method` บังคับ |
| `PUT` | `/api/payments/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/payments/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
order_id, slip_image, amount, payment_method,
payment_status, transaction_ref, payment_date
```

## 13. Checkout — `/api/checkout`

### `POST /api/checkout`

สิทธิ์: JWT และ role `customer` หรือ `user`

Endpoint นี้สร้าง order, order items และ payment พร้อมตัด stock ใน transaction เดียว

```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    }
  ],
  "shipping_name": "ชื่อผู้รับ",
  "shipping_phone": "0812345678",
  "shipping_address": "ที่อยู่จัดส่ง",
  "payment_method": "promptpay",
  "transaction_ref": "optional",
  "slip_image": "/uploads/slips/example.jpg"
}
```

เงื่อนไข:

- `items` ต้องมีอย่างน้อยหนึ่งรายการ
- `shipping_name`, `shipping_phone`, `shipping_address` บังคับ
- `payment_method` เป็น `promptpay` หรือ `bank_transfer`
- `slip_image` บังคับ
- ตรวจสินค้าและ stock ก่อนสร้าง order
- หากไม่ส่ง `transaction_ref` ระบบใช้ `ORD<orderId>`

Response `201`:

```json
{
  "success": true,
  "data": {
    "order": {},
    "payment": {}
  }
}
```

## 14. Payment Workflow — `/api/payment`

### สร้างคำสั่งซื้อ

```http
POST /api/payment/create-order
Authorization: Bearer <token>
Content-Type: application/json
```

สิทธิ์: JWT และ role `customer` หรือ `user`

```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    }
  ],
  "shipping_name": "ชื่อผู้รับ",
  "shipping_phone": "0812345678",
  "shipping_address": "ที่อยู่จัดส่ง"
}
```

สำเร็จ `201` ระบบสร้าง order, order items และตัด stock แต่ยังไม่สร้าง payment

### สร้าง PromptPay QR

```http
GET /api/payment/promptpay/:orderId
```

สิทธิ์ปัจจุบัน: Public

เงื่อนไข:

- `orderId` เป็นจำนวนเต็มมากกว่า 0
- ยอดชำระขั้นต่ำ 20 บาท
- Order ที่หมดอายุจะตอบ `410`

Response:

```json
{
  "success": true,
  "order_id": 1,
  "orderId": 1,
  "amount": 500,
  "promptPayId": "...",
  "qr_code": "data:image/png;base64,...",
  "qrCode": "data:image/png;base64,...",
  "expired_at": "2026-07-23T10:00:00.000Z",
  "expires_in_seconds": 600
}
```

### อัปโหลดสลิป

```http
POST /api/payment/upload-slip
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| Field | ชนิด | เงื่อนไข |
|---|---|---|
| `slip` | File | JPG/JPEG/PNG สูงสุด 5 MB |
| `orderId` | Integer | บังคับ |
| `paymentMethod` | String | `promptpay` หรือ `bank_transfer`; ค่าเริ่มต้น `promptpay` |

Response `201`:

```json
{
  "success": true,
  "message": "Upload Success"
}
```

ข้อควรระวัง: Endpoint นี้ตรวจ JWT แต่ยังไม่ตรวจว่า `orderId` เป็นของผู้ใช้ที่ส่ง request

### ยกเลิกคำสั่งซื้อ

```http
DELETE /api/payment/order/:orderId
Authorization: Bearer <token>
```

สิทธิ์: JWT และ role `customer` หรือ `user`

ยกเลิกได้เฉพาะ order `pending` ที่เป็นของผู้ใช้และยังไม่มี payment ระบบจะคืน stock

### จัดการการชำระเงินสำหรับ Admin

| Method | Endpoint | สิทธิ์ | การทำงาน |
|---|---|---|---|
| `GET` | `/api/payment/admin/payments` | Admin | อ่านรายการชำระเงิน |
| `PUT` | `/api/payment/admin/payment/:id/approve` | Admin | อนุมัติและเปลี่ยน order เป็น `shipping` |
| `PUT` | `/api/payment/admin/payment/:id/reject` | Admin | ปฏิเสธ ยกเลิก order และคืน stock |

Alias ที่เรียก controller ชุดเดียวกัน:

| Method | Endpoint |
|---|---|
| `GET` | `/api/admin/payments` |
| `PUT` | `/api/admin/payment/:id/approve` |
| `PUT` | `/api/admin/payment/:id/reject` |

Alias ทั้งหมดต้องใช้สิทธิ์ Admin

## 15. Uploads — `/api/uploads`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | โฟลเดอร์ผลลัพธ์ |
|---|---|---|
| `POST` | `/api/uploads/product-image` | `/uploads/products/` |
| `POST` | `/api/uploads/payment-slip` | `/uploads/payments/` |
| `POST` | `/api/uploads/news-image` | `/uploads/news/` |

Body:

```json
{
  "fileName": "coffee.jpg",
  "dataUrl": "data:image/jpeg;base64,..."
}
```

รองรับ:

```text
image/jpeg, image/png, image/webp, image/gif
```

ขนาดไฟล์หลังถอด base64 สูงสุด 5 MB

Response `201`:

```json
{
  "success": true,
  "data": {
    "url": "/uploads/products/generated-name.jpg"
  }
}
```

ไฟล์อ่านผ่าน URL `/uploads/<folder>/<filename>` โดยไม่ใช้ prefix `/api`

หมายเหตุ: ปัจจุบันบันทึกลง local filesystem ซึ่งไม่เหมาะกับ Vercel production ควรเปลี่ยนเป็น Supabase Storage

## 16. Shipping Carriers — `/api/shipping-carriers`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/shipping-carriers` | ไม่มี |
| `GET` | `/api/shipping-carriers/:id` | Path `id` |
| `POST` | `/api/shipping-carriers` | `carrier_name` บังคับ |
| `PUT` | `/api/shipping-carriers/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/shipping-carriers/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
carrier_name, tracking_url, description, status
```

สถานะ: `active` หรือ `inactive`

## 17. Sales Prediction — `/api/sales-prediction`

สิทธิ์: Admin ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/sales-prediction` | ไม่มี |
| `GET` | `/api/sales-prediction/:id` | Path `id` |
| `POST` | `/api/sales-prediction` | `product_id`, `predicted_month` บังคับ |
| `PUT` | `/api/sales-prediction/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/sales-prediction/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
product_id, predicted_quantity, predicted_month
```

ตัวอย่าง:

```json
{
  "product_id": 1,
  "predicted_quantity": 25,
  "predicted_month": "2026-08-01"
}
```

## 18. User Product Views — `/api/user-product-views`

สิทธิ์ปัจจุบัน: Public ทุก endpoint

| Method | Endpoint | Input |
|---|---|---|
| `GET` | `/api/user-product-views` | ไม่มี |
| `GET` | `/api/user-product-views/:id` | Path `id` |
| `POST` | `/api/user-product-views` | `user_id`, `product_id` บังคับ |
| `PUT` | `/api/user-product-views/:id` | ฟิลด์ที่อนุญาต |
| `DELETE` | `/api/user-product-views/:id` | Path `id` |

ฟิลด์ที่อนุญาต:

```text
user_id, product_id, view_count
```

## 19. Automation/n8n — `/api/automation`

ทุก endpoint ในหมวดนี้ต้องส่ง:

```http
x-automation-key: <N8N_API_KEY>
```

### อ่านข้อมูลสำหรับวิเคราะห์

```http
GET /api/automation/analysis-data?months=12
```

Query:

| ชื่อ | ค่าเริ่มต้น | ช่วง |
|---|---:|---:|
| `months` | `12` | `1–36` |

Response:

```json
{
  "success": true,
  "generated_at": "2026-07-23T00:00:00.000Z",
  "period_months": 12,
  "data": {
    "products": [],
    "sales_history": [],
    "user_summary": {},
    "user_behavior": []
  }
}
```

`user_behavior` ไม่ส่งข้อมูลส่วนบุคคลโดยตรง และแทน `user_id` ด้วย `anonymous_user_id` ที่ hash แล้ว

### บันทึกผลพยากรณ์

```http
POST /api/automation/predictions
Content-Type: application/json
x-automation-key: <N8N_API_KEY>
```

```json
{
  "predictions": [
    {
      "product_id": 1,
      "predicted_quantity": 25,
      "predicted_month": "2026-08-01"
    }
  ]
}
```

เงื่อนไข:

- `predictions` ต้องมี 1–500 รายการ
- `product_id` เป็นจำนวนเต็มมากกว่า 0
- `predicted_quantity` เป็นจำนวนเต็มตั้งแต่ 0
- `predicted_month` ต้องเป็น `YYYY-MM-01`
- ใช้ upsert ด้วยคู่ `product_id + predicted_month`

Response:

```json
{
  "success": true,
  "saved_count": 1,
  "data": []
}
```

Automation errors:

| สถานการณ์ | Status/message |
|---|---|
| ไม่ส่ง key | `401 Automation key is required` |
| Key ไม่ตรง | `401 Invalid automation key` |
| Predictions ว่าง/เกิน 500 | `400` |
| รูปแบบ prediction ไม่ถูกต้อง | `400` |

## 20. Admin Analytics Runs — `/api/admin/analytics`

ทุก endpoint ใช้สิทธิ์ Admin และ Frontend จะไม่เรียก n8n Webhook โดยตรง

### โหลดผลและสถานะล่าสุด

```http
GET /api/admin/analytics/latest
Authorization: Bearer <admin-token>
```

Response:

```json
{
  "success": true,
  "data": {
    "run": {
      "run_id": 15,
      "status": "completed",
      "result_count": 8,
      "error_message": null
    },
    "predictions": []
  }
}
```

`predictions` จะเป็นผลของ `predicted_month` ล่าสุด พร้อมชื่อ ราคา หน่วย และหมวดหมู่สินค้า

### ตรวจสถานะงาน

```http
GET /api/admin/analytics/status/:runId
Authorization: Bearer <admin-token>
```

สถานะที่เป็นไปได้:

```text
queued → running → completed
                 ↘ failed
```

### เริ่มวิเคราะห์ใหม่

```http
POST /api/admin/analytics/run
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "months": 12
}
```

- `months` มีค่า `1–36` และค่าเริ่มต้น `12`
- หากมีงาน `queued/running` อยู่แล้ว ตอบ `409` พร้อมงานเดิม
- หาก n8n รับงานสำเร็จ ตอบ `202`
- หาก n8n ตอบ ACK ไม่ทันภายในเวลาที่กำหนด Backend ยังตอบ `202`, คงสถานะ `queued` และส่ง `meta.webhookAcknowledged: false` เพื่อให้หน้า Admin polling ต่อ
- HTTP error หรือ network error ที่ยืนยันได้จะตอบ `502` และเปลี่ยนงานเป็น `failed`
- Backend ส่ง `Idempotency-Key: analysis-run-<runId>` ไปยัง n8n
- งานที่ค้างเกิน `ANALYTICS_RUN_STALE_MINUTES` จะถูกเปลี่ยนเป็น `failed`

Payload ที่ Backend ส่งไป n8n Webhook:

```json
{
  "run_id": 15,
  "requested_by": 1,
  "months": 12,
  "requested_at": "2026-07-24T00:00:00.000Z"
}
```

Environment variables ฝั่ง Backend:

```env
N8N_SALES_ANALYSIS_WEBHOOK_URL=https://<n8n-domain>/webhook/huypaso-sales-analysis
N8N_WEBHOOK_KEY=<header-auth-secret>
N8N_WEBHOOK_TIMEOUT_MS=5000
ANALYTICS_RUN_STALE_MINUTES=30
```

n8n ต้องอัปเดต `analysis_runs` เป็น `running` เมื่อเริ่ม และเป็น `completed` หรือ `failed` เมื่อจบ เพื่อให้หน้า Admin หยุด polling และโหลดผลล่าสุด

## 21. ตัวอย่างเรียก API

### curl: Login

```bash
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"12345678"}'
```

### curl: เรียก API ด้วย JWT

```bash
curl "http://localhost:5000/api/auth/me" \
  -H "Authorization: Bearer <token>"
```

### curl: เรียก Automation API

```bash
curl "http://localhost:5000/api/automation/analysis-data?months=12" \
  -H "x-automation-key: <N8N_API_KEY>"
```

### JavaScript

```javascript
const response = await fetch(
  'http://localhost:5000/api/automation/analysis-data?months=12',
  {
    headers: {
      'x-automation-key': '<N8N_API_KEY>',
    },
  },
);

const result = await response.json();
```

## 22. Source Mapping

| หมวด | Source |
|---|---|
| Route mounting และ global errors | `server/index.js` |
| JWT/Admin middleware | `server/middleware/auth.js` |
| n8n authentication | `server/middleware/automationAuth.js` |
| Generic CRUD | `server/utils/crudController.js` |
| Authentication | `server/routes/auth.js` |
| Users | `server/routes/users.js` |
| Products/Categories | `server/routes/products.js`, `server/routes/categories.js` |
| Orders/Cart | `server/routes/orders.js`, `server/routes/cart.js`, `server/routes/cartItems.js` |
| Payment | `server/routes/payment.js`, `server/routes/checkout.js`, `server/routes/adminPayment.js` |
| News/Uploads | `server/routes/news.js`, `server/routes/uploads.js` |
| Analytics/n8n | `server/routes/adminAnalytics.js`, `server/routes/automation.js`, `server/routes/salesPrediction.js` |
