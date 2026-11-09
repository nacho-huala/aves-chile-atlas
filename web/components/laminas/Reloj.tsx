"use client";
import { useMemo, useState } from "react";
import { arc, line, curveCatmullRom } from "d3";
import type { DatosReloj } from "@/lib/laminas-datos";
import { es, MESES, MESES_L, Tip, useTooltip } from "./comun";

const UMBRALES = [1, 3, 6, 9, 12, 15]; // % de las salidas del mes que parten en esa hora → conchovino-1…6
const tono = (v: number) => `var(--conchovino-${Math.max(1, UMBRALES.filter((u) => v >= u).length)})`;

/** Reloj polar: 24 horas alrededor (medianoche arriba), un anillo por mes (enero afuera). */
export function Reloj({ datos }: { datos: DatosReloj }) {
  const [zona, setZona] = useState("Chile");
  const [modo, setModo] = useState<"local" | "solar">("local");
  const { ref, tip, mover, salir } = useTooltip<{ m: number; h: number; v: number; n: number }>();
  const hayModo = !!datos.reloj.solar?.[zona];
  const matriz = datos.reloj[hayModo ? modo : "local"]?.[zona] ?? datos.reloj.local.Chile;
  const pct = matriz.map((fila) => { const t = fila.reduce((a, b) => a + b, 0) || 1; return fila.map((v) => (v / t) * 100); });

  const S = 560, c = S / 2, r0 = 60, r1 = c - 34, ancho = (r1 - r0) / 12;
  const rad = (m: number) => r1 - (m + 0.5) * ancho; // enero afuera
  const arco = useMemo(() => arc<{ m: number; h: number }>()
    .innerRadius((d) => r1 - (d.m + 1) * ancho + 0.5).outerRadius((d) => r1 - d.m * ancho - 0.5)
    .startAngle((d) => (d.h / 24) * 2 * Math.PI + 0.004).endAngle((d) => ((d.h + 1) / 24) * 2 * Math.PI - 0.004), [ancho, r1]);
  const sol = modo === "local" || !hayModo ? (datos.sol[zona] ?? datos.sol.Chile) : null;
  const curva = (k: 0 | 1) => sol && line<[number, number]>().curve(curveCatmullRom)(
    sol.map((s, m) => { const a = ((s?.[k] ?? 0) / 24) * 2 * Math.PI; return [Math.sin(a) * rad(m), -Math.cos(a) * rad(m)] as [number, number]; }));
  const tarde = (m: number) => pct[m].slice(18).reduce((a, b) => a + b, 0);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="vista__controles">
        <ul className="chips" aria-label="Zona">
          {datos.zonas.map((z) => <li key={z}><button type="button" aria-pressed={z === zona} onClick={() => setZona(z)}>{z}</button></li>)}
        </ul>
        {hayModo && (
          <ul className="chips" aria-label="Hora">
            <li><button type="button" aria-pressed={modo === "local"} onClick={() => setModo("local")}>Hora local</button></li>
            <li><button type="button" aria-pressed={modo === "solar"} onClick={() => setModo("solar")}>Hora solar</button></li>
          </ul>
        )}
      </div>
      <div className="dos-vistas">
        <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`Hora de inicio de las salidas por mes en ${zona}`}>
          <g transform={`translate(${c},${c})`}>
            {pct.map((fila, m) => fila.map((v, h) => (
              <path key={`${m}-${h}`} className="marca" d={arco({ m, h }) ?? ""} fill={tono(v)}
                onPointerMove={(e) => mover(e, { m, h, v, n: matriz[m][h] })} onPointerLeave={salir} />
            )))}
            {sol && <path d={curva(0) ?? ""} fill="none" stroke="var(--sol)" strokeWidth={2} pointerEvents="none" />}
            {sol && <path d={curva(1) ?? ""} fill="none" stroke="var(--sol)" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />}
            {[0, 6, 12, 18].map((h) => {
              const a = (h / 24) * 2 * Math.PI;
              return <text key={h} x={Math.sin(a) * (r1 + 16)} y={-Math.cos(a) * (r1 + 16) + 4} textAnchor="middle" className="t-fuerte">{String(h).padStart(2, "0")} h</text>;
            })}
            <text y={-4} textAnchor="middle">ene afuera</text>
            <text y={12} textAnchor="middle">dic al centro</text>
          </g>
        </svg>
        <div>
          <p className="cuerpo-s" style={{ marginTop: 0 }}>Color: % de las salidas del mes que empiezan en esa hora. {sol && <>Línea ocre: amanecer; punteada: atardecer.</>}</p>
          <ol className="lista-rank">
            {MESES_L.map((nom, m) => (
              <li key={nom}><span>{nom}</span><span className="barra-mini"><span style={{ width: `${Math.min(100, tarde(m) * 3.5)}%`, background: "var(--conchovino-4)" }} /></span><span className="num">{es(tarde(m), 1)} %</span></li>
            ))}
          </ol>
          <p className="pie">Barras: % de salidas que parten después de las 18 h.</p>
        </div>
      </div>
      {tip && (
        <Tip x={tip.x} y={tip.y} ancho={ref.current?.clientWidth ?? 800}>
          <b>{MESES_L[tip.d.m]}, {String(tip.d.h).padStart(2, "0")}:00</b>
          <span>{es(tip.d.v, 1)} % de las salidas del mes · {es(tip.d.n)} salidas</span>
        </Tip>
      )}
    </div>
  );
}
