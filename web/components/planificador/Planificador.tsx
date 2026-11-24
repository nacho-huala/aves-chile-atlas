"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CIUDADES } from "@/lib/ciudades";
import { cercanos, indexar, km, planificar, type DatosPlan, type Origen } from "@/lib/planificador";
import { MESES, MESES_LARGOS, entero } from "@/lib/formato";
import { Icono } from "@/components/Icono";
import { MapaPlan } from "./MapaPlan";

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

  useEffect(() => {
    fetch("/data/planificador.json").then((r) => r.json()).then((d: DatosPlan) => {
      setDatos(d);
      // ?especie=slug (desde la ficha) abre el modo lista con esa especie
      const q = new URLSearchParams(window.location.search).get("especie");
      const i = q ? d.e.findIndex((e) => e[0] === q) : -1;
      if (i >= 0) { setModo("lista"); setLista([i]); }
    }).catch(() => setError(true));
  }, []);
  const prob = useMemo(() => (datos ? indexar(datos) : null), [datos]);

  function ubicar() {
    if (!navigator.geolocation) { setGps("error"); return; }
    setGps("buscando");
    // La ubicación se usa solo en tu navegador; no se envía a ningún servidor.
    navigator.geolocation.getCurrentPosition((p) => {
      setGps(""); setTexto("");
      conTransicion(() => { setOrigen({ nombre: "Tu ubicación", punto: [p.coords.latitude, p.coords.longitude], tipo: "gps" }); setSel(null); });
    }, () => setGps("error"), { timeout: 10000 });
  }
  function elegirTexto(v: string) {
    setTexto(v);
    const c = CIUDADES.find((x) => sinTildes(x[0]) === sinTildes(v.trim()));
    if (c) conTransicion(() => { setOrigen({ nombre: c[0], punto: [c[2], c[3]], tipo: "ciudad" }); setSel(null); });
    const s = datos?.s.find((x) => sinTildes(x.nombre) === sinTildes(v.trim()));
    if (s && !c) conTransicion(() => { setOrigen({ nombre: s.nombre, punto: s.punto, tipo: "sitio" }); setSel(null); });
  }

  const cerca = useMemo(() => (datos && origen ? cercanos(datos, origen.punto, radio, 8) : []), [datos, origen, radio]);
  const plan = useMemo(() => (datos && prob && lista.length ? planificar(datos, prob, lista, origen?.punto ?? null, { radio }) : null), [datos, prob, lista, origen, radio]);

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
          <label className="plan-buscar">
            <span className="sr-only">Ciudad o sitio de destino</span>
            <Icono nombre="mapa" tam={18} />
            <input list="plan-lugares" placeholder="Escribe una ciudad o un sitio: Castro, Putre, Humedal…" value={texto} onChange={(e) => elegirTexto(e.target.value)} />
            <datalist id="plan-lugares">
              {CIUDADES.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
              {datos.s.map((s) => <option key={s.id} value={s.nombre}>{s.region ?? ""} · sitio KBA</option>)}
            </datalist>
          </label>
        </div>
        <p className="pie" role="status">
          {gps === "buscando" && "Buscando tu ubicación…"}
          {gps === "error" && "No pudimos obtener tu ubicación. Escribe una ciudad."}
          {!gps && origen && <>Partida: <b>{origen.nombre}</b>{origen.tipo === "gps" ? " (no sale de tu navegador)" : ""}. Distancias en línea recta.</>}
          {!gps && !origen && "Puede ser donde estás o adonde vas a viajar. Sin punto de partida, el plan recorre todo Chile."}
        </p>
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
        {modo === "lista" && <SelectorEspecies datos={datos} lista={lista} setLista={setLista} />}
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
                  agregar={(e) => setLista((l) => (l.includes(e) ? l : [...l, e]))} irALista={() => conTransicion(() => setModo("lista"))} />
              : <PanelLista datos={datos} plan={plan} lista={lista} origen={origen} radio={radio} setSel={setSel} elegido={elegido} />}
          </div>
        </div>
      </section>
      <p className="pie">{datos.nota}</p>
    </div>
  );
}

function SelectorEspecies({ datos, lista, setLista }: { datos: DatosPlan; lista: number[]; setLista: (f: (l: number[]) => number[]) => void }) {
  const [q, setQ] = useState(""), [abierto, setAbierto] = useState(false), [act, setAct] = useState(0);
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
  const endemicas = datos.e.map((e, i) => ({ e, i })).filter(({ e }) => e[3] === "endémica").map(({ i }) => i);

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
        {!lista.length && <span className="apoyo pequeno">Atajos:</span>}
        {!lista.length && <button type="button" className="chip-atajo" onClick={() => setLista(() => endemicas)}>Las {endemicas.length} endémicas</button>}
        {lista.length > 0 && <button type="button" className="chip-atajo" onClick={() => setLista(() => [])}>Limpiar lista</button>}
      </div>
    </div>
  );
}

function FotoMini({ src }: { src: string | null }) { return src ? <img className="foto-mini" src={src} alt="" loading="lazy" /> : <span className="foto-mini sin-foto" />; }

function PanelCerca({ datos, prob, cerca, origen, elegido, setSel, lista, agregar, irALista }: {
  datos: DatosPlan; prob: ReturnType<typeof indexar>; cerca: ReturnType<typeof cercanos>; origen: Origen | null; elegido: number | null;
  setSel: (i: number) => void; lista: number[]; agregar: (e: number) => void; irALista: () => void;
}) {
  if (!origen) return <Vacio icono="pin" t="Elige un punto de partida" d="Te mostraremos los sitios clave más cercanos y qué aves se registran en cada uno." />;
  if (!cerca.length) return <Vacio icono="mapa" t="No hay sitios con datos en ese radio" d="Amplía la distancia máxima en el paso 1." />;
  const s = elegido !== null ? datos.s[elegido] : cerca[0].s, i = elegido ?? cerca[0].i;
  const aves = [...prob[i].entries()].sort((a, b) => b[1].p - a[1].p).slice(0, 12);
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
        <p className="dato-eti">Qué puedes ver · frecuencia en salidas completas</p>
        <ul className="plan-aves">
          {aves.map(([e, x]) => (
            <li key={e}>
              <FotoMini src={datos.e[e][2]} />
              <span><Link href={`/especies/${datos.e[e][0]}/`}>{datos.e[e][1]}</Link><small>{frecuencia(x.p)}{x.mes ? ` · más en ${MESES[x.mes - 1]}` : ""}</small></span>
              <Medidor p={x.p} />
              <button type="button" className="mas" aria-label={`Agregar ${datos.e[e][1]} a mi lista`} aria-pressed={lista.includes(e)} onClick={() => agregar(e)}>{lista.includes(e) ? "✓" : "+"}</button>
            </li>
          ))}
        </ul>
        {lista.length > 0 && <button type="button" className="btn btn--secundario" onClick={irALista}>Planificar mi lista ({lista.length}) <span className="flecha" aria-hidden="true">→</span></button>}
      </article>
    </div>
  );
}

function PanelLista({ datos, plan, lista, origen, radio, elegido, setSel }: {
  datos: DatosPlan; plan: ReturnType<typeof planificar> | null; lista: number[]; origen: Origen | null; radio: number; elegido: number | null; setSel: (i: number) => void;
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
      <p className="pie">La probabilidad combina la frecuencia en salidas completas de cada parada como si fueran salidas independientes; es una guía, no una garantía. Supone una salida por sitio.</p>
    </div>
  );
}

function Vacio({ icono, t, d }: { icono: string; t: string; d: string }) {
  return <div className="vacio"><span className="titulo-icono__marca"><Icono nombre={icono} tam={22} /></span><b>{t}</b><p>{d}</p></div>;
}
