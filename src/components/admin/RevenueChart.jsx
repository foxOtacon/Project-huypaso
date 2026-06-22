export default function RevenueChart({ data }) {
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 48 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const yMax = Math.ceil(maxValue / 500) * 500 || 2500;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - (d.value / yMax) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <div className="revenue-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="กราฟรายได้ตามเดือน">
        {yTicks.map((tick) => {
          const y = padding.top + chartH - (tick / yMax) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                {tick.toLocaleString('th-TH')}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#areaGradient)" />
        <path d={linePath} fill="none" stroke="#2d6a4f" strokeWidth="2.5" />

        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="#2d6a4f" stroke="#fff" strokeWidth="2" />
        ))}

        {points.map((p) => (
          <text key={`${p.label}-x`} x={p.x} y={height - 8} textAnchor="middle" className="chart-axis-label">
            {p.label}
          </text>
        ))}

        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#40916c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#40916c" stopOpacity="0.02" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
