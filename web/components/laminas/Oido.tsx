"use client";
import { useMemo, useRef, useState } from "react";
import { scaleLog } from "d3";
import type { DatosOido, OidoEspecie } from "@/lib/laminas-datos";
import { es, pctTxt, Tip, useTooltip } from "./comun";

/** Grabaciones en xeno-canto (Chile) contra % de salidas, en log–log, con la recta de regresión. */
export function Oido({ datos }: { datos: DatosOido }) {
  const W = 1000, H = 440, m = { t: 16, r: 16, b: 42, l: 54 };
  const esp = datos.especies;
  const x = useMemo(() => scaleLog().domain([0.0008, 60]).range([m.l, W - m.r]).clamp(true), [m.l, m.r]);
  const y = useMemo(() => scaleLog().domain([0.8, Math.max(...esp.map((e) => e.grab)) * 1.2]).range([H - m.b, m.t]), [esp, m.b, m.t]);
  const destacadas = [...esp].sort((a, b) => b.veces - a.veces).slice(0, 7).map((e) => e.slug);
  const [sel, setSel] = useState<OidoEspecie | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const { ref, tip, mover, salir } = useTooltip<OidoEspecie>();
  const recta = (p: number) => 10 ** (datos.a + datos.b * Math.log10(p));
  const elegir = (e: OidoEspecie) => { setSel(e); setTimeout(() => audio.current?.play().catch(() => {}), 50); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grabaciones en xeno-canto contra porcentaje de salidas, por especie">
        {[0.001, 0.01, 0.1, 1, 10].map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} stroke="var(--linea)" /><text x={x(v)} y={H - m.b + 18} textAnchor="middle">{pctTxt(v)}</text></g>)}
        {[1, 10, 100].map((v) => <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--linea)" /><text x={m.l - 8} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
        <text x={W - m.r} y={H - 4} textAnchor="end">% de salidas con la especie (log) →</text>
        <text x={m.l} y={m.t - 2}>↑ grabaciones en Chile (log)</text>
        <line x1={x(0.001)} y1={y(recta(0.001))} x2={x(50)} y2={y(recta(50))} stroke="var(--texto-suave)" strokeDasharray="5 4" />
        {esp.map((e) => (
          <circle key={e.slug} className="marca" cx={x(e.pct)} cy={y(e.grab)} r={e.slug === sel?.slug ? 7 : 4.5}
            fill={e.veces >= 3 ? "var(--foco)" : e.veces <= 1 / 3 ? "var(--musgo-2)" : "var(--musgo-4)"}
            stroke={e.slug === sel?.slug ? "var(--texto)" : "var(--superficie)"} strokeWidth={e.slug === sel?.slug ? 2 : 0.6}
            tabIndex={e.audio ? 0 : -1} role={e.audio ? "button" : undefined} aria-label={`${e.nombre}: ${e.grab} grabaciones`}
            onPointerMove={(ev) => mover(ev, e)} onPointerLeave={salir} onClick={() => e.audio && elegir(e)}
            onKeyDown={(ev) => { if (ev.key === "Enter" && e.audio) elegir(e); }} style={{ cursor: e.audio ? "pointer" : "default" }} />
        ))}
        {esp.filter((e) => destacadas.includes(e.slug)).map((e, i) => { const der = x(e.pct) > W * 0.75; return <text key={e.slug} x={x(e.pct) + (der ? -9 : 9)} y={y(e.grab) + (i % 2 ? 14 : -7)} textAnchor={der ? "end" : "start"} className="t-fuerte" pointerEvents="none">{e.nombre}</text>; })}
      </svg>
      <div className="reproductor" aria-live="polite">
        {sel?.audio ? (
          <>
            <audio ref={audio} controls preload="none" src={sel.audio} key={sel.slug} />
            <span className="cuerpo-s"><b>{sel.nombre}</b> · se graba ×{es(sel.veces, 1)} lo esperado · {sel.autor}, {sel.licencia?.replace(/^https?:\/\/creativecommons.org\/licenses\//, "CC ").replace(/\/$/, "")} · {sel.url && <a className="enlace" href={sel.url}>xeno-canto</a>}</span>
          </>
        ) : <span className="cuerpo-s">Haz clic en un punto para escuchar su canto. En conchovino: se graban 3 veces o más de lo esperado.</span>}
      </div>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.nombre}</b>
          <span>{tip.d.grab} grabaciones · {pctTxt(tip.d.pct)} de las salidas · ×{es(tip.d.veces, 1)} lo esperado</span>
        </Tip>
      )}
    </div>
  );
}
