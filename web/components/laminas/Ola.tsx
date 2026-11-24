"use client";
import { useMemo, useState } from "react";
import { area, curveBasis, line } from "d3";
import type { Ola as DatosOla, OlaEspecie } from "@/lib/laminas-datos";
import { es, MESES, MESES_L } from "./comun";
import { geo, proyectar } from "@/lib/geo";
import { Icono } from "@/components/Icono";

const PH = proyectar("horizontal");
const GH = geo.horizontal;
const px = (lat: number) => PH(-70, lat)[0]; // en la vista horizontal, x depende solo de la latitud

/** Ridgeline: una cresta por mes (ene arriba), x = latitud de norte a sur, alineada con el mapa de Chile de abajo. */
export function OlaGrafico({ ola, nombre }: { ola: DatosOla; nombre: string }) {
  const [mes, setMes] = useState<number | null>(null);
  const W = 1000, fila = 30, alto = 64, m = { t: 30, r: 10, b: 0, l: 44 };
  const latN = -17.5, latS = -56;
  const s = (W - m.l - m.r) / (px(latS) - px(latN)), tx = m.l - px(latN) * s;
  const x = (lat: number) => tx + px(lat) * s; // misma proyección que el mapa
  const yMapa = m.t + fila * 11 + alto + 18, altoMapa = GH.height * s;
  const ciudades = Object.entries(GH.ciudades as Record<string, number[]>);
  const H = yMapa + altoMapa + 44;
  const max = Math.max(1, ...ola.pct.flat().map((v) => v ?? 0));
  const y0 = (i: number) => m.t + alto + i * fila;
  const crestas = useMemo(() => ola.pct.map((serie, i) => {
    const pts = ola.bandas.map((b, j) => [x(b), serie[j]] as [number, number | null]);
    const a = area<[number, number | null]>().defined((d) => d[1] !== null).x((d) => d[0]).y0(y0(i)).y1((d) => y0(i) - ((d[1] ?? 0) / max) * alto).curve(curveBasis)(pts);
    const l = line<[number, number | null]>().defined((d) => d[1] !== null).x((d) => d[0]).y((d) => y0(i) - ((d[1] ?? 0) / max) * alto).curve(curveBasis)(pts);
    return { a, l };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ola, max]);
  const sel = mes !== null ? ola.pct[mes] : null;
  const pico = sel ? sel.reduce<[number, number]>((b, v, j) => ((v ?? -1) > b[1] ? [j, v ?? -1] : b), [0, -1]) : null;

  return (
    <div>
      <svg className="ola-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Porcentaje de salidas con ${nombre} por mes y latitud`} onPointerLeave={() => setMes(null)}>
        {/* mapa de Chile (BCN) en la misma escala horizontal que las crestas */}
        <g transform={`translate(${tx} ${yMapa}) scale(${s})`} aria-hidden="true">
          {Object.values(GH.zonas as Record<string, string>).map((d, i) => <path key={i} d={d} fill="var(--musgo-2)" stroke="var(--superficie)" strokeWidth={0.6 / s} />)}
        </g>
        {pico && mes !== null && pico[1] >= 0 && (
          <line x1={x(ola.bandas[pico[0]])} x2={x(ola.bandas[pico[0]])} y1={m.t - 6} y2={yMapa + altoMapa} stroke="var(--foco)" strokeWidth={2} />
        )}
        {ciudades.map(([n, [cx, cy]], i) => {
          const X = tx + cx * s, Y = yMapa + cy * s;
          return (
            <g key={n} pointerEvents="none">
              <line x1={X} x2={X} y1={m.t - 6} y2={Y} stroke="var(--linea)" strokeDasharray="2 4" />
              <circle cx={X} cy={Y} r={3.2} fill="var(--texto)" stroke="var(--superficie)" strokeWidth={1.2} />
              <line x1={X} x2={X} y1={Y + 4} y2={yMapa + altoMapa + (i % 2 ? 26 : 10)} stroke="var(--texto-suave)" strokeWidth={0.8} />
              <text className="ola-mapa__ciudad" x={X} y={yMapa + altoMapa + (i % 2 ? 40 : 24)} textAnchor="middle">{n}</text>
            </g>
          );
        })}
        {crestas.map((c, i) => {
          const on = mes === i;
          return (
            <g key={i} onPointerEnter={() => setMes(i)} onFocus={() => setMes(i)} tabIndex={0} role="button" aria-label={MESES_L[i]} className="marca" style={{ outline: "none" }}>
              <rect x={0} y={y0(i) - fila} width={W} height={fila} fill="transparent" />
              <path d={c.a ?? ""} fill={on ? "var(--foco)" : "var(--musgo-3)"} fillOpacity={on ? 0.9 : mes === null ? 0.75 : 0.35} />
              <path d={c.l ?? ""} fill="none" stroke={on ? "var(--foco)" : "var(--musgo-5)"} strokeWidth={1.2} />
              <text x={m.l - 8} y={y0(i) - 3} textAnchor="end" className={on ? "t-fuerte" : ""}>{MESES[i]}</text>
            </g>
          );
        })}
      </svg>
      <p className="ola-pista" aria-live="polite">
        <Icono nombre={mes === null ? "ojo" : "pin"} tam={18} />
        {mes === null || !pico || pico[1] < 0 ? "Pasa sobre un mes para ver dónde es más fácil verla."
          : <>En <b>{MESES_L[mes]}</b>, el máximo está cerca de {es(Math.abs(ola.bandas[pico[0]]), 1)}° S: aparece en el <b className="num">{es(pico[1], 1)} %</b> de las salidas completas de esa franja.</>}
      </p>
    </div>
  );
}

export function OlaSelector({ especies }: { especies: OlaEspecie[] }) {
  const [i, setI] = useState(0);
  const e = especies[i];
  return (
    <div>
      <div className="vista__controles">
        <ul className="chips" aria-label="Especie">
          {especies.map((s, k) => <li key={s.slug}><button type="button" aria-pressed={k === i} onClick={() => setI(k)}>{s.nombre}</button></li>)}
        </ul>
      </div>
      <OlaGrafico ola={e} nombre={e.nombre} key={e.slug} />
      <p className="cuerpo-s" style={{ margin: "6px 0 0" }}><a className="enlace" href={`/especies/${e.slug}/`}>Ver la ficha de {e.nombre} →</a></p>
    </div>
  );
}
