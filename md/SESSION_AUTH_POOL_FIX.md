# บันทึกการแก้ไข Session, JWT และ PostgreSQL Connection Pool

วันที่ดำเนินการ: 16 กรกฎาคม 2026

## อาการที่พบ

- หน้า Admin หลายหน้าโหลดข้อมูลไม่ได้พร้อมกัน
- Browser Console แสดง `401 Unauthorized`
- API ตอบ `SESSION_INVALID`
- บางช่วง Vite Proxy แสดง `502 Bad Gateway`
- `/api/auth/me` ใช้งานได้ใน request แรก แต่ล้มเหลวหลังเรียก `/api/admin/payments`
- ระบบแจ้งว่า `เซสชันหมดอายุหรือข้อมูลบัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่`

## ผลการตรวจสอบ

- บัญชีผู้ใช้ยังอยู่ใน Supabase และมีสถานะ `active`
- JWT สามารถตรวจสอบลายเซ็นได้
- Token มี `user_id`, `email` และ `role`
- `/api/auth/me` และ `/api/admin/payments` สามารถตอบ `200` ใน request แรก
- หลังเรียก `/api/admin/payments` ผล query ตรวจสอบผู้ใช้ใน request ถัดไปกลายเป็น array ว่าง ทำให้ Middleware เข้าใจผิดว่าไม่พบบัญชี

## ต้นเหตุหลัก

ปัญหาอยู่ที่ PostgreSQL compatibility adapter ใน `server/config/db.js`

ระบบครอบ `client.query` เพื่อแปลงผลลัพธ์จาก PostgreSQL ให้อยู่ในรูปแบบที่โค้ดเดิมซึ่งเขียนสำหรับ MySQL ใช้งานได้ แต่เมื่อ `connection.release()` คืน client กลับเข้าสู่ pool ตัว `client.query` ที่ถูกครอบไว้ไม่ได้ถูกคืนเป็น native query ของ `pg`

เมื่อ pool นำ client เดิมกลับมาใช้ผ่าน `pool.query` ผลลัพธ์จึงถูกแปลงซ้ำ ทำให้ผล `SELECT` ที่ควรมีข้อมูลกลายเป็น array ว่าง Middleware จึงตอบ:

```text
401 SESSION_INVALID
```

ปัญหานี้กระทบทุกหน้า Admin เพราะทุก API ใช้ Middleware ตรวจสอบ Session ตัวเดียวกัน

## การแก้ไข

### 1. คืน PostgreSQL client เป็นสภาพเดิมก่อน release

แก้ `server/config/db.js` ให้คืนค่าเหล่านี้ก่อนส่ง client กลับ pool:

- `client.query`
- `client.release`
- สถานะ wrapper ภายใน client

วิธีนี้ป้องกันการแปลงผล query ซ้ำเมื่อ pool นำ connection กลับมาใช้ใหม่

### 2. ปรับการตรวจ Session

Middleware ตรวจบัญชีจาก `user_id` เป็นหลัก และใช้ email ช่วยกู้ Session เมื่อ Token เก่าอ้าง `user_id` เดิม

หากข้อมูลใน Token ไม่ตรงกับบัญชีล่าสุด ระบบสามารถออก Token ใหม่ผ่าน `/api/auth/me`

### 3. เพิ่ม Session validation gate ฝั่ง Admin

Admin notification จะไม่เรียก API ต่อไปนี้จนกว่า `/api/auth/me` จะยืนยัน Session สำเร็จ:

```text
/api/admin/payments
/api/orders
```

### 4. ป้องกัน request ซ้ำหลัง Session ผิด

เมื่อพบ Token หมดอายุหรือ Session ไม่ถูกต้อง ระบบจะ:

- ลบ `token` และ `user` จาก Local Storage
- แจ้งเตือนเพียงครั้งเดียว
- หยุด Admin API หลัง Token ถูกลบ
- แสดงข้อความภาษาไทยในหน้า Login

### 5. เพิ่ม Auth Log แบบไม่เปิดเผยข้อมูลลับ

Backend บันทึกเฉพาะสาเหตุ เช่น:

```text
TOKEN_EXPIRED
TOKEN_INVALID
SESSION_ACCOUNT_NOT_FOUND
ACCOUNT_SUSPENDED
SESSION_REFRESHED
```

Log จะไม่แสดง JWT, password, database URL หรือ secret key

## การทดสอบหลังแก้ไข

ทดสอบ API ชุดต่อไปนี้ 10 รอบ รวม 30 requests:

```text
GET /api/auth/me
GET /api/admin/payments
GET /api/news/admin/all
```

ผลลัพธ์:

```text
ทุก request ตอบ 200
FAILURES=0
```

ตรวจเพิ่มเติมแล้ว:

- Production build ผ่าน
- JavaScript syntax ฝั่ง Server ผ่าน
- JWT จำลองที่มี `user_id` เก่าแต่ email ถูกต้องสามารถกู้ Session และออก Token ใหม่ได้

## ไฟล์ที่เกี่ยวข้อง

- `server/config/db.js`
- `server/middleware/auth.js`
- `server/utils/jwt.js`
- `src/context/AuthContext.jsx`
- `src/utils/session.js`
- `src/api/auth.js`
- `src/api/admin.js`
- `src/components/admin/AdminLayout.jsx`

## หมายเหตุการใช้งาน

หลังแก้ Backend ให้ restart Server หรือใช้ Nodemon เพื่อโหลดโค้ดใหม่:

```powershell
cd server
npm run dev
```

หาก Browser ยังถือ Token รุ่นเก่าที่ไม่สามารถกู้ได้ ระบบจะล้าง Session และให้เข้าสู่ระบบใหม่โดยอัตโนมัติ
