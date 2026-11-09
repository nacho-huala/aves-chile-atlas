"use client";
import { useMemo, useState } from "react";
import geo from "@/lib/chile-geo.json";
import type { DatosMapa } from "@/lib/laminas-datos";
import { es, Tip, useTooltip } from "./comun";

type Celda = DatosMapa["celdas"][number];
type Orient = "horizontal" | "vertical";
const R = Math.PI / 180;
const merc = (lon: number, lat: number) => [1000 * lon * R, -1000 * Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2))];

function proyectar(o: Orient) {
  const { rotar, x0, y0, k } = geo[o].proj;
  return (lon: number, lat: number) => {
    const [x, y] = merc(lon, lat);
    const [a, b] = rotar ? [y, -x] : [x, y];
    return [(a - x0) * k, (b - y0) * k];
  };
}

const FILTROS = [
  { id: "todas", txt: "Todas las celdas" },
  { id: "explorar", txt: "Por explorar: más especies que salidas" },
  { id: "visitadas", txt: "Las más visitadas" },
] as const;

function Lienzo({ o, celdas, filtro, mover, salir }: { o: Orient; celdas: Celda[]; filtro: string; mover: (e: React.PointerEvent | React.FocusEvent, d: Celda) => void; salir: () => void }) {
  const g = geo[o];
  const p = useMemo(() => proyectar(o), [o]);
  const H = o === "horizontal";
  const rects = useMemo(() => celdas.map((c) => {
    const [lat, lon] = c;
    const a = p(lon - 0.125, lat + 0.125), b = p(lon + 0.125, lat - 0.125);
    return { c, x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
  }), [celdas, p]);
  const pasa = (c: Celda) => filtro === "todas" || (filtro === "explorar" ? c[5] > c[4] : c[4] === 2);
  // el encuadre cubre el contorno y todas las celdas (algunas caen en el mar o al este del límite)
  const vb = useMemo(() => {
    const xs = rects.flatMap((r) => [r.x, r.x + r.w]), ys = rects.flatMap((r) => [r.y, r.y + r.h]);
    const x0 = Math.min(0, ...xs) - 4, y0 = Math.min(0, ...ys) - 4;
    return `${x0} ${y0} ${Math.max(g.width, ...xs) + 4 - x0} ${Math.max(g.height, ...ys) + 4 - y0}`;
  }, [rects, g.width, g.height]);
  return (
    <svg className={`mapa__svg mapa__svg--${H ? "h" : "v"}`} viewBox={vb} role="img" aria-label="Mapa de Chile por celdas de 0,25 grados, coloreadas por salidas y especies">
      {Object.values(g.zonas as Record<string, string>).map((d, i) => <path key={i} d={d} fill="var(--superficie-hundida)" />)}
      <g className={filtro !== "todas" ? "atenuar" : ""}>
        {rects.map((r, i) => (
          <rect key={i} className={`marca${pasa(r.c) ? " on" : ""}`} x={r.x} y={r.y} width={r.w + 0.3} height={r.h + 0.3}
            fill={`var(--bv-${r.c[4]}${r.c[5]})`} onPointerMove={(e) => mover(e, r.c)} onPointerLeave={salir} />
        ))}
      </g>
    </svg>
  );
}

export function MapaBivariado({ datos }: { datos: DatosMapa }) {
  const [filtro, setFiltro] = useState<string>("todas");
  const { ref, tip, mover, salir } = useTooltip<Celda>();
  const n = datos.celdas.filter((c) => c[5] > c[4]).length;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <ul className="chips" aria-label="Filtrar celdas">
          {FILTROS.map((f) => <li key={f.id}><button type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.txt}{f.id === "explorar" ? ` (${n})` : ""}</button></li>)}
        </ul>
      </div>
      <Lienzo o="horizontal" celdas={datos.celdas} filtro={filtro} mover={mover} salir={salir} />
      <Lienzo o="vertical" celdas={datos.celdas} filtro={filtro} mover={mover} salir={salir} />
      <div className="bv-leyenda" aria-hidden="true">
        <div className="bv-leyenda__grilla">
          {[2, 1, 0].map((r) => [0, 1, 2].map((e) => <i key={`${e}${r}`} style={{ background: `var(--bv-${e}${r})` }} />))}
        </div>
        <div className="cuerpo-s"><b>↑ más especies</b><br /><b>→ más salidas</b><br />Terciles de cada eje.</div>
      </div>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{es(tip.d[3])} especies</b>
          <span>{es(tip.d[2])} salidas · {es(Math.abs(tip.d[0]), 2)}° S, {es(Math.abs(tip.d[1]), 2)}° O</span>
        </Tip>
      )}
    </div>
  );
}
