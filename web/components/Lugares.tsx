"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { KbaSitio } from "@/lib/data";
import { COLOR_MACROZONA, geo, MACROZONAS, proyectarVertical } from "@/lib/geo";
import { RecuadrosIslas } from "@/components/RecuadrosIslas";
import { MESES, MESES_LARGOS, entero } from "@/lib/formato";

const { P, recuadros } = proyectarVertical();
const G = geo.vertical;

function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const mesPico = (s: KbaSitio) => s.meses.indexOf(Math.max(...s.meses));

/** Mapa vertical de Chile con los sitios que tienen punto (derivado de eBird). Se encuadra en la selección. */
function MapaSitios({ sitios, foco, sel, pos, elegir }: {
  sitios: KbaSitio[]; foco: KbaSitio[]; sel: number | null; pos: [number, number] | null; elegir: (id: number) => void;
}) {
  const maxS = Math.max(...sitios.map((s) => s.salidas));
  const r = (s: KbaSitio) => 2.5 + 9 * Math.sqrt(s.salidas / maxS);
  const pts = useMemo(() => sitios.filter((s) => s.punto).map((s) => ({ s, xy: P(s.punto![1], s.punto![0]) })), [sitios]);
  // encuadre: todo Chile o la caja de los sitios en foco (+ la ubicación del usuario)
  const vb = useMemo(() => {
    const xy = foco.filter((s) => s.punto).map((s) => P(s.punto![1], s.punto![0]));
    if (pos) xy.push(P(pos[1], pos[0]));
    if (foco.length === sitios.length || xy.length < 2) return { x: -6, y: -6, w: G.width + 12, h: G.height + 12 };
    const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const h = Math.max(y1 - y0, 120) * 1.25, w = Math.max(x1 - x0 + 40, h * 0.42);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = cx - w / 2; y0 = cy - h / 2; x1 = x0 + w; y1 = y0 + h;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [foco, sitios.length, pos]);
  const k = vb.h / (G.height + 12); // escala para que los círculos no crezcan al acercar
  const enFoco = new Set(foco.map((s) => s.id));
  const acercado = k < 0.98; // con zoom, los recuadros de islas quedarían fuera de lugar

  return (
    <svg className="kba-mapa" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label="Mapa de Chile con los sitios KBA que tienen punto de referencia de eBird">
      {Object.values(G.zonas as Record<string, string>).map((d, i) => <path key={i} d={d} fill="var(--superficie-hundida)" stroke="var(--linea)" strokeWidth={0.6 * k} />)}
      {!acercado && <RecuadrosIslas recuadros={recuadros} u={vb.h / 1000} />}
      {pts.map(({ s, xy }) => (
        <circle key={s.id} cx={xy[0]} cy={xy[1]} r={r(s) * Math.max(k, 0.25)} fill={COLOR_MACROZONA[s.macrozona ?? ""] ?? "var(--texto-suave)"}
          fillOpacity={enFoco.has(s.id) ? 0.85 : 0.18} stroke={sel === s.id ? "var(--texto)" : "var(--superficie)"} strokeWidth={(sel === s.id ? 2.5 : 0.8) * Math.max(k, 0.25)}
          tabIndex={enFoco.has(s.id) ? 0 : -1} role="button" pointerEvents={enFoco.has(s.id) ? undefined : "none"} aria-label={`${s.nombre}: ${s.especies} especies`} style={{ cursor: "pointer" }}
          onClick={() => elegir(s.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(s.id); } }}>
          <title>{`${s.nombre} · ${s.especies} especies · ${entero(s.salidas)} salidas`}</title>
        </circle>
      ))}
      {pos && (() => { const [x, y] = P(pos[1], pos[0]); const s = Math.max(k, 0.25); return (
        <g pointerEvents="none"><circle cx={x} cy={y} r={9 * s} fill="none" stroke="var(--foco)" strokeWidth={2 * s} /><circle cx={x} cy={y} r={3 * s} fill="var(--foco)" /></g>); })()}
    </svg>
  );
}

function DetalleSitio({ s, d }: { s: KbaSitio; d: number | null }) {
  const max = Math.max(...s.meses, 1), pico = mesPico(s);
  return (
    <article className="panel kba-detalle" aria-live="polite">
      <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>{[s.region, s.macrozona].filter(Boolean).join(" · ")}{d !== null ? ` · a ${entero(Math.round(d))} km` : ""}</p>
      <h3 style={{ margin: ".3rem 0 .8rem" }}>{s.nombre}</h3>
      <dl className="kba-cifras">
        <div><dt>Especies</dt><dd>{entero(s.especies)}</dd></div>
        <div><dt>Salidas</dt><dd>{entero(s.salidas)}</dd></div>
        <div><dt>Por salida</dt><dd>{s.riqueza ?? "—"}</dd></div>
        {s.nGatillo ? <div><dt>Aves clave vistas</dt><dd>{s.gatilloVistas}/{s.nGatillo}</dd></div> : null}
      </dl>
      <p className="apoyo pequeno" style={{ margin: "1rem 0 .3rem" }}>Salidas por mes · mejor mes: <strong>{MESES_LARGOS[pico]}</strong></p>
      <svg viewBox="0 0 360 70" width="100%" role="img" aria-label="Salidas por mes en el sitio">
        {s.meses.map((v, i) => { const h = (v / max) * 48; return (
          <g key={i}><rect x={i * 30 + 4} y={52 - h} width={22} height={h} rx={2} fill={i === pico ? "var(--foco)" : "var(--musgo-3)"} />
            <text x={i * 30 + 15} y={66} textAnchor="middle" fontSize={10}>{MESES[i]}</text></g>); })}
      </svg>
      <p className="apoyo pequeno" style={{ margin: "1rem 0 .4rem" }}>Qué puedes encontrar (% de salidas completas del sitio)</p>
      <ul className="kba-aves">
        {s.top.slice(0, 12).map((e) => (
          <li key={e.slug}>
            <Link href={`/especies/${e.slug}/`}>{e.nombre}</Link>
            <span className="kba-aves__barra" aria-hidden="true"><i style={{ width: `${e.p ?? 0}%` }} /></span>
            <span className="mono pequeno">{e.p !== null ? `${Math.round(e.p)} %` : "—"}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Lugares({ sitios }: { sitios: KbaSitio[] }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [estado, setEstado] = useState<"" | "buscando" | "error">("");
  const [zona, setZona] = useState("");
  const [sel, setSel] = useState<number | null>(sitios[0]?.id ?? null);
  const detalleRef = useRef<HTMLDivElement>(null);

  function ubicar() {
    if (!navigator.geolocation) { setEstado("error"); return; }
    setEstado("buscando");
    // La ubicación se usa solo en tu navegador para ordenar la lista; no se envía a ningún servidor.
    navigator.geolocation.getCurrentPosition(
      (p) => { const q: [number, number] = [p.coords.latitude, p.coords.longitude]; setPos(q); setZona(""); setEstado("");
        const cerca = sitios.filter((s) => s.punto).sort((a, b) => km(q, a.punto!) - km(q, b.punto!))[0]; if (cerca) setSel(cerca.id); },
      () => setEstado("error"), { timeout: 10000 });
  }

  // vuelve a la vista general desde una macrozona o desde «mi ubicación»
  function verTodo() { setPos(null); setZona(""); setEstado(""); }
  // en el celular el detalle queda bajo el mapa y la lista: al elegir un sitio, se muestra
  function elegir(id: number) {
    setSel(id);
    if (window.matchMedia("(max-width: 860px)").matches) requestAnimationFrame(() => detalleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const lista = useMemo(() => {
    if (pos) return sitios.filter((s) => s.punto).map((s) => ({ s, d: km(pos, s.punto!) })).sort((a, b) => a.d - b.d).slice(0, 10);
    return sitios.filter((s) => !zona || s.macrozona === zona).map((s) => ({ s, d: null as number | null }));
  }, [sitios, pos, zona]);
  const foco = useMemo(() => (pos || zona ? lista.map((x) => x.s) : sitios), [lista, pos, zona, sitios]);
  const elegido = sitios.find((s) => s.id === sel) ?? lista[0]?.s;
  const dElegido = pos && elegido?.punto ? km(pos, elegido.punto) : null;

  return (
    <div>
      <div className="controles">
        <button type="button" className="btn btn--primario" onClick={ubicar}>Usar mi ubicación</button>
        <label>…o elige una macrozona
          <select value={zona} onChange={(e) => { setZona(e.target.value); setPos(null); const p = sitios.find((s) => !e.target.value || s.macrozona === e.target.value); if (p) setSel(p.id); }}>
            <option value="">Todo Chile</option>
            {MACROZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        {(pos || zona) && <button type="button" className="btn btn--secundario" onClick={verTodo}>Volver a todo Chile</button>}
      </div>
      <p className="pie" role="status">
        {estado === "buscando" && "Buscando tu ubicación…"}
        {estado === "error" && "No pudimos obtener tu ubicación. Elige una macrozona."}
        {!estado && pos && "Los 10 sitios más cercanos a ti. Tu ubicación no sale de tu navegador."}
        {!estado && !pos && "Círculo = sitio (tamaño según salidas, color según macrozona). Toca uno para ver qué aves tiene."}
      </p>
      <div className="kba-grid">
        <div className="kba-grid__mapa">
          <MapaSitios sitios={sitios} foco={foco} sel={elegido?.id ?? null} pos={pos} elegir={elegir} />
          <ul className="aa-leyenda" aria-hidden="true" style={{ marginTop: 8 }}>
            {MACROZONAS.map((z) => <li key={z}><i style={{ background: COLOR_MACROZONA[z], borderRadius: "50%" }} />{z}</li>)}
          </ul>
        </div>
        <div className="kba-grid__lista">
          <ol className="kba-lista">
            {lista.map(({ s, d }) => (
              <li key={s.id}>
                <button type="button" aria-pressed={elegido?.id === s.id} onClick={() => elegir(s.id)}>
                  <i style={{ background: COLOR_MACROZONA[s.macrozona ?? ""] }} aria-hidden="true" />
                  <span><b>{s.nombre}</b><br /><span className="apoyo pequeno">{[s.region, d !== null ? `${entero(Math.round(d))} km` : null, !s.punto ? "sin punto en el mapa" : null].filter(Boolean).join(" · ")}</span></span>
                  <span className="mono pequeno">{s.especies} spp.</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="kba-grid__detalle" ref={detalleRef}>{elegido && <DetalleSitio s={elegido} d={dElegido} />}</div>
      </div>
    </div>
  );
}
