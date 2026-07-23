# n8n: วิเคราะห์และพยากรณ์ยอดขายอัตโนมัติ

Ready-to-import workflow: `md/n8n-huypaso-sales-analysis.json`

After import, select the Webhook Header Auth credential (`x-webhook-key` = `N8N_WEBHOOK_KEY`), verify the Supabase service-role credential on every HTTP Request node, then publish the workflow.

## 1. เตรียมฐานข้อมูลและ Backend

รันส่วน `sales_prediction`, `analysis_runs` และ indexes จาก `server/database/supabase-schema.sql` ใน Supabase SQL Editor

เพิ่มค่าใน `server/.env`:

```env
N8N_API_KEY=สร้างค่าสุ่มยาวอย่างน้อย_32_ตัวอักษร
ANALYTICS_HASH_SALT=สร้างค่าสุ่มอีกค่าหนึ่งและห้ามซ้ำกับ_API_key
N8N_SALES_ANALYSIS_WEBHOOK_URL=https://tumphirawit.app.n8n.cloud/webhook/huypaso-sales-analysis
N8N_WEBHOOK_KEY=สร้างค่าสุ่มสำหรับ_Header_Auth_ของ_Webhook
N8N_WEBHOOK_TIMEOUT_MS=5000
ANALYTICS_RUN_STALE_MINUTES=30
```

Restart backend หลังแก้ `.env` และห้าม commit ค่าจริงลง Git

## 2. ตั้งค่า Webhook node ใน n8n

ตั้งค่า production Webhook:

```text
HTTP Method: POST
Path: huypaso-sales-analysis
Authentication: Header Auth
Header Name: x-webhook-key
Header Value: ค่าเดียวกับ N8N_WEBHOOK_KEY
Respond: Immediately
```

การตอบทันทีสำคัญสำหรับ Vercel เพราะ Backend รอเฉพาะการยืนยันรับงาน ไม่รอ AI วิเคราะห์จนเสร็จ

Payload ที่ได้รับจาก Backend อยู่ใน `$json.body`:

```json
{
  "run_id": 15,
  "requested_by": 1,
  "months": 12,
  "requested_at": "2026-07-24T00:00:00.000Z"
}
```

## 3. Workflow ใน n8n

ลำดับที่แนะนำ:

```text
Webhook
  → Edit Fields: เก็บ run_id และ months
  → PostgreSQL: Mark run as running
  → PostgreSQL: Read analysis data from Supabase
  → AI: Analyze sales
  → Code: Normalize predictions
  → PostgreSQL: Upsert predictions and complete run
```

### Mark run as running

ใช้ Supabase PostgreSQL Credential และ Query Parameter `$1 = run_id`:

```sql
UPDATE analysis_runs
SET status = 'running',
    started_at = COALESCE(started_at, NOW()),
    error_message = NULL
WHERE run_id = $1
  AND status IN ('queued', 'running')
RETURNING *;
```

### อ่านข้อมูลจาก Supabase

ใช้ PostgreSQL nodes อ่าน `products`, `categories`, `orders`, `order_items` และ `user_product_views` โดยตรง แล้วรวมเป็น JSON ก่อนส่งให้ AI ห้ามส่งชื่อ อีเมล เบอร์โทร หรือที่อยู่ลูกค้าให้ AI

### บันทึก Predictions และปิดงาน

Code node ต้องคืน `{ predictions: [...] }` และเก็บ `run_id` ไว้ จากนั้นใช้ Query Parameters:

```text
$1 = run_id
$2 = JSON.stringify(predictions)
```

```sql
WITH incoming AS (
  SELECT *
  FROM jsonb_to_recordset($2::jsonb) AS item(
    product_id BIGINT,
    predicted_quantity INT,
    predicted_month DATE
  )
),
saved AS (
  INSERT INTO sales_prediction (product_id, predicted_quantity, predicted_month)
  SELECT product_id, predicted_quantity, predicted_month
  FROM incoming
  ON CONFLICT (product_id, predicted_month)
  DO UPDATE SET
    predicted_quantity = EXCLUDED.predicted_quantity,
    created_at = NOW()
  RETURNING prediction_id
)
UPDATE analysis_runs
SET status = 'completed',
    result_count = (SELECT COUNT(*) FROM saved),
    error_message = NULL,
    completed_at = NOW()
WHERE run_id = $1
  AND status IN ('queued', 'running')
RETURNING *;
```

### เมื่อ Workflow ผิดพลาด

เก็บ `run_id` ตั้งแต่ต้น workflow และต่อ error output ของ node สำคัญไปยัง PostgreSQL node นี้:

```sql
UPDATE analysis_runs
SET status = 'failed',
    error_message = LEFT($2, 1000),
    completed_at = NOW()
WHERE run_id = $1
  AND status IN ('queued', 'running')
RETURNING *;
```

เมื่อสถานะเป็น `completed` หรือ `failed` หน้า Admin จะหยุด polling โดยอัตโนมัติ

## 4. Prompt สำหรับ AI node

```text
คุณเป็นนักวิเคราะห์ยอดขายสินค้าเกษตร วิเคราะห์ข้อมูล JSON ที่ได้รับ โดยพิจารณา
ยอดขายรายเดือน รายได้ จำนวนลูกค้า การเข้าชมสินค้า อัตราเปลี่ยนจากการชมเป็นซื้อ
ฤดูกาล และสินค้าคงเหลือ พยากรณ์จำนวนที่จะขายในเดือนถัดไปสำหรับสินค้าทุกชิ้น

ข้อกำหนด:
- predicted_quantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป
- predicted_month ต้องเป็นวันแรกของเดือนถัดไปในรูป YYYY-MM-01
- ห้ามสร้าง product_id ที่ไม่มีใน input
- คืนเฉพาะ JSON ที่ valid ไม่มี markdown และไม่มีคำอธิบายนอก JSON

รูปแบบผลลัพธ์:
{"predictions":[{"product_id":1,"predicted_quantity":25,"predicted_month":"2026-08-01"}]}

ข้อมูลสำหรับวิเคราะห์:
{{ JSON.stringify($json.data) }}
```

## 5. Code node สำหรับตรวจผล AI

```javascript
const output = $json.output ?? $json.text ?? $json;
const parsed = typeof output === 'string' ? JSON.parse(output) : output;
if (!Array.isArray(parsed.predictions) || parsed.predictions.length === 0) {
  throw new Error('AI did not return predictions');
}
return [{ json: {
  predictions: parsed.predictions.map((item) => ({
    product_id: Number(item.product_id),
    predicted_quantity: Math.max(0, Math.round(Number(item.predicted_quantity))),
    predicted_month: String(item.predicted_month).slice(0, 10),
  })),
} }];
```

## ข้อมูลผู้ใช้ที่ส่งให้ AI

API ส่งเฉพาะยอดรวมลูกค้าและพฤติกรรมการดูสินค้า โดยแทน `user_id` ด้วย hash
แบบระบุตัวบุคคลไม่ได้ ไม่ส่งชื่อ อีเมล รหัสผ่าน เบอร์โทร หรือที่อยู่ไปยัง n8n/AI
