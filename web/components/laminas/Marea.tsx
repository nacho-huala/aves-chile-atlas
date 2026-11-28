"use client";
import { useMemo, useState } from "react";
import { area, curveBasis, stack, stackOffsetWiggle, stackOrderInsideOut, scaleLinear } from "d3";
import { MACROZONAS } from "@/lib/macrozonas.mjs";
import { es, Leyenda, MESES_L } from "./comun";

type Fila = { anio: number; mes: number; macrozona: string; salidas: number };

/** Streamgraph de salidas por mes y macrozona (d3.stack, offset wiggle). */
export function Marea({ filas, anual }: { filas: Fila[]; anual: { anio: number; salidas: number }[] }) {
  const W = 1100, H = 420, m = { t: 20, r: 10, b: 50, l: 10 };
  const zonas = MACROZONAS.map((z) => z.nombre);
  const serie = useMemo(() => {
    const mapa = new Map<string, Record<string, number>>();
    filas.forEach((f) => { const k = `${f.anio}-${f.mes}`; const o = mapa.get(k) ?? { anio: f.anio, mes: f.mes }; o[f.macrozona] = f.salidas; mapa.set(k, o); });
    return [...mapa.values()].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  }, [filas]);
  const capas = useMemo(() => stack<Record<string, number>>().keys(zonas).value((d, k) => d[k] ?? 0).offset(stackOffsetWiggle).order(stackOrderInsideOut)(serie), [serie, zonas]);
  const x = scaleLinear().domain([0, serie.length - 1]).range([m.l, W - m.r]);
  const lo = Math.min(...capas.flatMap((c) => c.map((p) => p[0]))), hi = Math.max(...capas.flatMap((c) => c.map((p) => p[1])));
  const y = scaleLinear().domain([lo, hi]).range([H - m.b, m.t]);
  const forma = area<[number, number]>().x((_, i) => x(i)).y0((p) => y(p[0])).y1((p) => y(p[1])).curve(curveBasis);
  const [i, setI] = useState<number | null>(null);
  const [aislada, setAislada] = useState<string | null>(null);
  const color = (z: string) => `var(--${MACROZONAS.find((q) => q.nombre === z)!.color})`;
  const punto = i !== null ? serie[i] : null;

  return (
    <div>
      <div className="vista__controles">
        <Leyenda items={MACROZONAS.map((z) => ({ id: z.nombre, txt: z.nombre, color: `var(--${z.color})` }))}
          activos={aislada ? new Set([aislada]) : undefined} alternar={(id) => setAislada((a) => (a === id ? null : id))} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Streamgraph de salidas por mes y macrozona, 2019 a 2025"
        onPointerMove={(e) => { const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; setI(Math.max(0, Math.min(serie.length - 1, Math.round(x.invert(px))))); }}
        onPointerLeave={() => setI(null)}>
        {capas.map((c) => (
          <path key={c.key} d={forma(c as unknown as [number, number][]) ?? ""} fill={color(c.key)} fillOpacity={!aislada || aislada === c.key ? 0.92 : 0.12} />
        ))}
        {anual.map((a, k) => {
          const xi = x(k * 12 + 5.5);
          return <g key={a.anio}><text x={xi} y={H - 26} textAnchor="middle" className="t-fuerte">{a.anio}</text><text x={xi} y={H - 10} textAnchor="middle">{es(a.salidas)}</text></g>;
        })}
        {i !== null && <line x1={x(i)} x2={x(i)} y1={m.t} y2={H - m.b} stroke="var(--texto)" strokeWidth={1} />}
      </svg>
      <div className="cuerpo-s" aria-live="polite" style={{ minHeight: 44, marginTop: 6 }}>
        {punto ? (
          <><b>{MESES_L[punto.mes - 1]} {punto.anio}</b>: {zonas.map((z) => <span key={z} style={{ marginRight: 12 }}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color(z), marginRight: 4 }} />{z} <span className="num">{es(punto[z] ?? 0)}</span></span>)}</>
        ) : "Pasa sobre el gráfico para ver las salidas de cada mes. Clic en la leyenda para aislar una macrozona."}
      </div>
    </div>
  );
}

/** Descompone el crecimiento: salidas = observadores × salidas por observador, en índice (primer año = 100). */
export function CrecimientoEbird({ anual }: { anual: { anio: number; salidas: number; observadores: number }[] }) {
  const W = 1100, H = 250, m = { t: 20, r: 230, b: 34, l: 46 };
  const b = anual[0];
  const series = [
    { id: "salidas", txt: "Salidas", color: "var(--texto)", v: anual.map((a) => (100 * a.salidas) / b.salidas), ancho: 2.5 },
    { id: "obs", txt: "Observadores", color: "var(--foco)", v: anual.map((a) => (100 * a.observadores) / b.observadores), ancho: 2.5 },
    { id: "spo", txt: "Salidas por observador", color: "var(--musgo-4)", v: anual.map((a) => (100 * a.salidas / a.observadores) / (b.salidas / b.observadores)), ancho: 2, guion: "6 5" },
  ];
  const max = Math.max(...series.flatMap((s) => s.v)) * 1.08;
  const x = (i: number) => m.l + (i / (anual.length - 1)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - v / max) * (H - m.t - m.b);
  const fin = anual.length - 1;
  // rótulos al final de cada línea, separados al menos 18 unidades para que no se encimen
  const ys = series.map((s, k) => ({ k, y: y(s.v[fin]) })).sort((a, b) => a.y - b.y);
  ys.forEach((o, i) => { if (i > 0 && o.y - ys[i - 1].y < 18) o.y = ys[i - 1].y + 18; });
  const yRot = Object.fromEntries(ys.map((o) => [o.k, o.y]));
  return (
    <figure className="crecimiento" style={{ margin: "var(--esp-5) 0 0" }}>
      <figcaption className="dato-eti" style={{ marginBottom: 6 }}>¿De dónde viene el crecimiento? Índice, {b.anio} = 100</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Salidas, observadores y salidas por observador en índice, ${b.anio} = 100`}>
        {[0, 100, 200].filter((v) => v < max).map((v) => (
          <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--linea)" /><text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={12}>{v}</text></g>
        ))}
        {anual.map((a, i) => <text key={a.anio} x={x(i)} y={H - 10} textAnchor="middle" fontSize={12}>{a.anio}</text>)}
        {series.map((s, k) => (
          <g key={s.id}>
            <polyline points={s.v.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.ancho} strokeDasharray={s.guion} />
            <circle cx={x(fin)} cy={y(s.v[fin])} r={4} fill={s.color} />
            <text x={x(fin) + 10} y={yRot[k] + 4} fontSize={13} className="t-fuerte">{s.txt} · {Math.round(s.v[fin])}</text>
          </g>
        ))}
      </svg>
      <p className="pie" style={{ marginTop: 4 }}>
        Si las salidas crecen y las salidas por observador se mantienen cerca de 100, el aumento viene de que más personas registran en eBird.
      </p>
    </figure>
  );
}
