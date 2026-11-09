"use client";
import { useMemo, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, scaleSqrt } from "d3";
import type { DatosRed, Nodo } from "@/lib/laminas-datos";
import { es, HABITATS, Leyenda, pctTxt } from "./comun";

type N = Nodo & { x: number; y: number; r: number };
type A = { source: N; target: N; lift: number; juntas: number };

/** Red de co-ocurrencia con d3-force: el layout se calcula una vez; al pasar por un nodo se ven sus vecinos. */
export function Red({ datos }: { datos: DatosRed }) {
  const W = 1000, H = 640;
  const { nodos, aristas } = useMemo(() => {
    const r = scaleSqrt().domain([0, Math.max(...datos.nodos.map((n) => n.pct))]).range([6, 22]);
    const nodos = datos.nodos.map((n, i) => ({ ...n, r: r(n.pct), x: W / 2 + Math.cos(i) * 200, y: H / 2 + Math.sin(i) * 200 })) as N[];
    const porSci = new Map(nodos.map((n) => [n.sci, n]));
    const aristas = datos.aristas.map((a) => ({ source: porSci.get(a.a)!, target: porSci.get(a.b)!, lift: a.lift, juntas: a.juntas })) as A[];
    const sim = forceSimulation(nodos)
      .force("link", forceLink<N, A>(aristas).distance((a) => 230 / Math.sqrt(a.lift)).strength(0.15))
      .force("carga", forceManyBody().strength(-700))
      .force("lado", forceX<N>((n) => (n.comunidad === 0 ? W * 0.3 : W * 0.72)).strength(0.12))
      .force("alto", forceY<N>(H / 2).strength(0.09))
      .force("centro", forceCenter(W / 2, H / 2)).force("choque", forceCollide<N>((n) => n.r + 18)).stop();
    for (let i = 0; i < 400; i++) sim.tick();
    // las especies sin vínculos fuertes (lift < 2 con todas) van en una fila abajo; el resto llena el lienzo
    const conVinculo = new Set(aristas.flatMap((a) => [a.source, a.target]));
    const red = nodos.filter((n) => conVinculo.has(n)), solas = nodos.filter((n) => !conVinculo.has(n));
    const [x0, x1] = [Math.min(...red.map((n) => n.x)), Math.max(...red.map((n) => n.x))];
    const [y0, y1] = [Math.min(...red.map((n) => n.y)), Math.max(...red.map((n) => n.y))];
    const bajo = solas.length ? 80 : 30;
    red.forEach((n) => { n.x = 60 + ((n.x - x0) / (x1 - x0 || 1)) * (W - 120); n.y = 40 + ((n.y - y0) / (y1 - y0 || 1)) * (H - 40 - bajo - 20); });
    solas.forEach((n, i) => { n.x = 80 + i * 110; n.y = H - 30; });
    return { nodos, aristas };
  }, [datos]);
  const [activo, setActivo] = useState<N | null>(null);
  const vecinos = useMemo(() => {
    if (!activo) return null;
    const v = aristas.filter((a) => a.source === activo || a.target === activo).map((a) => ({ n: a.source === activo ? a.target : a.source, lift: a.lift }));
    return v.sort((a, b) => b.lift - a.lift);
  }, [activo, aristas]);
  const enVecinos = (n: N) => !activo || n === activo || vecinos!.some((v) => v.n === n);
  const color = (h: string | null) => HABITATS.find((x) => x.id === h)?.color ?? "var(--texto-suave)";
  const maxLift = Math.max(...aristas.map((a) => a.lift));

  return (
    <div className="red-grid">
      <div>
        <div className="vista__controles"><Leyenda items={HABITATS} /></div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Red de co-ocurrencia de las 40 especies más avistadas" onPointerLeave={() => setActivo(null)}>
          {nodos.some((n) => n.y === H - 30) && <text x={20} y={H - 60}>Sin vínculos fuertes (aparecen con casi todas):</text>}
          {aristas.map((a, i) => {
            const on = activo && (a.source === activo || a.target === activo);
            return <line key={i} x1={a.source.x} y1={a.source.y} x2={a.target.x} y2={a.target.y}
              stroke={on ? "var(--foco)" : "var(--texto-suave)"} strokeOpacity={activo ? (on ? 0.9 : 0.04) : 0.12 + (a.lift / maxLift) * 0.35}
              strokeWidth={0.6 + (a.lift / maxLift) * 4} />;
          })}
          {nodos.map((n) => (
            <g key={n.sci} transform={`translate(${n.x},${n.y})`} className="marca" style={{ opacity: enVecinos(n) ? 1 : 0.2 }}
              tabIndex={0} role="button" aria-label={`${n.nombre}: ${pctTxt(n.pct)} de las salidas completas`}
              onPointerEnter={() => setActivo(n)} onFocus={() => setActivo(n)}>
              <circle r={n.r} fill={color(n.habitat)} stroke={n === activo ? "var(--texto)" : "var(--superficie)"} strokeWidth={n === activo ? 2.5 : 1.5} />
              <text y={n.r + 13} textAnchor="middle" className={n === activo ? "t-fuerte" : ""}>{n.nombre}</text>
            </g>
          ))}
        </svg>
      </div>
      <div aria-live="polite">
        {activo ? (
          <>
            <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>Se ve junto a</p>
            <h3 className="titulo-3" style={{ margin: "4px 0 12px" }}><a href={`/especies/${activo.slug}/`} style={{ color: "var(--texto)" }}>{activo.nombre}</a></h3>
            <ol className="lista-rank">
              {vecinos!.slice(0, 10).map((v) => (
                <li key={v.n.sci}><span>{v.n.nombre}</span><span className="barra-mini"><span style={{ width: `${(v.lift / maxLift) * 100}%`, background: "var(--foco)" }} /></span><span className="num">×{es(v.lift, 1)}</span></li>
              ))}
            </ol>
            <p className="pie">Lift: cuántas veces más coinciden que si fueran independientes.</p>
          </>
        ) : (
          <p className="cuerpo-s" style={{ marginTop: 48 }}>Pasa sobre una especie para ver con quién aparece. A la izquierda queda la comunidad de tierra y a la derecha la de agua (Louvain).</p>
        )}
      </div>
    </div>
  );
}
