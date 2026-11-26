"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CIUDADES } from "@/lib/ciudades";
import { cercanos, indexar, km, planificar, type DatosPlan, type Origen } from "@/lib/planificador";
import { MESES, MESES_LARGOS, entero } from "@/lib/formato";
import { Icono } from "@/components/Icono";
import { MapaPlan } from "./MapaPlan";
import { Compartir } from "./Compartir";
import { aURL, deURL, origenParaURL, urlGoogleMaps } from "@/lib/compartir";

const RADIOS = [{ v: 60, t: "60 km" }, { v: 150, t: "150 km" }, { v: 400, t: "400 km" }, { v: Infinity, t: "Todo Chile" }];
const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** 0,42 → "4 de cada 10 salidas" (o "1 de cada N" si es baja) */
function frecuencia(p: number) {
  if (p >= 0.095) return `${Math.round(p * 10)} de cada 10 salidas`;
  if (p <= 0) return "sin registros en salidas completas";
  return `1 de cada ${Math.round(1 / p)} salidas`;
}

/** Cambia de estado con View Transitions cuando el navegador lo permite (mejora progresiva). */
function conTransicion(f: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(f));
  else f();
}

function Medidor({ p }: { p: number }) {
  return <span className="medidor" aria-hidden="true"><i style={{ width: `${Math.max(2, p * 100)}%` }} /></span>;
}

export default function Planificador() {
  const [datos, setDatos] = useState<DatosPlan | null>(null);
  const [error, setError] = useState(false);
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [texto, setTexto] = useState("");
  const [gps, setGps] = useState<"" | "buscando" | "error">("");
  const [radio, setRadio] = useState(150);
  const [modo, setModo] = useState<"cerca" | "lista">("cerca");
  const [sel, setSel] = useState<number | null>(null);
  const [lista, setLista] = useState<number[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    fetch("/data/planificador.json").then((r) => r.json()).then((d: DatosPlan) => {
      setDatos(d);
      // estado inicial desde la URL: ?desde=Castro&modo=lista&lista=slug,slug&radio=400&sitio=ID (o ?especie=slug desde la ficha)
      const u = deURL();
      if (u.desde) {
        const c = CIUDADES.find((x) => sinTildes(x[0]) === sinTildes(u.desde!)), s = d.s.find((x) => sinTildes(x.nombre) === sinTildes(u.desde!));
        const m = u.desde.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
        if (c) { setOrigen({ nombre: c[0], punto: [c[2], c[3]], tipo: "ciudad" }); setTexto(c[0]); }
        else if (s) { setOrigen({ nombre: s.nombre, punto: s.punto, tipo: "sitio" }); setTexto(s.nombre); }
        else if (m) setOrigen({ nombre: "Punto compartido", punto: [Number(m[1]), Number(m[2])], tipo: "ciudad" });
      }
      if (u.radio !== undefined && !Number.isNaN(u.radio)) setRadio(u.radio);
      const slugs = [...(u.lista ?? []), ...(u.especie ? [u.especie] : [])];
      const idx = slugs.map((sl) => d.e.findIndex((e) => e[0] === sl)).filter((i) => i >= 0);
      if (idx.length) setLista([...new Set(idx)]);
      if (u.modo === "lista" || u.especie) setModo("lista");
      if (u.sitio !== undefined) { const i = d.s.findIndex((x) => x.id === u.sitio); if (i >= 0) setSel(i); }
      setListo(true);
    }).catch(() => setError(true));
  }, []);
  const prob = useMemo(() => (datos ? indexar(datos) : null), [datos]);

  function ubicar() {
    if (!navigator.geolocation) { setGps("error"); return; }
    setGps("buscando");
    // La ubicación se usa solo en tu navegador; no se envía a ningún servidor.
    navigator.geolocation.getCurrentPosition((p) => {
      const punto: [number, number] = [p.coords.latitude, p.coords.longitude];
      const c = [...CIUDADES].sort((a, b) => km(punto, [a[2], a[3]]) - km(punto, [b[2], b[3]]))[0];
      setGps(""); setTexto("");
      conTransicion(() => { setOrigen({ nombre: "Tu ubicación", punto, tipo: "gps", precision: p.coords.accuracy / 1000, cerca: c ? `${c[0]} (a ${Math.round(km(punto, [c[2], c[3]]))} km)` : undefined }); setSel(null); });
    }, () => setGps("error"), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }
  function elegirTexto(v: string) {
    setTexto(v);
    const c = CIUDADES.find((x) => sinTildes(x[0]) === sinTildes(v.trim()));
    if (c) conTransicion(() => { setOrigen({ nombre: c[0], punto: [c[2], c[3]], tipo: "ciudad" }); setSel(null); });
    const s = datos?.s.find((x) => sinTildes(x.nombre) === sinTildes(v.trim()));
    if (s && !c) conTransicion(() => { setOrigen({ nombre: s.nombre, punto: s.punto, tipo: "sitio" }); setSel(null); });
  }

  const cerca = useMemo(() => (datos && origen ? cercanos(datos, origen.punto, radio, 8) : []), [datos, origen, radio]);
  // especies presentes en los sitios dentro del radio: base de los atajos, para que las listas sean alcanzables
  const disponibles = useMemo(() => {
    const m = new Map<number, number>(); // especie → % máximo en un sitio del radio
    if (!datos || !prob) return m;
    datos.s.forEach((s, i) => {
      if (origen && radio !== Infinity && km(origen.punto, s.punto) > radio) return;
      prob[i].forEach((x, e) => m.set(e, Math.max(m.get(e) ?? 0, x.p)));
    });
    return m;
  }, [datos, prob, origen, radio]);
  const plan = useMemo(() => (datos && prob && lista.length ? planificar(datos, prob, lista, origen?.punto ?? null, { radio, maxParadas: lista.length > 25 ? 10 : lista.length > 8 ? 8 : 5 }) : null), [datos, prob, lista, origen, radio]);

  // la URL refleja el plan (sin la ubicación exacta), para que «copiar enlace» reproduzca lo mismo
  const urlPlan = useMemo(() => {
    if (!datos || !listo) return "";
    return aURL({ desde: origenParaURL(origen), modo, lista: lista.map((i) => datos.e[i][0]), radio, sitio: modo === "cerca" && sel !== null ? datos.s[sel].id : undefined });
  }, [datos, listo, origen, modo, lista, radio, sel]);
  useEffect(() => { if (urlPlan) window.history.replaceState(null, "", urlPlan); }, [urlPlan]);

  if (error) return <p className="aviso"><Icono nombre="alerta" tam={16} />No pudimos cargar los datos del planificador.</p>;
  if (!datos || !prob) return <div className="plan-cargando" role="status">Cargando sitios y especies…</div>;

  const destacados = modo === "cerca" ? cerca.map((x) => x.i) : plan?.paradas.map((p) => p.i) ?? [];
  const ruta = modo === "lista" ? destacados : [];
  const elegido = sel ?? destacados[0] ?? null;

  return (
    <div className="plan">
      {/* Paso 1 · punto de partida */}
      <section className="plan-paso" aria-labelledby="paso1">
        <h2 id="paso1" className="plan-paso__t"><span className="plan-paso__n">1</span>¿Desde dónde sales?</h2>
        <div className="plan-origen">
          <button type="button" className="btn btn--primario" onClick={ubicar}><Icono nombre="pin" tam={18} />Usar mi ubicación</button>
          <span className="apoyo">o</span>
          <BuscadorLugar datos={datos} texto={texto} setTexto={elegirTexto} />
        </div>
        <p className="pie" role="status">
          {gps === "buscando" && "Buscando tu ubicación…"}
          {gps === "error" && "No pudimos obtener tu ubicación. Escribe una ciudad."}
          {!gps && origen && origen.tipo !== "gps" && <>Partida: <b>{origen.nombre}</b>. Distancias en línea recta.</>}
          {!gps && origen?.tipo === "gps" && <>Partida: <b>tu ubicación</b>, cerca de <b>{origen.cerca}</b>{origen.precision ? ` · precisión ±${origen.precision < 1 ? "<1" : Math.round(origen.precision)} km` : ""}. No sale de tu navegador.</>}
          {!gps && !origen && "Puede ser donde estás o adonde vas a viajar. Sin punto de partida, el plan recorre todo Chile."}
        </p>
        {origen?.tipo === "gps" && (origen.precision ?? 0) > 15 && (
          <p className="aviso"><Icono nombre="alerta" tam={16} />Tu navegador entregó una ubicación aproximada (sin GPS, suele calcularse por la red). Si no estás cerca de {origen.cerca?.split(" (")[0]}, escribe tu ciudad arriba.</p>
        )}
        <div className="plan-radio" role="radiogroup" aria-label="Distancia máxima">
          <span className="dato-eti">Hasta</span>
          {RADIOS.map((r) => <button key={r.t} type="button" role="radio" aria-checked={radio === r.v} onClick={() => conTransicion(() => setRadio(r.v))}>{r.t}</button>)}
        </div>
      </section>

      {/* Paso 2 · qué quieres */}
      <section className="plan-paso" aria-labelledby="paso2">
        <h2 id="paso2" className="plan-paso__t"><span className="plan-paso__n">2</span>¿Qué quieres hacer?</h2>
        <div className="segmentado" role="tablist" aria-label="Modo del planificador">
          <button role="tab" aria-selected={modo === "cerca"} onClick={() => conTransicion(() => { setModo("cerca"); setSel(null); })}>
            <Icono nombre="binoculares" tam={18} /><span><b>Ver qué hay cerca</b><small>Sitios clave y qué aves esperar en cada uno</small></span>
          </button>
          <button role="tab" aria-selected={modo === "lista"} onClick={() => conTransicion(() => { setModo("lista"); setSel(null); })}>
            <Icono nombre="ave" tam={18} /><span><b>Buscar especies concretas</b><small>La ruta más corta para ver tu lista</small></span>
          </button>
        </div>
        {modo === "lista" && <SelectorEspecies datos={datos} lista={lista} setLista={setLista} disponibles={disponibles} hayOrigen={!!origen && radio !== Infinity} />}
      </section>

      {/* Paso 3 · el plan */}
      <section className="plan-paso plan-resultado" aria-labelledby="paso3">
        <h2 id="paso3" className="plan-paso__t"><span className="plan-paso__n">3</span>Tu plan</h2>
        <div className="plan-grid">
          <div className="plan-grid__mapa">
            <MapaPlan sitios={datos.s} destacados={destacados} ruta={ruta} origen={origen?.punto ?? null} sel={elegido} elegir={(i) => conTransicion(() => setSel(i))} />
          </div>
          <div className="plan-grid__panel">
            {modo === "cerca"
              ? <PanelCerca datos={datos} prob={prob} cerca={cerca} origen={origen} elegido={elegido} setSel={setSel} lista={lista}
                  agregar={(e) => setLista((l) => (l.includes(e) ? l : [...l, e]))} irALista={() => conTransicion(() => setModo("lista"))} urlPlan={urlPlan} />
              : <PanelLista datos={datos} plan={plan} lista={lista} origen={origen} radio={radio} setSel={setSel} elegido={elegido} urlPlan={urlPlan} />}
          </div>
        </div>
      </section>
      <p className="pie">{datos.nota}</p>
    </div>
  );
}

/** Combobox de ciudades y sitios: la lista siempre aparece bajo el campo (la del navegador cambia de lugar según el sistema). */
function BuscadorLugar({ datos, texto, setTexto }: { datos: DatosPlan; texto: string; setTexto: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false), [act, setAct] = useState(0);
  const opciones = useMemo(() => {
    const t = sinTildes(texto.trim());
    if (!t) return [];
    const todas = [...CIUDADES.map((c) => ({ n: c[0], d: c[1], kba: false })), ...datos.s.map((s) => ({ n: s.nombre, d: s.region ?? "", kba: true }))];
    const rango = (n: string) => { const x = sinTildes(n); return x.startsWith(t) ? 0 : x.split(/[\s,-]/).some((w) => w.startsWith(t)) ? 1 : x.includes(t) ? 2 : 9; };
    return todas.map((o) => ({ ...o, r: rango(o.n) })).filter((o) => o.r < 9 && sinTildes(o.n) !== t).sort((a, b) => a.r - b.r || Number(a.kba) - Number(b.kba) || a.n.localeCompare(b.n, "es")).slice(0, 8);
  }, [texto, datos]);
  const elegir = (n: string) => { setTexto(n); setAbierto(false); setAct(0); };
  return (
    <div className="plan-buscar combo-lugar" role="combobox" aria-expanded={abierto && opciones.length > 0} aria-haspopup="listbox" aria-owns="lugar-lista">
      <Icono nombre="mapa" tam={18} />
      <input value={texto} placeholder="Escribe una ciudad o un sitio: Castro, Putre, Humedal…" aria-label="Ciudad o sitio de partida" aria-autocomplete="list" aria-controls="lugar-lista"
        aria-activedescendant={opciones[act] ? `lugar-${act}` : undefined}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setAct(0); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAct((a) => Math.min(a + 1, opciones.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAct((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && opciones[act]) { e.preventDefault(); elegir(opciones[act].n); }
          if (e.key === "Escape") setAbierto(false);
        }} />
      {abierto && opciones.length > 0 && (
        <ul id="lugar-lista" role="listbox" className="combo__lista combo-lugar__lista">
          {opciones.map((o, k) => (
            <li key={`${o.n}-${o.kba}`} id={`lugar-${k}`} role="option" aria-selected={k === act} onMouseDown={(ev) => { ev.preventDefault(); elegir(o.n); }} onMouseEnter={() => setAct(k)}>
              <span className="combo-lugar__ico"><Icono nombre={o.kba ? "pin" : "mapa"} tam={16} /></span><span>{o.n}</span><small>{o.kba ? `${o.d} · sitio clave` : o.d}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectorEspecies({ datos, lista, setLista, disponibles, hayOrigen }: { datos: DatosPlan; lista: number[]; setLista: (f: (l: number[]) => number[]) => void; disponibles: Map<number, number>; hayOrigen: boolean }) {
  const [q, setQ] = useState(""), [abierto, setAbierto] = useState(false), [act, setAct] = useState(0);
  const [cant, setCant] = useState(16); // tamaño de las listas sugeridas (Infinity = todas las disponibles)
  const ref = useRef<HTMLInputElement>(null);
  const opciones = useMemo(() => {
    const t = sinTildes(q.trim());
    if (!t) return [];
    // primero los nombres que empiezan con el texto, luego los que lo tienen al inicio de una palabra, luego el resto
    const rango = (n: string) => (n.startsWith(t) ? 0 : n.split(/[\s-]/).some((w) => w.startsWith(t)) ? 1 : 2);
    return datos.e.map((e, i) => ({ e, i, n: sinTildes(e[1]) })).filter(({ n, e, i }) => !lista.includes(i) && (n.includes(t) || e[0].includes(t.replace(/ /g, "-"))))
      .sort((a, b) => rango(a.n) - rango(b.n) || b.e[4] - a.e[4]).slice(0, 8);
  }, [q, datos, lista]);
  const agregar = (i: number) => { setLista((l) => [...l, i]); setQ(""); setAct(0); ref.current?.focus(); };
  const todas = datos.e.map((e, i) => ({ e, i })).filter((x) => disponibles.has(x.i));
  const porFrec = [...todas].sort((a, b) => b.e[4] - a.e[4]);
  const ATAJOS_BASE: { t: string; icono: string; ids: () => number[] }[] = [
    { t: "Al azar", icono: "rueda", ids: () => [...todas].sort(() => Math.random() - 0.5).slice(0, cant).map((x) => x.i) },
    { t: "Las más vistas", icono: "binoculares", ids: () => porFrec.slice(0, cant).map((x) => x.i) },
    // raras en Chile pero con al menos un sitio donde aparecen en ≥ 5 % de las salidas: difíciles, no imposibles
    { t: "Raras pero posibles", icono: "ojo", ids: () => todas.filter((x) => (disponibles.get(x.i) ?? 0) >= 0.05)
        .sort((a, b) => a.e[4] - b.e[4]).slice(0, cant).map((x) => x.i) },
    { t: "Amenazadas (UICN)", icono: "alerta", ids: () => todas.filter((x) => ["VU", "EN", "CR"].includes(x.e[5] ?? "")).slice(0, cant).map((x) => x.i) },
    { t: "Endémicas de Chile", icono: "pin", ids: () => todas.filter((x) => x.e[3] === "endémica").slice(0, cant).map((x) => x.i) },
    { t: "Migratorias", icono: "ola", ids: () => porFrec.filter((x) => x.e[3] === "migratoria / estacional").slice(0, cant).map((x) => x.i) },
  ];
  // cada atajo muestra cuántas especies trae; se ocultan los que quedarían vacíos en tu radio
  const ATAJOS = ATAJOS_BASE.map((a) => ({ ...a, n: a.ids().length })).filter((a) => a.n > 0);

  return (
    <div className="plan-especies">
      <div className="combo" role="combobox" aria-expanded={abierto && opciones.length > 0} aria-haspopup="listbox" aria-owns="combo-lista">
        <Icono nombre="ave" tam={18} />
        <input ref={ref} value={q} placeholder="Agrega especies: Rayadito, Cóndor, Chucao…" aria-autocomplete="list" aria-controls="combo-lista"
          aria-activedescendant={opciones[act] ? `op-${opciones[act].i}` : undefined}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); setAct(0); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAct((a) => Math.min(a + 1, opciones.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setAct((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && opciones[act]) { e.preventDefault(); agregar(opciones[act].i); }
            if (e.key === "Backspace" && !q && lista.length) setLista((l) => l.slice(0, -1));
          }} />
        {abierto && opciones.length > 0 && (
          <ul id="combo-lista" role="listbox" className="combo__lista">
            {opciones.map(({ e, i }, k) => (
              <li key={i} id={`op-${i}`} role="option" aria-selected={k === act} onMouseDown={(ev) => { ev.preventDefault(); agregar(i); }} onMouseEnter={() => setAct(k)}>
                {e[2] ? <img src={e[2]} alt="" loading="lazy" /> : <span className="sin-foto" />}<span>{e[1]}</span><small>{e[3]}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="plan-chips">
        {lista.map((i) => (
          <button key={i} type="button" className="chip-especie" onClick={() => setLista((l) => l.filter((x) => x !== i))} aria-label={`Quitar ${datos.e[i][1]}`}>
            {datos.e[i][2] ? <img src={datos.e[i][2]!} alt="" /> : <span className="sin-foto" />}{datos.e[i][1]}<span aria-hidden="true">×</span>
          </button>
        ))}
        {lista.length > 0 && <button type="button" className="chip-atajo" onClick={() => setLista(() => [])}>Limpiar lista</button>}
      </div>
      <div className="atajos" role="group" aria-label="Listas sugeridas">
        <span className="dato-eti">{lista.length ? "Reemplazar por" : "O parte con una lista"}{hayOrigen ? " · cerca de ti" : ""}</span>
        <span className="atajos__cant" role="radiogroup" aria-label="Cuántas especies por lista">
          {[10, 16, 25, 40, Infinity].map((c) => <button key={c} type="button" role="radio" aria-checked={cant === c} onClick={() => setCant(c)}>{Number.isFinite(c) ? c : "Todas"}</button>)}
        </span>
        {ATAJOS.map((a) => (
          <button key={a.t} type="button" className="chip-atajo" onClick={() => setLista(() => a.ids())}>
            <Icono nombre={a.icono} tam={14} />{a.t}<span className="chip-atajo__n">{a.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FotoMini({ src }: { src: string | null }) { return src ? <img className="foto-mini" src={src} alt="" loading="lazy" /> : <span className="foto-mini sin-foto" />; }

function PanelCerca({ datos, prob, cerca, origen, elegido, setSel, lista, agregar, irALista, urlPlan }: {
  datos: DatosPlan; prob: ReturnType<typeof indexar>; cerca: ReturnType<typeof cercanos>; origen: Origen | null; elegido: number | null;
  setSel: (i: number) => void; lista: number[]; agregar: (e: number) => void; irALista: () => void; urlPlan: string;
}) {
  const [ver, setVer] = useState<{ cant: number; orden: string; tipo: string; dieta: string; habitat: string; semilla: number }>(
    { cant: 12, orden: "aqui", tipo: "", dieta: "", habitat: "", semilla: 1 });
  if (!origen) return <Vacio icono="pin" t="Elige un punto de partida" d="Te mostraremos los sitios clave más cercanos y qué aves se registran en cada uno." />;
  if (!cerca.length) return <Vacio icono="mapa" t="No hay sitios con datos en ese radio" d="Amplía la distancia máxima en el paso 1." />;
  const s = elegido !== null ? datos.s[elegido] : cerca[0].s, i = elegido ?? cerca[0].i;
  // explorador: filtra por tipo, dieta y hábitat, y ordena de distintas formas (no siempre la misma lista)
  const RIESGO: Record<string, number> = { CR: 0, EN: 1, VU: 2, NT: 3, LC: 4, DD: 5 };
  const mezcla = (e: number) => ((e * 9301 + ver.semilla * 49297) % 233280) / 233280;
  const filtradas = [...prob[i].entries()].filter(([e]) => (!ver.tipo || datos.e[e][3] === ver.tipo) && (!ver.dieta || datos.e[e][6] === ver.dieta) && (!ver.habitat || datos.e[e][7] === ver.habitat));
  const ORDENES: Record<string, (a: [number, { p: number }], b: [number, { p: number }]) => number> = {
    aqui: (a, b) => b[1].p - a[1].p, menos: (a, b) => a[1].p - b[1].p,
    rara: (a, b) => datos.e[a[0]][4] - datos.e[b[0]][4], comun: (a, b) => datos.e[b[0]][4] - datos.e[a[0]][4],
    riesgo: (a, b) => (RIESGO[datos.e[a[0]][5] ?? ""] ?? 9) - (RIESGO[datos.e[b[0]][5] ?? ""] ?? 9) || b[1].p - a[1].p,
    azar: (a, b) => mezcla(a[0]) - mezcla(b[0]),
  };
  const todasOrd = filtradas.sort(ORDENES[ver.orden]);
  const aves = todasOrd.slice(0, ver.cant);
  const total = prob[i].size;
  const cambiar = (c: Partial<typeof ver>) => setVer((v) => ({ ...v, ...c }));
  const etiqueta = (e: number) => ver.orden === "rara" || ver.orden === "comun" ? `en Chile: ${datos.e[e][4] < 0.1 ? "rara" : datos.e[e][4] < 1 ? "poco común" : "común"}`
    : ver.orden === "riesgo" && datos.e[e][5] ? `UICN ${datos.e[e][5]}` : null;
  const mesTop = s.meses.indexOf(Math.max(...s.meses));
  return (
    <div className="plan-cerca">
      <ol className="plan-sitios" aria-label="Sitios más cercanos">
        {cerca.map((c) => (
          <li key={c.s.id}><button type="button" aria-pressed={c.i === i} onClick={() => setSel(c.i)}>
            <b>{c.s.nombre}</b><span className="apoyo pequeno">{c.s.region} · {entero(Math.round(c.d))} km</span><span className="num">{c.s.especies}<small>spp.</small></span>
          </button></li>
        ))}
      </ol>
      <article className="plan-ficha" style={{ viewTransitionName: "plan-ficha" }}>
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>{s.region}{origen ? ` · a ${entero(Math.round(km(origen.punto, s.punto)))} km de ${origen.nombre}` : ""}</p>
        <h3>{s.nombre}</h3>
        <dl className="plan-cifras">
          <div><dt>En una salida típica</dt><dd>{s.riqueza ?? "—"}<small> especies</small></dd></div>
          <div><dt>Registradas en total</dt><dd>{s.especies}</dd></div>
          <div><dt>Mes más visitado</dt><dd>{MESES_LARGOS[mesTop]}</dd></div>
        </dl>
        <div className="explorar-aves" role="group" aria-label="Explorar las aves de este sitio">
          <label>Mostrar<select value={ver.cant} onChange={(e) => cambiar({ cant: Number(e.target.value) })}>
            {[6, 12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}<option value={Infinity}>Todas</option></select></label>
          <label>Ordenar por<select value={ver.orden} onChange={(e) => cambiar({ orden: e.target.value })}>
            <option value="aqui">Más vistas aquí</option><option value="menos">Menos vistas aquí</option>
            <option value="rara">Más raras en Chile</option><option value="comun">Más comunes en Chile</option>
            <option value="riesgo">Mayor riesgo (UICN)</option><option value="azar">Al azar</option></select></label>
          <label>Tipo<select value={ver.tipo} onChange={(e) => cambiar({ tipo: e.target.value })}>
            <option value="">Todas</option><option value="nativa residente">Nativas residentes</option><option value="endémica">Endémicas</option>
            <option value="migratoria / estacional">Migratorias</option><option value="introducida">Introducidas</option></select></label>
          <label>Dieta<select value={ver.dieta} onChange={(e) => cambiar({ dieta: e.target.value })}>
            <option value="">Todas</option><option value="invertívora">Insectívoras</option><option value="carnívora / pescadora">Carnívoras y pescadoras</option>
            <option value="granívora / herbívora">Granívoras y herbívoras</option><option value="nectarívora / frugívora">Néctar y frutos</option><option value="omnívora">Omnívoras</option></select></label>
          <label>Hábitat<select value={ver.habitat} onChange={(e) => cambiar({ habitat: e.target.value })}>
            <option value="">Todos</option><option value="humedal">Humedal</option><option value="costa">Costa y mar</option><option value="bosque">Bosque</option>
            <option value="matorral">Matorral y pradera</option><option value="ciudad">Ciudad</option></select></label>
          {ver.orden === "azar" && <button type="button" className="chip-atajo" onClick={() => cambiar({ semilla: ver.semilla + 1 })}><Icono nombre="rueda" tam={14} />Otra mezcla</button>}
        </div>
        <p className="dato-eti" role="status">Mostrando {aves.length} de {todasOrd.length}{todasOrd.length < total ? ` (filtradas de ${total})` : ""} · frecuencia en salidas completas</p>
        {!aves.length && <p className="apoyo">Ninguna especie de este sitio cumple esos filtros.</p>}
        <ul className="plan-aves">
          {aves.map(([e, x]) => (
            <li key={e}>
              <FotoMini src={datos.e[e][2]} />
              <span><Link href={`/especies/${datos.e[e][0]}/`}>{datos.e[e][1]}</Link><small>{frecuencia(x.p)}{x.mes ? ` · más en ${MESES[x.mes - 1]}` : ""}{etiqueta(e) ? ` · ${etiqueta(e)}` : ""}</small></span>
              <Medidor p={x.p} />
              <button type="button" className="mas" aria-label={`Agregar ${datos.e[e][1]} a mi lista`} aria-pressed={lista.includes(e)} onClick={() => agregar(e)}>{lista.includes(e) ? "✓" : "+"}</button>
            </li>
          ))}
        </ul>
        {todasOrd.length > aves.length && (
          <button type="button" className="btn btn--secundario plan-ver-todas" onClick={() => cambiar({ cant: ver.cant >= 48 ? Infinity : ver.cant * 2 })}>
            Ver más ({todasOrd.length - aves.length} restantes)
          </button>
        )}
        {lista.length > 0 && <button type="button" className="btn btn--secundario" onClick={irALista}>Planificar mi lista ({lista.length}) <span className="flecha" aria-hidden="true">→</span></button>}
      </article>
      <div className="plan-cerca__compartir">
        <Compartir url={urlPlan} maps={urlGoogleMaps(origen.punto, [s.punto])} lugar={`${s.nombre}, ${s.region ?? "Chile"}`}
          texto={`Salida de observación de aves a ${s.nombre} (${s.region}). Podría ver: ${aves.slice(0, 6).map(([e, x]) => `${datos.e[e][1]} (${Math.max(1, Math.round(x.p * 10))}/10)`).join(", ")}.`}
          tarjeta={{
            eyebrow: `Salida de observación · ${s.region ?? ""}`, titulo: s.nombre,
            subtitulo: `${s.riqueza ?? "—"} especies en una salida típica · a ${entero(Math.round(km(origen.punto, s.punto)))} km de ${origen.tipo === "gps" ? (origen.cerca?.split(" (")[0] ?? "mi ubicación") : origen.nombre}`,
            origen: origen.punto, puntos: [s.punto],
            bloques: [{ titulo: "Qué puedo ver", detalle: ver.orden === "aqui" && !ver.tipo && !ver.dieta && !ver.habitat ? `Mes más visitado: ${MESES_LARGOS[mesTop]}` : `Selección: ${[ver.tipo, ver.dieta, ver.habitat].filter(Boolean).join(", ") || ({ menos: "menos vistas aquí", rara: "más raras en Chile", comun: "más comunes en Chile", riesgo: "mayor riesgo UICN", azar: "al azar", aqui: "más vistas aquí" } as Record<string, string>)[ver.orden]}`, especies: aves.slice(0, 30).map(([e, x]) => ({ nombre: datos.e[e][1], p: x.p, foto: datos.e[e][2] })) }],
            contexto: datos.s.map((z) => z.punto),
            pie: "Sitio clave para la biodiversidad (KBA) · datos de eBird",
          }} />
      </div>
    </div>
  );
}

function PanelLista({ datos, plan, lista, origen, radio, elegido, setSel, urlPlan }: {
  datos: DatosPlan; plan: ReturnType<typeof planificar> | null; lista: number[]; origen: Origen | null; radio: number; elegido: number | null; setSel: (i: number) => void; urlPlan: string;
}) {
  if (!lista.length || !plan) return <Vacio icono="ave" t="Arma tu lista de especies" d="Agrégalas en el paso 2. Buscaremos la menor cantidad de sitios, lo más cerca posible, donde tengas buenas opciones de verlas." />;
  const buenas = plan.especies.filter((x) => x.prob >= 0.5).length;
  return (
    <div className="plan-lista">
      <dl className="plan-resumen">
        <div><dt>Paradas</dt><dd>{plan.paradas.length}</dd></div>
        <div><dt>Recorrido aprox.</dt><dd>{plan.kmTotal !== null ? `${entero(Math.round(plan.kmTotal))} km` : "—"}</dd></div>
        <div><dt>Con buena opción</dt><dd>{buenas}<small>/{lista.length}</small></dd></div>
      </dl>
      {!plan.paradas.length && <Vacio icono="mapa" t="Ningún sitio en ese radio tiene esas especies" d={radio === Infinity ? "Pueden ser especies raras o de lugares sin punto publicable." : "Prueba con una distancia mayor en el paso 1."} />}
      <ol className="itinerario">
        {plan.paradas.map((p, n) => (
          <li key={p.s.id} data-on={elegido === p.i}>
            <span className="itinerario__n">{n + 1}</span>
            <button type="button" className="itinerario__cab" onClick={() => setSel(p.i)}>
              <b>{p.s.nombre}</b><span className="apoyo pequeno">{p.s.region}{p.d !== null ? ` · ${entero(Math.round(p.d))} km desde ${origen?.nombre}` : ""}</span>
            </button>
            <ul>
              {p.aporta.map((a) => (
                <li key={a.e}><FotoMini src={datos.e[a.e][2]} /><span>{datos.e[a.e][1]}<small>{frecuencia(a.p)}{a.mes ? ` · mejor en ${MESES[a.mes - 1]}` : ""}</small></span><Medidor p={a.p} /></li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="dato-eti">Probabilidad de verla al menos una vez en el viaje</p>
      <ul className="plan-prob">
        {[...plan.especies].sort((a, b) => b.prob - a.prob).map((x) => (
          <li key={x.e}><Link href={`/especies/${datos.e[x.e][0]}/`}>{datos.e[x.e][1]}</Link><Medidor p={x.prob} /><span className="num">{Math.round(x.prob * 100)} %</span></li>
        ))}
      </ul>
      {plan.sinSitio.length > 0 && (
        <p className="aviso"><Icono nombre="alerta" tam={16} />Sin registros en sitios clave: {plan.sinSitio.map((e) => datos.e[e][1]).join(", ")}. Revisa su ficha para ver dónde y cuándo aparece.</p>
      )}
      {plan.paradas.length > 0 && (
        <Compartir url={urlPlan} maps={urlGoogleMaps(origen?.punto ?? null, plan.paradas.map((p) => p.s.punto))}
          lugar={plan.paradas.map((p) => p.s.nombre).join(" → ")}
          texto={[`Mi ruta para ver ${lista.length} especies de aves en ${plan.paradas.length} paradas:`,
            ...plan.paradas.map((p, n) => `${n + 1}. ${p.s.nombre} (${p.s.region}): ${p.aporta.map((a) => datos.e[a.e][1]).join(", ")}`)].join("\n")}
          tarjeta={{
            eyebrow: "Ruta de observación", titulo: `${lista.length} especies en ${plan.paradas.length} ${plan.paradas.length === 1 ? "parada" : "paradas"}`,
            subtitulo: `${origen ? `Desde ${origen.tipo === "gps" ? (origen.cerca?.split(" (")[0] ?? "mi ubicación") : origen.nombre} · ` : ""}${plan.kmTotal !== null ? `unos ${entero(Math.round(plan.kmTotal))} km en línea recta` : ""}`,
            origen: origen?.punto ?? null, puntos: plan.paradas.map((p) => p.s.punto),
            bloques: plan.paradas.map((p) => ({ titulo: p.s.nombre, detalle: p.s.region ?? "", especies: p.aporta.map((a) => ({ nombre: datos.e[a.e][1], p: a.p, foto: datos.e[a.e][2] })) })),
            contexto: datos.s.map((z) => z.punto),
            pie: "Sitios clave para la biodiversidad (KBA) · datos de eBird",
          }} />
      )}
      <p className="pie">La probabilidad combina la frecuencia en salidas completas de cada parada como si fueran salidas independientes; es una guía, no una garantía. Supone una salida por sitio.</p>
    </div>
  );
}

function Vacio({ icono, t, d }: { icono: string; t: string; d: string }) {
  return <div className="vacio"><span className="titulo-icono__marca"><Icono nombre={icono} tam={22} /></span><b>{t}</b><p>{d}</p></div>;
}
