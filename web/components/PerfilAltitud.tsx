// Perfil esquemático costa → Andes con la franja de altitud en que nidifica la especie (atlas).
const es = (n: number) => n.toLocaleString("es-CL");

export default function PerfilAltitud({ min, max }: { min: number; max: number }) {
  const W = 420, H = 260, m = { t: 14, r: 12, b: 24, l: 58 }, top = 6000;
  const y = (a: number) => m.t + (H - m.t - m.b) * (1 - a / top);
  // silueta esquemática (no a escala horizontal): costa, cordillera de la Costa, valle central, Andes
  const perfil = [[0, 0], [0.08, 0], [0.2, 900], [0.3, 400], [0.5, 600], [0.68, 2500], [0.8, 4300], [0.86, 5600], [0.92, 4800], [1, 4400]]
    .map(([f, a]) => `${m.l + f * (W - m.l - m.r)},${y(a)}`).join(" L");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Nidifica entre ${es(min)} y ${es(max)} metros sobre el nivel del mar`}>
      {[0, 1000, 2000, 3000, 4000, 5000, 6000].map((a) => (
        <g key={a}><line x1={m.l} x2={W - m.r} y1={y(a)} y2={y(a)} stroke="var(--linea)" /><text x={m.l - 8} y={y(a) + 4} textAnchor="end" fontSize={11}>{es(a)} m</text></g>
      ))}
      <path d={`M${m.l},${y(0)} L${perfil} L${W - m.r},${y(0)} Z`} fill="var(--musgo-2)" opacity={0.8} />
      <rect x={m.l} y={y(max)} width={W - m.l - m.r} height={Math.max(3, y(min) - y(max))} fill="var(--sol)" opacity={0.35} />
      <line x1={m.l} x2={W - m.r} y1={y(max)} y2={y(max)} stroke="var(--sol)" strokeWidth={2} />
      <line x1={m.l} x2={W - m.r} y1={y(min)} y2={y(min)} stroke="var(--sol)" strokeWidth={2} />
      <text x={W - m.r - 4} y={y(max) - 6} textAnchor="end" fontSize={12} className="cal__nombre">máx. {es(max)} m</text>
      <text x={W - m.r - 4} y={Math.min(y(min) + 16, H - m.b - 2)} textAnchor="end" fontSize={12} className="cal__nombre">mín. {es(min)} m</text>
      <text x={m.l + 4} y={H - 6} fontSize={11}>costa</text>
      <text x={W - m.r} y={H - 6} fontSize={11} textAnchor="end">Andes</text>
    </svg>
  );
}
