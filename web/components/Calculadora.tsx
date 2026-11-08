"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Calculadora as Datos } from "@/lib/data";
import { entero } from "@/lib/formato";

export default function Calculadora({ datos }: { datos: Datos }) {
  const [zona, setZona] = useState(datos.zonas.includes("Sur") ? "Sur" : datos.zonas[0]);
  const curva = useMemo(
    () => Object.entries(datos.acumulacion[zona]).map(([m, v]) => ({ min: Number(m), ...v })).sort((a, b) => a.min - b.min),
    [datos, zona],
  );
  const minutos = curva.map((c) => c.min);
  const [min, setMin] = useState(90);
  const sel = minutos.includes(min) ? min : minutos[minutos.length - 1];
  const punto = curva.find((c) => c.min === sel)!;
  const top = (datos.probabilidad[zona]?.[String(sel)] ?? []).slice(0, 10);

  // ── curva de acumulación (SVG)
  const W = 460, H = 260, m = { t: 14, r: 14, b: 34, l: 38 };
  const maxY = Math.max(...curva.map((c) => c.q3)) * 1.05;
  const x = (v: number) => m.l + ((v - 15) / (240 - 15)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - v / maxY) * (H - m.t - m.b);
  const banda = curva.map((c) => `${x(c.min)},${y(c.q3)}`).concat([...curva].reverse().map((c) => `${x(c.min)},${y(c.q1)}`)).join(" ");
  const linea = curva.map((c) => `${x(c.min)},${y(c.mediana)}`).join(" ");

  return (
    <section className="lamina">
      <div className="controles">
        <label>Zona
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            {datos.zonas.map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
        <label>Duración: <strong className="mono" style={{ color: "var(--texto)" }}>{sel} min</strong>
          <input type="range" min={minutos[0]} max={minutos[minutos.length - 1]} step={15} value={sel}
            onChange={(e) => setMin(Number(e.target.value))} />
        </label>
      </div>

      <p style={{ fontSize: "1.15rem" }}>
        Una salida de <strong>{sel} min</strong> en <strong>{zona}</strong> registra <strong>{punto.mediana} especies</strong>
        {" "}(entre {punto.q1} y {punto.q3} en la mitad de los casos).
      </p>

      <div className="dos-col">
        <figure style={{ margin: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Especies por salida según duración">
            {[0, 10, 20, 30].filter((v) => v < maxY).map((v) => (
              <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--linea)" />
                <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11}>{v}</text></g>
            ))}
            {[30, 60, 120, 180, 240].map((v) => (
              <text key={v} x={x(v)} y={H - 14} textAnchor="middle" fontSize={11}>{v}</text>
            ))}
            <text x={(W + m.l) / 2} y={H - 1} textAnchor="middle" fontSize={11}>duración (min)</text>
            <polygon points={banda} fill="var(--musgo-2)" opacity={0.45} />
            <polyline points={linea} fill="none" stroke="var(--musgo-5)" strokeWidth={2} />
            <circle cx={x(sel)} cy={y(punto.mediana)} r={6} fill="var(--foco)" />
          </svg>
          <figcaption className="pie">Línea = mediana · banda = Q1–Q3 · n = {entero(punto.n)} salidas en este tramo</figcaption>
        </figure>

        <div>
          <h3 style={{ fontSize: "1.1rem" }}>Las diez más probables</h3>
          {top.length === 0 && <p className="apoyo">Sin desglose por especie para esta combinación.</p>}
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {top.map((e) => (
              <li key={e.slug} style={{ display: "grid", gridTemplateColumns: "9.5rem 1fr 3rem", gap: ".5rem", alignItems: "center", margin: ".25rem 0" }}>
                <Link href={`/especies/${e.slug}/`} style={{ color: "var(--texto)", fontSize: ".9rem" }}>{e.nombre}</Link>
                <span style={{ background: "var(--musgo-1)", borderRadius: 3, height: 14 }}>
                  <span style={{ display: "block", width: `${e.p * 100}%`, height: "100%", background: "var(--musgo-3)", borderRadius: 3 }} />
                </span>
                <span className="mono pequeno">{Math.round(e.p * 100)} %</span>
              </li>
            ))}
          </ol>
          <p className="pie">% de esas salidas en que se registró la especie</p>
        </div>
      </div>
      <p className="pie">{datos.nota} Fuente: eBird Basic Dataset relSep-2026 (06_acumulacion, 06_probabilidad). Es frecuencia de reporte, no garantía de avistamiento.</p>
    </section>
  );
}
