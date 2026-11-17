"use client";
import { useMemo, useState } from "react";
import { scaleLinear, scaleLog } from "d3";
import type { KbaSitio } from "@/lib/data";
import { COLOR_MACROZONA, MACROZONAS } from "@/lib/geo";
import { es, Leyenda, Tip, useTooltip } from "./comun";

/** Lámina 12: salidas (log) vs. especies por sitio KBA. Sobre la curva = más especies de lo esperable para su esfuerzo. */
export function KbaDispersion({ sitios }: { sitios: KbaSitio[] }) {
  const [activos, setActivos] = useState(new Set(MACROZONAS));
  const { ref, tip, mover, salir } = useTooltip<KbaSitio>();
  const W = 1100, H = 440, m = { t: 14, r: 20, b: 44, l: 56 };
  const x = scaleLog().domain([18, Math.max(...sitios.map((s) => s.salidas)) * 1.1]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, Math.max(...sitios.map((s) => s.especies)) * 1.05]).range([H - m.b, m.t]);
  // referencia: ajuste especies ~ a + b·log10(salidas) por mínimos cuadrados
  const fit = useMemo(() => {
    const xs = sitios.map((s) => Math.log10(s.salidas)), ys = sitios.map((s) => s.especies), n = xs.length;
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const b = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / xs.reduce((a, v) => a + (v - mx) ** 2, 0);
    return { a: my - b * mx, b };
  }, [sitios]);
  const esperado = (s: number) => fit.a + fit.b * Math.log10(s);
  const destacados = useMemo(() => [...sitios].sort((p, q) => (q.especies - esperado(q.salidas)) - (p.especies - esperado(p.salidas))).slice(0, 5).map((s) => s.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sitios, fit]);
  const alternar = (id: string) => setActivos((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n.size ? n : new Set(MACROZONAS); });
  const dom = x.domain();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <Leyenda items={MACROZONAS.map((z) => ({ id: z, txt: z, color: COLOR_MACROZONA[z], n: sitios.filter((s) => s.macrozona === z).length }))} activos={activos} alternar={alternar} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Especies frente a salidas en cada sitio KBA">
        {[20, 50, 100, 200, 500, 1000, 2000, 5000].filter((v) => v <= dom[1]).map((v) => (
          <g key={v}><line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} stroke="var(--linea)" /><text x={x(v)} y={H - m.b + 18} textAnchor="middle" fontSize={12}>{es(v)}</text></g>
        ))}
        {y.ticks(5).map((v) => (
          <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--linea)" /><text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={12}>{v}</text></g>
        ))}
        <path d={`M${x(dom[0])},${y(esperado(dom[0]))}L${x(dom[1])},${y(esperado(dom[1]))}`} stroke="var(--texto-suave)" strokeDasharray="5 5" strokeWidth={1.5} fill="none" />
        {sitios.map((s) => {
          const on = activos.has(s.macrozona ?? ""), k = destacados.indexOf(s.id), dest = k >= 0;
          return (
            <g key={s.id} onPointerMove={(e) => mover(e, s)} onPointerLeave={salir}>
              <circle cx={x(s.salidas)} cy={y(s.especies)} r={dest ? 10 : 5} fill={COLOR_MACROZONA[s.macrozona ?? ""] ?? "var(--texto-suave)"}
                fillOpacity={on ? 0.85 : 0.1} stroke={dest ? "var(--texto)" : "var(--superficie)"} strokeWidth={dest ? 2 : 1} />
              {dest && <text x={x(s.salidas)} y={y(s.especies) + 4} fontSize={11} textAnchor="middle" style={{ fill: "var(--sobre-foco)", fontWeight: 700 }} pointerEvents="none">{k + 1}</text>}
            </g>
          );
        })}
        <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fontSize={12}>Salidas de eBird dentro del sitio (escala log) →</text>
        <text x={14} y={m.t + 4} fontSize={12} transform={`rotate(-90 14 ${m.t + 4})`} textAnchor="end">Especies registradas →</text>
      </svg>
      <ol className="kba-destacados">
        {destacados.map((id) => { const s = sitios.find((x) => x.id === id)!; return (
          <li key={id}><b>{s.nombre}</b> <span className="apoyo">· {s.region} · {es(s.especies)} especies en {es(s.salidas)} salidas (≈ {es(Math.round(s.especies - esperado(s.salidas)))} más de lo esperable)</span></li>); })}
      </ol>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.nombre}</b>
          <span>{es(tip.d.especies)} especies en {es(tip.d.salidas)} salidas · esperado ≈ {es(Math.round(esperado(tip.d.salidas)))}</span>
        </Tip>
      )}
    </div>
  );
}
