"use client";
import { useMemo, useState } from "react";
import { scaleLog, scaleSqrt, extent } from "d3";
import type { RasgoEspecie } from "@/lib/laminas-datos";
import { DIETAS, es, Leyenda, pctTxt, Tip, useTooltip } from "./comun";

const ROTULOS = ["Picaflor gigante", "Picaflor chico", "Cóndor", "Pelícano", "Pingüino rey", "Albatros errante", "Ñandú", "Rayadito", "Chincol", "Zarapito común", "Flamenco chileno"];

/** Masa (log) contra pico relativo = culmen ÷ masa^⅓ (log), color = dieta, tamaño = % de salidas. */
export function Rasgos({ especies }: { especies: RasgoEspecie[] }) {
  const W = 1000, H = 480, m = { t: 16, r: 16, b: 42, l: 56 };
  const x = useMemo(() => scaleLog().domain(extent(especies, (e) => e.masa) as [number, number]).nice().range([m.l, W - m.r]), [especies, m.l, m.r]);
  const y = useMemo(() => scaleLog().domain(extent(especies, (e) => e.picoRel) as [number, number]).nice().range([H - m.b, m.t]), [especies, m.b, m.t]);
  const r = useMemo(() => scaleSqrt().domain([0, 35]).range([2.5, 14]), []);
  const [activos, setActivos] = useState(new Set(DIETAS.map((d) => d.id)));
  const { ref, tip, mover, salir } = useTooltip<RasgoEspecie>();
  const color = (d: string | null) => DIETAS.find((x) => x.id === d)?.color ?? "var(--texto-suave)";
  const alternar = (id: string) => setActivos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n.size ? n : new Set(DIETAS.map((d) => d.id)); });
  const orden = [...especies].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)); // las grandes abajo

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <Leyenda items={DIETAS.map((d) => ({ ...d, n: especies.filter((e) => e.dieta === d.id).length }))} activos={activos} alternar={alternar} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Masa corporal contra pico relativo de las aves de Chile, por dieta">
        {x.ticks(6).filter((v) => [1, 10, 100, 1000, 10000].includes(v)).map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} stroke="var(--linea)" /><text x={x(v)} y={H - m.b + 18} textAnchor="middle">{v >= 1000 ? `${es(v / 1000)} kg` : `${v} g`}</text></g>)}
        {[2, 3, 5, 10, 20].map((v) => <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--linea)" strokeOpacity={0.6} /><text x={m.l - 8} y={y(v) + 4} textAnchor="end">{es(v, 1)}</text></g>)}
        <text x={W - m.r} y={H - 4} textAnchor="end">masa (log) →</text>
        <text x={m.l} y={m.t - 2}>↑ pico largo para su tamaño</text>
        <g className={activos.size < DIETAS.length ? "atenuar" : ""}>
          {orden.map((e) => (
            <a key={e.slug} href={`/especies/${e.slug}/`} aria-label={`${e.nombre}: ${es(e.masa)} g, pico ${es(e.culmen)} mm`}>
              <circle className={`marca${activos.has(e.dieta ?? "") ? " on" : ""}`} cx={x(e.masa)} cy={y(e.picoRel)} r={r(e.pct ?? 0)}
                fill={color(e.dieta)} fillOpacity={0.82} stroke="var(--superficie)" strokeWidth={0.6} onPointerMove={(ev) => mover(ev, e)} onPointerLeave={salir} />
            </a>
          ))}
        </g>
        {especies.filter((e) => ROTULOS.includes(e.nombre)).map((e, i) => { const der = x(e.masa) > W * 0.8; return <text key={e.slug} x={x(e.masa) + (der ? -8 : 8)} y={y(e.picoRel) + (i % 2 ? 14 : -6)} textAnchor={der ? "end" : "start"} className="t-fuerte" pointerEvents="none">{e.nombre}</text>; })}
      </svg>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.nombre}</b>
          <span>{es(tip.d.masa, tip.d.masa < 10 ? 1 : 0)} g · pico {es(tip.d.culmen, 1)} mm · {tip.d.dieta ?? "dieta sin dato"}{tip.d.pct ? ` · ${pctTxt(tip.d.pct)} de las salidas` : ""}</span>
        </Tip>
      )}
    </div>
  );
}
