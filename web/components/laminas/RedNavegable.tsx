"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, scaleSqrt, select, zoom, zoomIdentity, type ZoomBehavior } from "d3";
import type { DatosRedB, NodoRedB } from "@/lib/laminas-datos";
import { es, HABITATS, Leyenda, pctTxt } from "./comun";
import { Icono } from "@/components/Icono";

type N = NodoRedB & { i: number; x: number; y: number; r: number };
type A = { source: N; target: N; lift: number; juntas: number };
const COM_COL = ["var(--cat-musgo)", "var(--cat-mar)", "var(--cat-vino)", "var(--cat-ocre)", "var(--cat-ciruela)", "var(--texto-suave)"];
const VW = 1000, VH = 620; // viewBox del lienzo
const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Red de co-ocurrencia navegable: arrastrar para moverse, rueda/pellizco/botones para acercar; clic fija una especie. */
export function RedNavegable() {
  const [datos, setDatos] = useState<DatosRedB | null>(null);
  const [cuantas, setCuantas] = useState(80);
  const [minLift, setMinLift] = useState(2.5);
  const [colorPor, setColorPor] = useState<"habitat" | "comunidad">("comunidad");
  const [hover, setHover] = useState<N | null>(null);
  const [fija, setFija] = useState<N | null>(null);
  const [k, setK] = useState(1);
  const [q, setQ] = useState("");
  const svgRef = useRef<SVGSVGElement>(null), gRef = useRef<SVGGElement>(null);
  const zRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => { fetch("/data/laminas/red_ampliada.json").then((r) => r.json()).then(setDatos).catch(() => setDatos(null)); }, []);

  // layout: comunidades en una elipse; dentro, d3-force con vínculos más cortos cuanto más fuerte el lift
  const { nodos, aristas } = useMemo(() => {
    if (!datos) return { nodos: [] as N[], aristas: [] as A[] };
    const sel = datos.nodos.map((n, i) => ({ n, i })).sort((a, b) => b.n.pct - a.n.pct).slice(0, cuantas);
    const r = scaleSqrt().domain([0, Math.max(...sel.map((x) => x.n.pct))]).range([4, 20]);
    const ncom = Math.max(...datos.comunidades.map((c) => c.id)) + 1;
    const centro = (c: number) => [VW / 2 + Math.cos((c / ncom) * 2 * Math.PI - Math.PI / 2) * VW * 0.32, VH / 2 + Math.sin((c / ncom) * 2 * Math.PI - Math.PI / 2) * VH * 0.32];
    const nodos = sel.map(({ n, i }) => { const [cx, cy] = centro(n.c); return { ...n, i, r: r(n.pct), x: cx + (Math.random() - .5) * 40, y: cy + (Math.random() - .5) * 40 }; }) as N[];
    const por = new Map(nodos.map((n) => [n.i, n]));
    const aristas = datos.aristas.filter(([a, b, l]) => l >= minLift && por.has(a) && por.has(b))
      .map(([a, b, lift, juntas]) => ({ source: por.get(a)!, target: por.get(b)!, lift, juntas })) as A[];
    const sim = forceSimulation(nodos)
      .force("link", forceLink<N, A>(aristas).distance((a) => 140 / Math.sqrt(a.lift)).strength((a) => Math.min(0.3, 0.03 * a.lift)))
      .force("carga", forceManyBody<N>().strength(-120))
      .force("x", forceX<N>((n) => centro(n.c)[0]).strength(0.06)).force("y", forceY<N>((n) => centro(n.c)[1]).strength(0.06))
      .force("choque", forceCollide<N>((n) => n.r + 4)).stop();
    for (let t = 0; t < 350; t++) sim.tick();
    return { nodos, aristas };
  }, [datos, cuantas, minLift]);

  // zoom y arrastre (solo dentro del lienzo)
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const z = zoom<SVGSVGElement, unknown>().scaleExtent([0.35, 8]).on("zoom", (e) => {
      gRef.current!.setAttribute("transform", e.transform.toString()); setK(e.transform.k);
    });
    select(svgRef.current).call(z).on("dblclick.zoom", null);
    zRef.current = z;
    return () => { select(svgRef.current!).on(".zoom", null); };
  }, [datos]);
  // encuadre inicial cada vez que cambia la red
  useEffect(() => {
    if (!nodos.length || !svgRef.current || !zRef.current) return;
    const xs = nodos.map((n) => n.x), ys = nodos.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs) - 40, Math.max(...xs) + 40, Math.min(...ys) - 40, Math.max(...ys) + 40];
    const s = Math.min(VW / (x1 - x0), VH / (y1 - y0), 1.6);
    select(svgRef.current).call(zRef.current.transform, zoomIdentity.translate(VW / 2 - s * (x0 + x1) / 2, VH / 2 - s * (y0 + y1) / 2).scale(s));
  }, [nodos]);

  const accion = (f: "mas" | "menos" | "ajustar") => {
    const svg = svgRef.current, z = zRef.current; if (!svg || !z) return;
    if (f === "ajustar") { setFija(null); const n = nodos; if (!n.length) return; const xs = n.map((x) => x.x), ys = n.map((x) => x.y);
      const [x0, x1, y0, y1] = [Math.min(...xs) - 40, Math.max(...xs) + 40, Math.min(...ys) - 40, Math.max(...ys) + 40];
      const s = Math.min(VW / (x1 - x0), VH / (y1 - y0), 1.6);
      select(svg).transition().duration(400).call(z.transform, zoomIdentity.translate(VW / 2 - s * (x0 + x1) / 2, VH / 2 - s * (y0 + y1) / 2).scale(s)); return; }
    select(svg).transition().duration(250).call(z.scaleBy, f === "mas" ? 1.5 : 1 / 1.5);
  };
  const centrar = (n: N) => {
    setFija(n);
    if (svgRef.current && zRef.current) select(svgRef.current).transition().duration(500)
      .call(zRef.current.transform, zoomIdentity.translate(VW / 2 - 2.2 * n.x, VH / 2 - 2.2 * n.y).scale(2.2));
  };

  const activo = fija ?? hover;
  const vecinos = useMemo(() => activo ? aristas.filter((a) => a.source === activo || a.target === activo)
    .map((a) => ({ n: a.source === activo ? a.target : a.source, lift: a.lift, juntas: a.juntas })).sort((a, b) => b.lift - a.lift) : [], [activo, aristas]);
  const enFoco = new Set(activo ? [activo, ...vecinos.map((v) => v.n)] : []);
  // color de cada barrio = color de su hábitat dominante (mismo código que el modo «hábitat»); si dos barrios comparten hábitat, el segundo toma un color libre
  const colorBarrio = useMemo(() => {
    const m = new Map<number, string>(), usados = new Set<string>();
    for (const c of datos?.comunidades ?? []) {
      const h = HABITATS.find((x) => x.id === c.habitat)?.color;
      const col = h && !usados.has(h) ? h : [...HABITATS.map((x) => x.color), ...COM_COL].find((x) => !usados.has(x)) ?? COM_COL[5];
      usados.add(col); m.set(c.id, col);
    }
    return m;
  }, [datos]);
  const color = (n: N) => colorPor === "comunidad" ? colorBarrio.get(n.c) ?? COM_COL[5] : HABITATS.find((h) => h.id === n.habitat)?.color ?? "var(--texto-suave)";
  const maxLift = Math.max(2, ...aristas.map((a) => a.lift));
  const coincidencias = q.trim() ? nodos.filter((n) => sinTildes(n.nombre).includes(sinTildes(q.trim()))).slice(0, 6) : [];
  const etiquetaVisible = (n: N) => (activo ? enFoco.has(n) : n.r * k > 13 || k > 2.2);
  const HAB_TXT: Record<string, string> = Object.fromEntries(HABITATS.map((h) => [h.id, h.txt]));

  if (!datos) return <div className="plan-cargando">Cargando la red…</div>;
  return (
    <div className="red-nav">
      <div className="red-nav__controles">
        <div className="chips" role="radiogroup" aria-label="Cuántas especies">
          {[40, 80, 150].map((c) => <button key={c} type="button" role="radio" aria-checked={cuantas === c} onClick={() => { setCuantas(c); setFija(null); }}>{c} especies</button>)}
        </div>
        <label className="red-nav__lift">Lift mínimo <b>×{es(minLift, 1)}</b>
          <input type="range" min={2} max={6} step={0.5} value={minLift} onChange={(e) => { setMinLift(Number(e.target.value)); setFija(null); }} />
        </label>
        <div className="chips" role="radiogroup" aria-label="Color">
          <button type="button" role="radio" aria-checked={colorPor === "comunidad"} onClick={() => setColorPor("comunidad")}>Color: barrio</button>
          <button type="button" role="radio" aria-checked={colorPor === "habitat"} onClick={() => setColorPor("habitat")}>Color: hábitat</button>
        </div>
        <div className="red-nav__buscar">
          <Icono nombre="ave" tam={16} />
          <input type="search" placeholder="Buscar una especie…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar una especie en la red" />
          {coincidencias.length > 0 && (
            <ul className="combo__lista">{coincidencias.map((n) => <li key={n.slug} onMouseDown={(e) => { e.preventDefault(); centrar(n); setQ(""); }}><span className="sin-foto" style={{ background: color(n) }} /><span>{n.nombre}</span><small>{pctTxt(n.pct)}</small></li>)}</ul>
          )}
        </div>
      </div>
      {colorPor === "comunidad"
        ? <ul className="aa-leyenda" aria-label="Barrios de especies">{datos.comunidades.map((c) => <li key={c.id}><i style={{ background: colorBarrio.get(c.id) }} />{c.habitat ? HAB_TXT[c.habitat] ?? c.habitat : "Mixto"} · como {c.ejemplo}<b>· {nodos.filter((n) => n.c === c.id).length}</b></li>)}</ul>
        : <Leyenda items={HABITATS} />}

      <div className="red-nav__grid">
        <div className="red-nav__lienzo">
          <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={`Red de ${nodos.length} especies y ${aristas.length} vínculos`} onClick={() => setFija(null)}>
            <rect width={VW} height={VH} fill="transparent" />
            <g ref={gRef}>
              {aristas.map((a, i) => {
                const on = activo && (a.source === activo || a.target === activo);
                return <line key={i} x1={a.source.x} y1={a.source.y} x2={a.target.x} y2={a.target.y} stroke={on ? "var(--foco)" : "var(--texto-suave)"}
                  strokeOpacity={activo ? (on ? 0.85 : 0.03) : 0.06 + (a.lift / maxLift) * 0.3} strokeWidth={(0.5 + (a.lift / maxLift) * 3) / Math.sqrt(k)} />;
              })}
              {nodos.map((n) => (
                <g key={n.slug} transform={`translate(${n.x},${n.y})`} style={{ opacity: !activo || enFoco.has(n) ? 1 : 0.18, cursor: "pointer" }}
                  onPointerEnter={() => setHover(n)} onPointerLeave={() => setHover(null)} onClick={(e) => { e.stopPropagation(); setFija(fija === n ? null : n); }}>
                  <circle r={n.r} fill={color(n)} stroke={n === activo ? "var(--texto)" : "var(--superficie)"} strokeWidth={(n === activo ? 2.5 : 1.2) / Math.sqrt(k)} />
                  {etiquetaVisible(n) && <text y={n.r + 11 / k} textAnchor="middle" fontSize={11 / k} className={n === activo ? "t-fuerte" : ""}
                    style={{ paintOrder: "stroke", stroke: "var(--superficie)", strokeWidth: 3 / k }}>{n.nombre}</text>}
                </g>
              ))}
            </g>
          </svg>
          <div className="red-nav__zoom" role="group" aria-label="Zoom">
            <button type="button" onClick={() => accion("mas")} aria-label="Acercar">+</button>
            <button type="button" onClick={() => accion("menos")} aria-label="Alejar">−</button>
            <button type="button" onClick={() => accion("ajustar")} aria-label="Ver toda la red"><Icono nombre="rueda" tam={16} /></button>
          </div>
          <p className="red-nav__pista"><Icono nombre="ojo" tam={14} />Arrastra para moverte · rueda o pellizco para acercar · clic en una especie para fijarla</p>
        </div>

        <aside className="red-nav__panel" aria-live="polite">
          {activo ? (
            <>
              <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>{fija ? "Especie fijada" : "Se ve junto a"}</p>
              <h3 className="titulo-3" style={{ margin: "4px 0 2px" }}><a href={`/especies/${activo.slug}/`}>{activo.nombre}</a></h3>
              <p className="apoyo pequeno" style={{ margin: "0 0 12px" }}>Aparece en {pctTxt(activo.pct)} de las salidas completas · {vecinos.length} vínculos</p>
              {vecinos[0] ? (
                <p className="pie red-nav__lift-ej" style={{ margin: "0 0 12px" }}>
                  <b>Cómo leer el ×:</b> {activo.nombre} y {vecinos[0].n.nombre} se registran juntas {es(vecinos[0].lift, 1)} veces lo esperado si sus registros fueran
                  independientes (lift ×{es(vecinos[0].lift, 1)}). Es una medida del par, no de la especie sola: no dice que una cause la presencia de la otra
                  ni que tengas {es(vecinos[0].lift, 1)} veces más probabilidad de verla en cualquier salida.
                </p>
              ) : <p className="pie">Sin vínculos sobre el lift mínimo elegido.</p>}
              {vecinos.length > 0 && <p className="dato-eti" style={{ margin: "0 0 4px" }}>Especie con la que se registra · lift del par</p>}
              <ol className="lista-rank">
                {vecinos.slice(0, 12).map((v) => (
                  <li key={v.n.slug}><button type="button" className="red-nav__vecino" onClick={() => centrar(v.n)}>{v.n.nombre}</button>
                    <span className="barra-mini"><span style={{ width: `${(v.lift / maxLift) * 100}%`, background: "var(--foco)" }} /></span><span className="num">×{es(v.lift, 1)}</span></li>
                ))}
              </ol>

            </>
          ) : (
            <div className="red-nav__explica">
              <p className="dato-eti" style={{ marginTop: 0 }}>¿Cómo se arma esta red?</p>
              <p>Revisamos <b>407 mil salidas</b> en que la persona anotó todas las aves que vio, y contamos qué especies aparecen <b>juntas en la misma salida</b>.</p>
              <p>Si dos especies coinciden mucho más de lo que pasaría por casualidad, las unimos con una línea. Esa razón se llama <b>lift</b>: por ejemplo, el Pilpilén y el Zarapito se registran juntos unas 7 veces lo esperado si sus registros fueran independientes, porque comparten la playa. El lift describe al par, no causa ni probabilidad de ver una especie.</p>
              <ul className="red-nav__claves">
                <li><b>Tamaño:</b> % de salidas en que se registra la especie.</li>
                <li><b>Línea:</b> más gruesa, mayor lift del par.</li>
                <li><b>Color:</b> barrio que forma la red sola, o hábitat principal.</li>
                <li><b>Posición:</b> cada barrio ocupa una zona; la distancia exacta no se mide.</li>
              </ul>
              <p>Sin decirle nada sobre hábitats, la red se ordena sola en <b>barrios</b>: aves de humedal, de costa, de bosque, de matorral…</p>
              <p className="apoyo pequeno">Pasa sobre una especie o búscala para ver con quién se junta.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
