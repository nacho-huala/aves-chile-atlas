"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DatosNidificacion, NidEspecie } from "@/lib/laminas-datos";
import { es, ESTATUS, Leyenda, MESES, MESES_L, Tip, useTooltip } from "./comun";

const GRUPOS = [
  { id: "comunes", txt: "Las 25 más registradas" },
  { id: "endémica", txt: "Endémicas" },
  { id: "migratoria / estacional", txt: "Migratorias" },
  { id: "todas", txt: "Todas" },
] as const;

/** Lámina 13: cuántas especies nidifican cada mes + calendario especie × mes (eBird relativo vs. meses del atlas). */
export function CalendarioNidificacion({ datos }: { datos: DatosNidificacion }) {
  const [grupo, setGrupo] = useState<string>("comunes");
  const { ref, tip, mover, salir } = useTooltip<{ e: NidEspecie; m: number }>();
  const base = useMemo(() => datos.especies.filter((e) => e.fen && e.meses.length && !e.revisar), [datos]);
  const filas = useMemo(() => grupo === "comunes" ? base.slice(0, 25) : grupo === "todas" ? base : base.filter((e) => e.estatus === grupo), [base, grupo]);

  // barras: especies que nidifican por mes
  const maxMes = Math.max(...datos.porMes), mesTop = datos.porMes.indexOf(maxMes);
  const W = 1100, L = 210, cw = (W - L - 10) / 12, rh = 22, Hb = 120;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${Hb + 22}`} width="100%" role="img" aria-label="Número de especies que nidifican en cada mes según el atlas">
        <text x={0} y={14} fontSize={13}>Especies que nidifican</text>
        <text x={0} y={32} fontSize={13}>cada mes (atlas)</text>
        {datos.porMes.map((v, i) => {
          const h = (v / maxMes) * (Hb - 24), x = L + i * cw;
          return (
            <g key={i}>
              <rect x={x + cw * 0.18} y={Hb - h} width={cw * 0.64} height={h} rx={3} fill={i === mesTop ? "var(--foco)" : "var(--sol)"} opacity={i === mesTop ? 1 : 0.75} />
              <text x={x + cw / 2} y={Hb - h - 5} textAnchor="middle" fontSize={12}>{v}</text>
              <text x={x + cw / 2} y={Hb + 16} textAnchor="middle" fontSize={12}>{MESES[i]}</text>
            </g>
          );
        })}
      </svg>

      <div className="vista__controles" style={{ marginTop: "1.5rem" }}>
        <ul className="chips" aria-label="Elegir especies">
          {GRUPOS.map((g) => <li key={g.id}><button type="button" aria-pressed={grupo === g.id} onClick={() => setGrupo(g.id)}>{g.txt}</button></li>)}
        </ul>
        <span className="apoyo pequeno">{filas.length} especies · celda más oscura = mes con más registros en eBird · línea dorada = nidifica</span>
      </div>
      <div className={grupo === "todas" ? "calendario calendario--scroll" : "calendario"}>
        <svg viewBox={`0 0 ${W} ${filas.length * rh + 4}`} width="100%" role="img" aria-label="Calendario por especie: frecuencia de registro en eBird y meses de nidificación">
          {filas.map((e, r) => {
            const y = r * rh, pico = e.fen!.indexOf(Math.max(...e.fen!));
            return (
              <g key={e.slug}>
                <a href={`/especies/${e.slug}/`}><text x={L - 10} y={y + rh * 0.62} textAnchor="end" fontSize={13} className="cal__nombre">{e.nombre}</text></a>
                {e.fen!.map((v, m) => {
                  const x = L + m * cw, nido = e.meses.includes(m + 1);
                  return (
                    <g key={m} onPointerMove={(ev) => mover(ev, { e, m })} onPointerLeave={salir}>
                      <rect x={x + 1} y={y + 1} width={cw - 2} height={rh - 7} rx={2} fill="var(--musgo-5)" fillOpacity={0.08 + 0.92 * v} />
                      {nido && <rect x={x + 1} y={y + rh - 5} width={cw - 2} height={3} rx={1.5} fill="var(--sol)" />}
                      {m === pico && <circle cx={x + cw / 2} cy={y + (rh - 7) / 2 + 1} r={3} fill={nido ? "var(--sobre-foco)" : "var(--foco)"} stroke="var(--foco)" strokeWidth={1.5} />}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <svg viewBox={`0 0 ${W} 22`} width="100%" aria-hidden="true">
        {MESES.map((m, i) => <text key={m} x={L + i * cw + cw / 2} y={15} textAnchor="middle" fontSize={12}>{m}</text>)}
      </svg>
      <p className="pie">● mes con más registros en eBird (relleno claro si cae dentro de la nidificación). Solo especies con meses confirmados en el atlas.</p>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.e.nombre}</b>
          <span>{MESES_L[tip.d.m]}: {es(100 * (tip.d.e.fen?.[tip.d.m] ?? 0))} % de su mes máximo en eBird{tip.d.e.meses.includes(tip.d.m + 1) ? " · nidifica" : ""}</span>
        </Tip>
      )}
    </div>
  );
}

/** Lámina 14: rango de altitud de nidificación de cada especie, ordenado de la costa al altiplano. */
export function AltitudNidificacion({ datos }: { datos: DatosNidificacion }) {
  const [activos, setActivos] = useState(new Set(ESTATUS.map((e) => e.id)));
  const { ref, tip, mover, salir } = useTooltip<NidEspecie>();
  const conAlt = useMemo(() => datos.especies.filter((e) => e.alt && e.alt[1] > e.alt[0])
    .sort((a, b) => (a.alt![0] + a.alt![1]) - (b.alt![0] + b.alt![1])), [datos]);
  const W = 1100, H = 380, m = { t: 12, r: 10, b: 28, l: 56 };
  const maxA = 5500, y = (a: number) => m.t + (H - m.t - m.b) * (1 - a / maxA), bw = (W - m.l - m.r) / conAlt.length;
  const alternar = (id: string) => setActivos((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n.size ? n : new Set(ESTATUS.map((e) => e.id)); });
  const color = (e: NidEspecie) => ESTATUS.find((s) => s.id === e.estatus)?.color ?? "var(--texto-suave)";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <Leyenda items={ESTATUS.map((s) => ({ ...s, n: conAlt.filter((e) => e.estatus === s.id).length }))} activos={activos} alternar={alternar} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Rango de altitud de nidificación por especie">
        {[0, 1000, 2000, 3000, 4000, 5000].map((a) => (
          <g key={a}>
            <line x1={m.l} x2={W - m.r} y1={y(a)} y2={y(a)} stroke="var(--linea)" />
            <text x={m.l - 8} y={y(a) + 4} textAnchor="end" fontSize={12}>{es(a)} m</text>
          </g>
        ))}
        {conAlt.map((e, i) => {
          const on = activos.has(e.estatus ?? "");
          return (
            <a key={e.slug} href={`/especies/${e.slug}/`} onPointerMove={(ev) => mover(ev, e)} onPointerLeave={salir}>
              <rect x={m.l + i * bw + bw * 0.15} y={y(e.alt![1])} width={Math.max(1.5, bw * 0.7)} height={Math.max(2, y(e.alt![0]) - y(e.alt![1]))}
                rx={1.5} fill={color(e)} opacity={on ? 0.9 : 0.12} />
            </a>
          );
        })}
        <text x={m.l} y={H - 8} fontSize={12}>← nidifican más bajo</text>
        <text x={W - m.r} y={H - 8} fontSize={12} textAnchor="end">nidifican más alto →</text>
      </svg>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{tip.d.nombre}</b>
          <span>Nidifica entre {es(tip.d.alt![0])} y {es(tip.d.alt![1])} m s. n. m.</span>
        </Tip>
      )}
    </div>
  );
}
