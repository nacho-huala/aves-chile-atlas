// Barras de salidas por año (SVG puro, sin librerías). Barras desde cero, un solo tono.
export default function BarrasAnuales({ datos }: { datos: { anio: number; salidas: number }[] }) {
  const W = 640, H = 220, m = { t: 20, r: 8, b: 26, l: 8 };
  const max = Math.max(...datos.map((d) => d.salidas));
  const bw = (W - m.l - m.r) / datos.length;
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Salidas por año">
      {datos.map((d, i) => {
        const x = m.l + i * bw + bw * 0.15, w = bw * 0.7;
        return (
          <g key={d.anio}>
            <rect x={x} y={y(d.salidas)} width={w} height={H - m.b - y(d.salidas)} fill="var(--musgo-3)" rx={2} />
            <text x={x + w / 2} y={y(d.salidas) - 5} textAnchor="middle" fontSize={11} style={{ fill: "var(--texto)" }}>
              {Math.round(d.salidas / 1000)} mil
            </text>
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={11}>{d.anio}</text>
          </g>
        );
      })}
    </svg>
  );
}
