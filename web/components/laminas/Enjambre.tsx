"use client";
import { useMemo, useState } from "react";
import { forceCollide, forceSimulation, forceX, forceY, scaleLog, scaleSqrt } from "d3";
import type { EspecieLamina } from "@/lib/laminas-datos";
import { ESTATUS, Leyenda, pctTxt, Tip, useTooltip, es } from "./comun";

type N = EspecieLamina & { x: number; y: number; r: number; fy0: number };
const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Beeswarm con d3-force: x = % de salidas (log), y libre; se calcula una vez (sin animar el layout). */
function useEnjambre<T extends EspecieLamina>(datos: T[], W: number, H: number, radio: (d: T) => number, fila: (d: T) => number) {
  return useMemo(() => {
    const x = scaleLog().domain([0.0001, 60]).range([40, W - 20]).clamp(true);
    const nodos = datos.map((d) => ({ ...d, x: x(d.pct), y: fila(d), r: radio(d), fy0: fila(d) })) as (T & N)[];
    const sim = forceSimulation(nodos).force("x", forceX<T & N>((d) => x(d.pct)).strength(1))
      .force("y", forceY<T & N>((d) => d.fy0).strength(0.08)).force("c", forceCollide<T & N>((d) => d.r + 0.6)).stop();
    for (let i = 0; i < 260; i++) sim.tick();
    nodos.forEach((n) => { n.y = Math.max(8, Math.min(H - 8, n.y)); });
    return { nodos, x };
  }, [datos, W, H, radio, fila]);
}

const EJE = [0.001, 0.01, 0.1, 1, 10];

export function Enjambre({ especies, salidas }: { especies: EspecieLamina[]; salidas: number }) {
  const W = 1100, H = 380;
  const rs = useMemo(() => scaleSqrt().domain([0, Math.max(...especies.map((e) => e.obs ?? 0))]).range([2, 13]), [especies]);
  const radio = useMemo(() => (d: EspecieLamina) => rs(d.obs ?? 0), [rs]);
  const fila = useMemo(() => () => H / 2, []);
  const { nodos, x } = useEnjambre(especies, W, H, radio, fila);
  const [activos, setActivos] = useState(new Set(ESTATUS.map((e) => e.id)));
  const [q, setQ] = useState("");
  const { ref, tip, mover, salir } = useTooltip<EspecieLamina>();
  const t = sinTildes(q.trim());
  const pasa = (d: EspecieLamina) => activos.has(d.estatus ?? "") && (!t || sinTildes(d.nombre).includes(t));
  const filtrando = activos.size < ESTATUS.length || !!t;
  const color = (e: string | null) => ESTATUS.find((s) => s.id === e)?.color ?? "var(--texto-suave)";
  const alternar = (id: string) => setActivos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n.size ? n : new Set(ESTATUS.map((e) => e.id)); });
  const raras = especies.filter((e) => Math.round((e.pct * salidas) / 100) < 10).length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <Leyenda items={ESTATUS.map((s) => ({ ...s, n: especies.filter((e) => e.estatus === s.id).length }))} activos={activos} alternar={alternar} />
        <label className="cuerpo-s" style={{ display: "grid", gap: 4 }}>Buscar
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cóndor, picaflor…" />
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 40}`} role="img" aria-label={`Enjambre de ${especies.length} especies según el porcentaje de salidas en que aparecen`}>
        {EJE.map((v) => (
          <g key={v}><line x1={x(v)} x2={x(v)} y1={0} y2={H} stroke="var(--linea)" /><text x={x(v)} y={H + 18} textAnchor="middle">{pctTxt(v)}</text></g>
        ))}
        <text x={40} y={H + 36}>← especies vistas en pocas salidas</text>
        <text x={W - 20} y={H + 36} textAnchor="end">% de salidas con la especie (escala log) →</text>
        <g className={filtrando ? "atenuar" : ""}>
          {nodos.map((n) => (
            <a key={n.slug} href={`/especies/${n.slug}/`} aria-label={`${n.nombre}: ${pctTxt(n.pct)} de las salidas`}>
              <circle className={`marca${pasa(n) ? " on" : ""}`} cx={n.x} cy={n.y} r={n.r} fill={color(n.estatus)} stroke="var(--superficie)" strokeWidth={0.6}
                onPointerMove={(e) => mover(e, n)} onPointerLeave={salir} />
            </a>
          ))}
        </g>
      </svg>
      <p className="cuerpo-s" style={{ margin: "4px 0 0" }}>{raras} especies se vieron en menos de 10 salidas. Tamaño = observadores. Clic en un punto para abrir su ficha.</p>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.nombre}</b>
          <span>{pctTxt(tip.d.pct)} de las salidas · {es(tip.d.obs ?? 0)} observadores</span>
        </Tip>
      )}
    </div>
  );
}

const UICN = [
  { id: "CR", txt: "En peligro crítico" }, { id: "EN", txt: "En peligro" }, { id: "VU", txt: "Vulnerable" },
  { id: "NT", txt: "Casi amenazada" }, { id: "LC", txt: "Preocupación menor" },
];

export function Riesgo({ especies }: { especies: EspecieLamina[] }) {
  const W = 1100, filaH = 64, H = filaH * UICN.length;
  const datos = useMemo(() => especies.filter((e) => UICN.some((u) => u.id === e.uicn)), [especies]);
  const radio = useMemo(() => (d: EspecieLamina) => (d.uicn === "LC" ? 2.6 : 4.2), []);
  const fila = useMemo(() => (d: EspecieLamina) => UICN.findIndex((u) => u.id === d.uicn) * filaH + filaH / 2, []);
  const { nodos, x } = useEnjambre(datos, W, H, radio, fila);
  const { ref, tip, mover, salir } = useTooltip<EspecieLamina>();
  const color = (u: string | null) => (u === "LC" ? "var(--musgo-3)" : u === "NT" ? "var(--conchovino-3)" : u === "VU" ? "var(--conchovino-4)" : "var(--conchovino-6)");
  const amenazadas = datos.filter((d) => ["VU", "EN", "CR"].includes(d.uicn!));
  const visibles = ["CR", "EN", "VU"].map((u) => [...amenazadas].filter((d) => d.uicn === u).sort((a, b) => b.pct - a.pct)[0]?.slug);
  // los rótulos se ubican sobre el punto: la más visible de cada categoría amenazada
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg viewBox={`-150 0 ${W + 150} ${H + 40}`} role="img" aria-label="Especies por categoría UICN según el porcentaje de salidas en que aparecen">
        {UICN.map((u, i) => (
          <g key={u.id}>
            <line x1={0} x2={W} y1={(i + 1) * filaH} y2={(i + 1) * filaH} stroke="var(--linea)" />
            <text x={-140} y={i * filaH + filaH / 2 - 2} className="t-fuerte">{u.id}</text>
            <text x={-140} y={i * filaH + filaH / 2 + 13}>{u.txt} · {datos.filter((d) => d.uicn === u.id).length}</text>
          </g>
        ))}
        {EJE.map((v) => <text key={v} x={x(v)} y={H + 18} textAnchor="middle">{pctTxt(v)}</text>)}
        <text x={W} y={H + 36} textAnchor="end">% de salidas con la especie (escala log) →</text>
        {nodos.map((n) => (
          <a key={n.slug} href={`/especies/${n.slug}/`} aria-label={`${n.nombre}, ${n.uicn}: ${pctTxt(n.pct)} de las salidas`}>
            <circle className="marca" cx={n.x} cy={n.y} r={n.r} fill={color(n.uicn)} onPointerMove={(e) => mover(e, n)} onPointerLeave={salir} />
          </a>
        ))}
        {nodos.filter((n) => visibles.includes(n.slug)).map((n) => (
          <text key={n.slug} x={n.x} y={n.y - 9} textAnchor={n.x > W * 0.8 ? "end" : "middle"} className="t-fuerte" pointerEvents="none">{n.nombre}</text>
        ))}
      </svg>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.nombre}</b>
          <span>UICN {tip.d.uicn} · {pctTxt(tip.d.pct)} de las salidas{tip.d.endemica ? " · endémica" : ""}</span>
        </Tip>
      )}
    </div>
  );
}
