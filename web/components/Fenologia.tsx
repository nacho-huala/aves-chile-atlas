import { MESES } from "@/lib/formato";

// 12 barras (ene → dic) del % de salidas completas con la especie. El mejor mes va en el color de foco.
export default function Fenologia({ valores, mejorMes }: { valores: (number | null)[]; mejorMes: number | null }) {
  const W = 640, H = 200, m = { t: 18, b: 24, l: 4, r: 4 };
  const max = Math.max(...valores.map((v) => v ?? 0), 0.001);
  const bw = (W - m.l - m.r) / 12;
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Porcentaje de salidas por mes">
      {valores.map((v, i) => {
        const val = v ?? 0, x = m.l + i * bw + bw * 0.15, w = bw * 0.7;
        return (
          <g key={i}>
            <rect x={x} y={y(val)} width={w} height={H - m.b - y(val)} rx={2}
              fill={mejorMes === i + 1 ? "var(--foco)" : "var(--musgo-3)"} />
            <text x={x + w / 2} y={y(val) - 4} textAnchor="middle" fontSize={10}>
              {val >= 10 ? Math.round(val) : val.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
            </text>
            <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={11}>{MESES[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
