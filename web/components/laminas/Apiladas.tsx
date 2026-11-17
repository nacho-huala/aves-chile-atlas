// Barras apiladas al 100 % (componente de servidor: sin interacción, se lee con las etiquetas).
import type { Kba, UicnAgregado } from "@/lib/data";

const es = (n: number, d = 0) => n.toLocaleString("es-CL", { maximumFractionDigits: d });

const TEND = [
  { id: "decreciente", txt: "Decrece", color: "var(--foco)" },
  { id: "estable", txt: "Estable", color: "var(--musgo-4)" },
  { id: "creciente", txt: "Crece", color: "var(--cat-mar)" },
  { id: "desconocida", txt: "Desconocida", color: "var(--musgo-2)" },
] as const;
const NOMBRE_UICN: Record<string, string> = { CR: "En peligro crítico", EN: "En peligro", VU: "Vulnerable", NT: "Casi amenazada", LC: "Preocupación menor", DD: "Datos insuficientes" };

function Leyenda({ items }: { items: readonly { txt: string; color: string }[] }) {
  return <ul className="aa-leyenda" aria-hidden="true">{items.map((i) => <li key={i.txt}><i style={{ background: i.color }} />{i.txt}</li>)}</ul>;
}

/** Tendencia poblacional UICN por categoría (agregado, por términos de uso de UICN). */
export function TendenciaUicn({ uicn }: { uicn: UicnAgregado }) {
  const W = 1100, L = 200, R = 70, rh = 38, H = uicn.categorias.length * rh + 6;
  return (
    <figure style={{ margin: 0 }}>
      <Leyenda items={TEND} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ marginTop: 12 }}
        aria-label={uicn.categorias.map((c) => `${c.cat}: ${c.decreciente} de ${c.especies} decrecen`).join("; ")}>
        {uicn.categorias.map((c, i) => {
          let x = L; const y = i * rh + 4, w = W - L - R;
          return (
            <g key={c.cat}>
              <text x={L - 12} y={y + 20} textAnchor="end" fontSize={14} className="cal__nombre">{NOMBRE_UICN[c.cat] ?? c.cat} ({c.cat})</text>
              {TEND.map((t) => {
                const v = c[t.id], ww = (v / c.especies) * w, x0 = x; x += ww;
                return v ? (
                  <g key={t.id}>
                    <rect x={x0} y={y} width={Math.max(ww - 1.5, 0.5)} height={rh - 10} fill={t.color} rx={2} />
                    {ww > 26 && <text x={x0 + ww / 2} y={y + 18} textAnchor="middle" fontSize={12} style={{ fill: t.id === "desconocida" ? "var(--texto)" : "var(--sobre-foco)" }}>{v}</text>}
                  </g>
                ) : null;
              })}
              <text x={W - R + 8} y={y + 18} fontSize={12}>{c.especies} spp.</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Sitios KBA y salidas por tramo de superficie protegida: dos barras por tramo (% de sitios vs. % de salidas). */
export function ProteccionKba({ proteccion }: { proteccion: Kba["resumen"]["proteccion"] }) {
  const totS = proteccion.reduce((a, p) => a + p.sitios, 0);
  const W = 1100, L = 190, R = 80, gh = 64, H = proteccion.length * gh + 4, w = W - L - R;
  const max = Math.max(...proteccion.map((p) => Math.max(p.pct, (100 * p.sitios) / totS)));
  const series = [
    { txt: "% de los sitios KBA", color: "var(--musgo-3)", v: (p: (typeof proteccion)[number]) => (100 * p.sitios) / totS },
    { txt: "% de las salidas dentro de KBA", color: "var(--foco)", v: (p: (typeof proteccion)[number]) => p.pct },
  ];
  return (
    <figure style={{ margin: 0 }}>
      <Leyenda items={series} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ marginTop: 12 }}
        aria-label={proteccion.map((p) => `${p.tramo} protegido: ${p.sitios} sitios, ${p.pct} % de las salidas`).join("; ")}>
        {proteccion.map((p, i) => {
          const y = i * gh + 4;
          return (
            <g key={p.tramo}>
              <text x={L - 12} y={y + 22} textAnchor="end" fontSize={14} className="cal__nombre">{p.tramo} protegido</text>
              <text x={L - 12} y={y + 40} textAnchor="end" fontSize={12}>{p.sitios} sitios</text>
              {series.map((s, k) => {
                const v = s.v(p), ww = (v / max) * w;
                return (
                  <g key={k}>
                    <rect x={L} y={y + k * 24} width={ww} height={20} rx={2} fill={s.color} />
                    <text x={L + ww + 6} y={y + k * 24 + 15} fontSize={12}>{es(v, 1)} %</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
