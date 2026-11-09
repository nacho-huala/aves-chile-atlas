"use client";
import { useMemo, useState } from "react";
import { arc } from "d3";
import type { RuedaEspecie } from "@/lib/laminas-datos";
import { es, MESES, MESES_L, Tip, useTooltip } from "./comun";

const UMBRALES = [0.5, 2, 5, 10, 20, 35]; // % de salidas → musgo-1…6
const tono = (v: number | null) => (v === null ? "var(--superficie-hundida)" : `var(--musgo-${Math.max(1, UMBRALES.filter((u) => v >= u).length)})`);

/** Rueda fenológica: un anillo por especie (comunes al centro), enero arriba. */
export function Rueda({ especies }: { especies: RuedaEspecie[] }) {
  const [mes, setMes] = useState(new Date().getMonth());
  const { ref, tip, mover, salir } = useTooltip<{ e: RuedaEspecie; m: number }>();
  const S = 560, c = S / 2, r0 = 54, r1 = c - 30;
  const ancho = (r1 - r0) / especies.length;
  const arco = useMemo(() => arc<{ i: number; m: number }>()
    .innerRadius((d) => r0 + d.i * ancho + 0.6).outerRadius((d) => r0 + (d.i + 1) * ancho - 0.6)
    .startAngle((d) => (d.m / 12) * 2 * Math.PI + 0.01).endAngle((d) => ((d.m + 1) / 12) * 2 * Math.PI - 0.01), [ancho]);

  // lo que más sube este mes respecto de su promedio anual
  const ranking = especies.map((e) => {
    const vals = e.pct.map((v) => v ?? 0), media = vals.reduce((a, b) => a + b, 0) / 12;
    return { e, v: vals[mes], sube: media > 0 ? vals[mes] / media : 0 };
  }).sort((a, b) => b.sube - a.sube || b.v - a.v);
  const maxV = Math.max(...ranking.map((r) => r.v), 1);

  return (
    <div className="dos-vistas">
      <div ref={ref} style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Rueda fenológica: porcentaje de salidas por mes para especies comunes y estacionales">
          <g transform={`translate(${c},${c})`}>
            {especies.map((e, i) => MESES.map((_, m) => (
              <path key={`${e.slug}-${m}`} className="marca" d={arco({ i, m }) ?? ""} fill={tono(e.pct[m])}
                stroke={m === mes ? "var(--foco)" : "none"} strokeWidth={m === mes ? 1.2 : 0}
                onPointerMove={(ev) => mover(ev, { e, m })} onPointerLeave={salir} onClick={() => setMes(m)} />
            )))}
            {MESES.map((txt, m) => {
              const a = ((m + 0.5) / 12) * 2 * Math.PI, rr = r1 + 16;
              return (
                <text key={txt} x={Math.sin(a) * rr} y={-Math.cos(a) * rr + 4} textAnchor="middle" className={m === mes ? "t-fuerte" : ""}
                  style={{ cursor: "pointer" }} onClick={() => setMes(m)}>{txt}</text>
              );
            })}
            <text y={-6} textAnchor="middle" className="t-fuerte" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{MESES_L[mes]}</text>
            <text y={14} textAnchor="middle">verano arriba</text>
          </g>
        </svg>
        {tip && (
          <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 500}>
            <b>{tip.d.e.nombre}</b>
            <span>{MESES_L[tip.d.m]}: {tip.d.e.pct[tip.d.m] === null ? "sin datos" : `${es(tip.d.e.pct[tip.d.m]!, 1)} % de las salidas`}</span>
          </Tip>
        )}
      </div>
      <div>
        <div className="vista__controles" style={{ marginBottom: 12 }}>
          <label className="cuerpo-s" style={{ display: "grid", gap: 4 }}>Mes
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES_L.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
          </label>
        </div>
        <h3 className="titulo-3" style={{ marginBottom: 10 }}>Qué buscar en {MESES_L[mes]}</h3>
        <ol className="lista-rank">
          {ranking.map((r) => (
            <li key={r.e.slug}>
              <a href={`/especies/${r.e.slug}/`} style={{ color: "var(--texto)" }}>{r.e.nombre}</a>
              <span className="barra-mini"><span style={{ width: `${(r.v / maxV) * 100}%`, background: r.sube >= 1.5 ? "var(--foco)" : undefined }} /></span>
              <span className="num">{es(r.v, 1)} %</span>
            </li>
          ))}
        </ol>
        <p className="pie">Ordenadas por cuánto suben este mes respecto de su promedio anual; en conchovino, las que están en temporada (≥ 1,5 × su promedio).</p>
      </div>
    </div>
  );
}
