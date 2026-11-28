"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { select, zoom, zoomIdentity, type ZoomBehavior } from "d3";
import geo from "@/lib/chile-geo.json";
import type { DatosMapa } from "@/lib/laminas-datos";
import { LOCALIDADES } from "@/lib/ciudades";
import { Icono } from "@/components/Icono";
import { es, Tip, useTooltip } from "./comun";

type Celda = DatosMapa["celdas"][number];
type Orient = "horizontal" | "vertical";
const R = Math.PI / 180;
const merc = (lon: number, lat: number) => [1000 * lon * R, -1000 * Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2))];
const NIVEL = ["bajo", "medio", "alto"];

function proyectar(o: Orient) {
  const { rotar, x0, y0, k } = geo[o].proj;
  return (lon: number, lat: number) => {
    const [x, y] = merc(lon, lat);
    const [a, b] = rotar ? [y, -x] : [x, y];
    return [(a - x0) * k, (b - y0) * k];
  };
}

function km(a: [number, number], b: [number, number]) {
  const dLat = (b[0] - a[0]) * R, dLon = (b[1] - a[1]) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const FILTROS = [
  { id: "todas", txt: "Todas las celdas" },
  { id: "explorar", txt: "Especies en un nivel más alto que las salidas" },
  { id: "visitadas", txt: "Salidas en nivel alto" },
] as const;

/** Rango (mín–máx) de salidas y de especies en cada nivel: así «bajo / medio / alto» se leen con números. */
function rangos(celdas: Celda[]) {
  const r = (col: 2 | 3, cls: 4 | 5) => [0, 1, 2].map((n) => {
    const v = celdas.filter((c) => c[cls] === n).map((c) => c[col]);
    return v.length ? [Math.min(...v), Math.max(...v)] as [number, number] : null;
  });
  return { salidas: r(2, 4), especies: r(3, 5) };
}

function Lienzo({ o, celdas, filtro, fija, mover, salir, fijar }: {
  o: Orient; celdas: Celda[]; filtro: string; fija: Celda | null;
  mover: (e: React.PointerEvent | React.FocusEvent, d: Celda) => void; salir: () => void; fijar: (d: Celda) => void;
}) {
  const g = geo[o];
  const p = useMemo(() => proyectar(o), [o]);
  const H = o === "horizontal";
  const svgRef = useRef<SVGSVGElement>(null), gRef = useRef<SVGGElement>(null);
  const zRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [k, setK] = useState(1);
  const kRef = useRef(1);
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
    return [x0, y0, Math.max(g.width, ...xs) + 4 - x0, Math.max(g.height, ...ys) + 4 - y0];
  }, [rects, g.width, g.height]);

  // zoom: rueda o pellizco, arrastre y botones; el contenido queda recortado al marco
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const z = zoom<SVGSVGElement, unknown>().scaleExtent([1, 12])
      .translateExtent([[vb[0], vb[1]], [vb[0] + vb[2], vb[1] + vb[3]]])
      .extent([[vb[0], vb[1]], [vb[0] + vb[2], vb[1] + vb[3]]])
      // la rueda solo acerca con Ctrl/⌘ y un dedo solo arrastra con zoom: así la página sigue desplazándose
      .filter((e) => e.type === "wheel" ? e.ctrlKey || e.metaKey : e.type === "touchstart" ? e.touches.length > 1 || kRef.current > 1 : !e.button)
      .on("zoom", (e) => { gRef.current!.setAttribute("transform", e.transform.toString()); kRef.current = e.transform.k; setK(e.transform.k); });
    select(svgRef.current).call(z).on("dblclick.zoom", null);
    zRef.current = z;
    const svg = svgRef.current;
    return () => { select(svg).on(".zoom", null); };
  }, [vb]);
  const zoomA = (f: "mas" | "menos" | "todo") => {
    const svg = svgRef.current, z = zRef.current; if (!svg || !z) return;
    if (f === "todo") select(svg).transition().duration(350).call(z.transform, zoomIdentity);
    else select(svg).transition().duration(250).call(z.scaleBy, f === "mas" ? 1.8 : 1 / 1.8);
  };
  const sel = fija ? rects.find((r) => r.c === fija) : null;
  // al tocar una celda, el mapa se acerca a ella (al menos ×3) para reconocer el sector
  const acercarA = (r: (typeof rects)[number]) => {
    const svg = svgRef.current, z = zRef.current; if (!svg || !z) return;
    const kk = Math.max(kRef.current, 3), cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
    select(svg).transition().duration(450).call(z.transform, zoomIdentity.translate(cx - kk * (r.x + r.w / 2), cy - kk * (r.y + r.h / 2)).scale(kk));
  };

  return (
    <div className={`bv-marco bv-marco--${H ? "h" : "v"}`}>
      <svg ref={svgRef} className={`mapa__svg bv-svg mapa__svg--${H ? "h" : "v"}`} viewBox={vb.join(" ")} role="img"
        aria-label="Mapa de Chile por celdas de 0,25 grados, coloreadas por salidas y especies">
        <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="transparent" />
        <g ref={gRef}>
          {Object.values(g.zonas as Record<string, string>).map((d, i) => <path key={i} d={d} fill="var(--superficie-hundida)" />)}
          <g className={filtro !== "todas" ? "atenuar" : ""}>
            {rects.map((r, i) => (
              <rect key={i} className={`marca${pasa(r.c) ? " on" : ""}`} x={r.x} y={r.y} width={r.w + 0.3} height={r.h + 0.3}
                fill={`var(--bv-${r.c[4]}${r.c[5]})`} onPointerMove={(e) => mover(e, r.c)} onPointerLeave={salir}
                onClick={() => { fijar(r.c); acercarA(r); }} />
            ))}
          </g>
          {sel && <rect x={sel.x - 0.6 / k} y={sel.y - 0.6 / k} width={sel.w + 1.2 / k} height={sel.h + 1.2 / k} fill="none" stroke="var(--texto)" strokeWidth={2 / k} pointerEvents="none" />}
        </g>
      </svg>
      <div className="bv-zoom" role="group" aria-label="Zoom del mapa">
        <button type="button" onClick={() => zoomA("mas")} aria-label="Acercar">+</button>
        <button type="button" onClick={() => zoomA("menos")} aria-label="Alejar" disabled={k <= 1}>−</button>
        <button type="button" onClick={() => zoomA("todo")} aria-label="Ver todo Chile" disabled={k <= 1}><Icono nombre="rueda" tam={16} /></button>
      </div>
    </div>
  );
}

/** Ficha fija de la celda elegida: cifras, referencia cercana, coordenadas copiables y enlace a Google Maps. */
function FichaCelda({ c, r, cerrar }: { c: Celda; r: ReturnType<typeof rangos>; cerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const [lat, lon] = c;
  const ref = useMemo(() => {
    const l = LOCALIDADES.map((x) => ({ x, d: km([lat, lon], [x[2], x[3]]) })).sort((a, b) => a.d - b.d)[0];
    return l ? { nombre: l.x[0], region: l.x[1], d: l.d } : null;
  }, [lat, lon]);
  const coords = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  const anchoKm = Math.round(0.25 * 111.3 * Math.cos(lat * R)), altoKm = Math.round(0.25 * 111.1);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(coords); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { setCopiado(false); }
  };
  const rango = (v: [number, number] | null) => (v ? `${es(v[0])}–${es(v[1])}` : "—");
  return (
    <article className="bv-ficha" aria-live="polite">
      <div className="bv-ficha__cab">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>Celda elegida{ref ? ` · cerca de ${ref.nombre}` : ""}</p>
        <button type="button" className="bv-ficha__cerrar" onClick={cerrar} aria-label="Cerrar la ficha de la celda">×</button>
      </div>
      <h3 className="titulo-3" style={{ margin: "4px 0 10px" }}>
        {ref ? <>A {es(Math.round(ref.d))} km de {ref.nombre} <span className="apoyo">({ref.region})</span></> : "Celda sin referencia cercana"}
      </h3>
      <dl className="bv-ficha__cifras">
        <div><dt>Especies</dt><dd>{es(c[3])}</dd><small>nivel {NIVEL[c[5]]} ({rango(r.especies[c[5]])})</small></div>
        <div><dt>Salidas</dt><dd>{es(c[2])}</dd><small>nivel {NIVEL[c[4]]} ({rango(r.salidas[c[4]])})</small></div>
      </dl>
      <div className="bv-ficha__coords">
        <span className="mono">{coords}</span>
        <button type="button" className="btn btn--secundario" onClick={copiar}><Icono nombre="copiar" tam={16} />{copiado ? "Copiadas" : "Copiar coordenadas"}</button>
        <a className="btn btn--secundario" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`} target="_blank" rel="noopener">
          <Icono nombre="pin" tam={16} />Ver en Google Maps <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="pie" style={{ margin: "8px 0 0" }}>
        Las coordenadas son el centro aproximado de una celda de unos {anchoKm} × {altoKm} km. No marcan un acceso ni un sitio de observación:
        pueden caer en un predio privado, en el mar o lejos de un camino.
      </p>
    </article>
  );
}

export function MapaBivariado({ datos }: { datos: DatosMapa }) {
  const [filtro, setFiltro] = useState<string>("todas");
  const [fija, setFija] = useState<Celda | null>(null);
  const { ref, tip, mover, salir } = useTooltip<Celda>();
  const n = datos.celdas.filter((c) => c[5] > c[4]).length;
  const r = useMemo(() => rangos(datos.celdas), [datos.celdas]);
  const rango = (v: [number, number] | null) => (v ? `${es(v[0])}–${es(v[1])}` : "—");
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <ul className="chips" aria-label="Filtrar celdas">
          {FILTROS.map((f) => <li key={f.id}><button type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.txt}{f.id === "explorar" ? ` (${n})` : ""}</button></li>)}
        </ul>
      </div>
      {filtro === "explorar" && (
        <p className="apoyo pequeno" style={{ margin: "0 0 8px" }}>
          Celdas cuyo nivel de especies es más alto que su nivel de salidas. Sirve para encontrar lugares que llaman la atención,
          pero no demuestra que tengan más especies de lo esperable: el nivel no controla el área, los hábitats ni el tipo de salida.
        </p>
      )}
      <Lienzo o="horizontal" celdas={datos.celdas} filtro={filtro} fija={fija} mover={mover} salir={salir} fijar={setFija} />
      <Lienzo o="vertical" celdas={datos.celdas} filtro={filtro} fija={fija} mover={mover} salir={salir} fijar={setFija} />
      <div className="bv-leyenda">
        <div className="bv-leyenda__grilla" aria-hidden="true">
          {[2, 1, 0].map((ri) => [0, 1, 2].map((e) => <i key={`${e}${ri}`} style={{ background: `var(--bv-${e}${ri})` }} />))}
        </div>
        <div className="cuerpo-s bv-leyenda__txt">
          <p style={{ margin: 0 }}><b>↑ Especies</b> · bajo {rango(r.especies[0])} · medio {rango(r.especies[1])} · alto {rango(r.especies[2])}</p>
          <p style={{ margin: 0 }}><b>→ Salidas</b> · bajo {rango(r.salidas[0])} · medio {rango(r.salidas[1])} · alto {rango(r.salidas[2])}</p>
          <p className="apoyo" style={{ margin: 0 }}>Cada nivel reúne un tercio de las celdas, ordenadas de menor a mayor valor.</p>
        </div>
      </div>
      <p className="apoyo pequeno bv-pista"><Icono nombre="ojo" tam={14} />Toca una celda para acercarte y ver su ficha. También puedes usar + y −, dos dedos o Ctrl + rueda.</p>
      {fija && <FichaCelda c={fija} r={r} cerrar={() => setFija(null)} />}
      {tip && !fija && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{es(tip.d[3])} especies</b>
          <span>{es(tip.d[2])} salidas · clic para ver la ficha</span>
        </Tip>
      )}
    </div>
  );
}
