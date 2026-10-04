import type { CurvePoint } from "../api/types";
import { CLASS_STYLE } from "../lib/risk";

const W = 300, H = 120, PAD = { l: 30, r: 8, t: 8, b: 22 };
const THRESHOLDS = [0.25, 0.5, 0.75];

/** Dependency-free SVG chart of risk index vs minutes ahead, with class threshold lines. */
export default function ForecastCurve({ points }: { points: CurvePoint[] }) {
  const x = (t: number) => PAD.l + (t / 180) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.t_min).toFixed(1)},${y(p.risk_probability).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="curve" role="img" aria-label="Forecast of flood risk for the next 3 hours">
      {THRESHOLDS.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#b0bec5" strokeDasharray="3 3" />
          <text x={PAD.l - 4} y={y(t) + 3} fontSize="8" textAnchor="end" fill="#455a64">{t.toFixed(2)}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#0b3d5c" strokeWidth="2" />
      {points.map((p) => (
        <circle key={p.t_min} data-testid="curve-point" cx={x(p.t_min)} cy={y(p.risk_probability)} r="3"
          fill={CLASS_STYLE[p.risk_class].color} stroke="#fff" strokeWidth="1" />
      ))}
      {[0, 60, 120, 180].map((t) => (
        <text key={t} x={x(t)} y={H - 6} fontSize="9" textAnchor="middle" fill="#455a64">{t === 0 ? "now" : `+${t}m`}</text>
      ))}
    </svg>
  );
}
