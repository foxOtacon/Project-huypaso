import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAnalysisRunStatus,
  fetchCategories,
  fetchLatestAnalysis,
  fetchOrderItems,
  fetchOrders,
  fetchProducts,
  fetchUsers,
  startAnalysis,
} from '../../api/admin';
import { formatCurrency } from '../../utils/dashboardStats';

const periods = [[7, '7 วัน'], [30, '30 วัน'], [365, '1 ปี']];
const sum = (rows) => rows.reduce((total, row) => total + Number(row.total_amount || 0), 0);
const change = (now, before) => before ? (now - before) / before * 100 : now ? 100 : 0;

function Trend({ value }) {
  return <small className={value >= 0 ? 'positive' : 'negative'}>{value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% จากช่วงก่อนหน้า</small>;
}

function TrendChart({ points }) {
  const w = 700, h = 230, max = Math.max(...points.map((p) => p.value), 1);
  const x = (i) => 54 + i / Math.max(points.length - 1, 1) * 626;
  const y = (v) => 18 + (1 - v / max) * 170;
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');
  return <div className="analytics-chart-scroll"><svg className="analytics-line-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="กราฟแนวโน้มรายได้">
    {[0, .25, .5, .75, 1].map((r) => <g key={r}><line x1="54" x2="680" y1={y(max * r)} y2={y(max * r)} /><text x="48" y={y(max * r) + 4} textAnchor="end">{Math.round(max * r).toLocaleString('th-TH')}</text></g>)}
    <path d={path} className="actual-line" />{points.map((p, i) => <g key={`${p.label}-${i}`}><circle cx={x(i)} cy={y(p.value)} r="4" /><text x={x(i)} y="216" textAnchor="middle">{p.label}</text></g>)}
  </svg></div>;
}

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running']);

const RUN_STATUS_LABELS = {
  queued: 'รอคิววิเคราะห์',
  running: 'กำลังวิเคราะห์…',
  completed: 'วิเคราะห์ล่าสุดสำเร็จ',
  failed: 'วิเคราะห์ไม่สำเร็จ',
};

function formatRunTime(run) {
  const value = run?.completed_at || run?.started_at || run?.created_at;
  if (!value) return '';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState();
  const [error, setError] = useState('');
  const [latestRun, setLatestRun] = useState(null);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runError, setRunError] = useState('');
  const refreshedRunIdRef = useRef(null);

  const loadDashboard = useCallback(async () => {
    const [orders, users, products, items, categories, latestAnalysis] = await Promise.all([
      fetchOrders(),
      fetchUsers(),
      fetchProducts(),
      fetchOrderItems(),
      fetchCategories(),
      fetchLatestAnalysis(),
    ]);

    setData({
      orders,
      users,
      products,
      items,
      categories,
      predictions: latestAnalysis.predictions || [],
    });
    setLatestRun(latestAnalysis.run || null);
    return latestAnalysis;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard().catch((loadError) => setError(loadError.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!latestRun?.run_id || !ACTIVE_RUN_STATUSES.has(latestRun.status)) return undefined;

    let cancelled = false;
    let timer;
    const runId = latestRun.run_id;

    async function poll() {
      try {
        const run = await fetchAnalysisRunStatus(runId);
        if (cancelled || String(run?.run_id) !== String(runId)) return;

        setLatestRun(run);
        setRunError('');

        if (ACTIVE_RUN_STATUSES.has(run.status)) {
          timer = window.setTimeout(poll, 2500);
          return;
        }

        if (run.status === 'completed' && String(refreshedRunIdRef.current) !== String(runId)) {
          await loadDashboard();
          refreshedRunIdRef.current = runId;
        }
      } catch {
        if (cancelled) return;
        setRunError('ตรวจสอบสถานะไม่ได้ กำลังลองใหม่…');
        timer = window.setTimeout(poll, 5000);
      }
    }

    timer = window.setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [latestRun?.run_id, latestRun?.status, loadDashboard]);

  async function handleStartAnalysis() {
    if (runSubmitting || ACTIVE_RUN_STATUSES.has(latestRun?.status)) return;

    setRunSubmitting(true);
    setRunError('');

    try {
      const run = await startAnalysis({ months: 12 });
      setLatestRun(run);
    } catch (startError) {
      const activeRun = startError.status === 409 ? startError.data?.data : null;
      if (activeRun?.run_id) {
        setLatestRun(activeRun);
      } else {
        setRunError(startError.message || 'ไม่สามารถเริ่มวิเคราะห์ข้อมูลได้');
      }
    } finally {
      setRunSubmitting(false);
    }
  }

  const report = useMemo(() => {
    if (!data) return null;
    const end = new Date(), start = new Date(), prior = new Date();
    start.setDate(end.getDate() - days + 1); start.setHours(0, 0, 0, 0);
    prior.setTime(start.getTime()); prior.setDate(prior.getDate() - days);
    const good = data.orders.filter((o) => o.order_status !== 'cancelled');
    const current = good.filter((o) => { const d = new Date(o.order_date); return d >= start && d <= end; });
    const previous = good.filter((o) => { const d = new Date(o.order_date); return d >= prior && d < start; });
    const ids = new Set(current.map((o) => String(o.order_id)));
    const products = new Map(data.products.map((p) => [String(p.product_id), p]));
    const categories = new Map(data.categories.map((c) => [String(c.category_id), c.category_name]));
    const productSales = new Map(), categorySales = new Map();
    data.items.filter((i) => ids.has(String(i.order_id))).forEach((i) => {
      const p = products.get(String(i.product_id));
      const amount = Number(i.quantity || 0) * Number(i.price || p?.price || 0);
      const name = p?.product_name || `สินค้า ${i.product_id}`;
      const category = categories.get(String(p?.category_id)) || 'อื่น ๆ';
      productSales.set(name, (productSales.get(name) || 0) + amount);
      categorySales.set(category, (categorySales.get(category) || 0) + amount);
    });
    const count = days === 7 ? 7 : days === 30 ? 10 : 12, step = days / count;
    const points = Array.from({ length: count }, (_, i) => {
      const a = new Date(start), b = new Date(start);
      a.setDate(a.getDate() + Math.floor(i * step)); b.setDate(b.getDate() + Math.floor((i + 1) * step));
      return { label: a.toLocaleDateString('th-TH', days === 365 ? { month: 'short' } : { day: 'numeric', month: 'short' }), value: sum(current.filter((o) => { const d = new Date(o.order_date); return d >= a && d < b; })) };
    });
    const revenue = sum(current), categoryList = [...categorySales].sort((a, b) => b[1] - a[1]);
    const nextMonth = new Date(end.getFullYear(), end.getMonth() + 1, 1).toISOString().slice(0, 10);
    const predictedRevenue = data.predictions
      .filter((item) => String(item.predicted_month).slice(0, 10) === nextMonth)
      .reduce((total, item) => total + Number(item.predicted_quantity || 0) * Number(products.get(String(item.product_id))?.price || 0), 0);
    return { revenue, revenueChange: change(revenue, sum(previous)), predictedRevenue, orders: current.length, orderChange: change(current.length, previous.length), customers: data.users.filter((u) => u.role === 'customer' && (!u.created_at || new Date(u.created_at) >= start)).length, products: [...productSales].sort((a, b) => b[1] - a[1]).slice(0, 5), categories: categoryList, categoryTotal: categoryList.reduce((t, x) => t + x[1], 0), points };
  }, [data, days]);

  if (error) return <div className="admin-error">{error}</div>;
  if (!report) return <div className="admin-loading">กำลังโหลดข้อมูลวิเคราะห์...</div>;
  const colors = ['#2f5d4a', '#7c9b8e', '#efb45b', '#6d8fc7', '#b88bc8'];
  const runIsActive = ACTIVE_RUN_STATUSES.has(latestRun?.status);
  const runStatusLabel = RUN_STATUS_LABELS[latestRun?.status] || 'ยังไม่เคยวิเคราะห์ด้วย AI';
  const runFailureMessage = latestRun?.status === 'failed' ? latestRun.error_message : '';
  const runButtonLabel = runSubmitting
    ? 'กำลังส่งคำขอ…'
    : latestRun?.status === 'queued'
      ? 'รอคิว…'
      : latestRun?.status === 'running'
        ? 'กำลังวิเคราะห์…'
        : 'วิเคราะห์ใหม่';

  return <div className="analytics-page">
    <div className="analytics-toolbar">
      <div className="analytics-run-summary" aria-live="polite">
        <span className={`analytics-run-badge ${latestRun?.status || 'idle'}`}>{runStatusLabel}</span>
        {latestRun && <small>
          {formatRunTime(latestRun)}
          {latestRun.status === 'completed' ? ` · ${Number(latestRun.result_count || 0).toLocaleString('th-TH')} รายการ` : ''}
        </small>}
      </div>
      <div className="analytics-toolbar-actions">
        <button
          type="button"
          className="analytics-run-button"
          onClick={handleStartAnalysis}
          disabled={runSubmitting || runIsActive}
        >
          {runButtonLabel}
        </button>
        <div className="analytics-periods">
          {periods.map(([value, label]) => (
            <button type="button" key={value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
    {(runError || latestRun?.status === 'failed') && (
      <div className="analytics-run-error" role="alert">
        {runError || runFailureMessage || 'การวิเคราะห์ไม่สำเร็จ กรุณาลองใหม่'}
      </div>
    )}
    <section className="analytics-summary-grid">
      <article><span>รายได้รวม</span><strong>{formatCurrency(report.revenue)}</strong><Trend value={report.revenueChange} /></article>
      <article><span>จำนวนคำสั่งซื้อ</span><strong>{report.orders}</strong><Trend value={report.orderChange} /></article>
      <article><span>ลูกค้าใหม่</span><strong>{report.customers}</strong><small>บัญชีในช่วงที่เลือก</small></article>
      <article><span>ประมาณการรายได้เดือนหน้า</span><strong>{formatCurrency(report.predictedRevenue)}</strong><small>ผลพยากรณ์ล่าสุดจาก AI ผ่าน n8n</small></article>
    </section>
    <section className="analytics-insight-panel"><h2>รายงานการวิเคราะห์แนวโน้มยอดขาย</h2><p>วิเคราะห์ผลการดำเนินงานจากข้อมูลจริงในระบบ</p><div className="analytics-insight-grid">
      <article className="blue"><b>แนวโน้มรายได้</b><span>{report.revenueChange >= 0 ? 'เติบโต' : 'ลดลง'} {Math.abs(report.revenueChange).toFixed(1)}%</span></article>
      <article className="orange"><b>การเปลี่ยนแปลงยอดขาย</b><span>{report.orderChange.toFixed(1)}% ใน {days} วัน</span></article>
      <article className="purple"><b>ลูกค้าใหม่</b><span>{report.customers} บัญชี</span></article>
      <article className="green"><b>สินค้ารายได้สูงสุด</b><span>{report.products[0]?.[0] || 'ยังไม่มีข้อมูล'}</span></article>
    </div></section>
    <div className="analytics-chart-grid">
      <section className="analytics-card analytics-wide"><h2>แนวโน้มรายได้</h2><TrendChart points={report.points} /></section>
      <section className="analytics-card"><h2>การขายตามหมวดหมู่</h2>{report.categories.length ? <ul className="analytics-category-list">{report.categories.map(([name, value], i) => <li key={name}><i style={{ background: colors[i % colors.length] }} /><span>{name}</span><b>{(value / report.categoryTotal * 100).toFixed(0)}%</b></li>)}</ul> : <p className="analytics-empty">ยังไม่มีข้อมูลการขาย</p>}</section>
      <section className="analytics-card"><h2>สินค้าขายดีที่สุด</h2>{report.products.length ? <ol className="analytics-ranking">{report.products.map(([name, value]) => <li key={name}><span>{name}</span><strong>{formatCurrency(value)}</strong></li>)}</ol> : <p className="analytics-empty">ยังไม่มีข้อมูลในช่วงนี้</p>}</section>
      <section className="analytics-card"><h2>สถานะคลังสินค้า</h2><div className="analytics-stock-bars"><div><span>พร้อมจำหน่าย</span><b>{data.products.filter((p) => Number(p.stock_quantity) > 5).length}</b></div><div><span>ใกล้หมด (1–5)</span><b>{data.products.filter((p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 5).length}</b></div><div><span>หมดสต็อก</span><b>{data.products.filter((p) => Number(p.stock_quantity) <= 0).length}</b></div></div></section>
    </div>
  </div>;
}
