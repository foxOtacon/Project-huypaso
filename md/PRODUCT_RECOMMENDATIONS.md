# ระบบแนะนำสินค้า

ระบบนี้จัดอันดับสินค้าภายใน Backend โดยไม่ส่ง `user_id` หรือประวัติการดูสินค้าออกไปบริการภายนอก

## หลักการจัดอันดับ

สำหรับสมาชิกที่เข้าสู่ระบบ ระบบพิจารณาตามลำดับต่อไปนี้:

1. หมวดหมู่สินค้าที่ผู้ใช้เปิดดูบ่อย
2. จำนวนครั้งที่เปิดดูสินค้า
3. ความล่าสุดของการเปิดดู
4. ความนิยมของสินค้าในช่วง 90 วัน
5. สินค้าใหม่ที่ยังมีสต็อก

แสดงผลสูงสุด 3 รายการในส่วน “สินค้าแนะนำสำหรับคุณ” ของหน้าแรก พร้อมเหตุผลภาษาไทย หากยังไม่มีประวัติ ระบบจะแนะนำสินค้ายอดนิยมหรือสินค้าใหม่แทน

## API

### โหลดสินค้าแนะนำ

```http
POST /api/product-recommendations
Authorization: Bearer <customer-token>
Content-Type: application/json

{"limit":3}
```

`limit` รองรับ 1–5 รายการ Backend ใช้ `user_id` จาก JWT เท่านั้นและไม่รับ `user_id` จาก Browser

### บันทึกการเปิดดูรายละเอียดสินค้า

```http
POST /api/user-product-views/:productId
Authorization: Bearer <customer-token>
```

Frontend เรียก endpoint นี้เมื่อสมาชิกกด “ดูเพิ่มเติม” และป้องกันการนับซ้ำภายใน 30 วินาที

## ฐานข้อมูล

รันส่วน index ของ `user_product_views` จาก `server/database/supabase-schema.sql` ผ่าน Supabase SQL Editor:

```sql
CREATE INDEX IF NOT EXISTS user_product_views_user_recent_idx
    ON user_product_views (user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS user_product_views_product_recent_idx
    ON user_product_views (product_id, viewed_at DESC);
```

คำสั่งนี้ไม่ลบหรือแก้ไขประวัติเดิม

## การตั้งค่า

เพิ่มใน `server/.env` หากต้องการเปลี่ยนเวลา cache จากค่าเริ่มต้น 2 นาที:

```env
RECOMMENDATIONS_CACHE_TTL_MS=120000
```

Restart Backend หลังเปลี่ยนค่า

## หมายเหตุเกี่ยวกับ n8n/Gemini

workflow ที่แนบมาส่ง `user_id` และพฤติกรรมผู้ใช้ออกไปยัง n8n/Gemini จึงยังไม่ถูกเชื่อมในโค้ด production รอบนี้ หากต้องการเปิดใช้ AI ภายนอก ควรได้รับความยินยอมด้านข้อมูลผู้ใช้ก่อน ตั้ง Header Auth ให้ Webhook และให้ Backend ตรวจผล AI กับข้อมูลสินค้าในฐานข้อมูลอีกครั้งเสมอ
