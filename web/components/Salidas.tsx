"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

type Anio = { anio: number; salidas: number; especiesPorSalida: number };
const NOTAS: Record<number, string> = { 2020: "Confinamiento", 2023: "Verano austral" };
const es = (n: number, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });

export function Salidas({ anual, fuente }: { anual: Anio[]; fuente: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visto = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [activa, setActiva] = useState(anual.length - 1);
  const a = anual[activa], base = anual[0];
  const max = Math.max(...anual.map((d) => d.salidas)) * 1.08;
  const n = anual.length;

  return (
    <section className="seccion" aria-labelledby="salidas-titulo">
      <div className="wrap">
        <div className="seccion__cabeza">
          <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>La marea de salidas</p>
          <h2 id="salidas-titulo" className="titulo-1">Las salidas casi se triplicaron entre {base.anio} y {anual[n - 1].anio}</h2>
        </div>
        <div className="grafico">
          <div className="panel">
            <div className="barras" ref={ref} role="group" aria-label={`Salidas por año, ${base.anio} a ${anual[n - 1].anio}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {anual.map((d, i) => {
                const h = (d.salidas / max) * 100;
                return (
                  <button key={d.anio} type="button" className="barra" data-activa={i === activa}
                    onMouseEnter={() => setActiva(i)} onFocus={() => setActiva(i)} onClick={() => setActiva(i)}
                    aria-label={`${d.anio}: ${es(d.salidas)} salidas`} aria-pressed={i === activa}>
                    {NOTAS[d.anio] && <span className="barra__nota" style={{ bottom: `calc(${h}% + 34px)` }}>{NOTAS[d.anio]}</span>}
                    <motion.span className="barra__valor num" initial={reduce ? false : { opacity: 0 }} animate={visto ? { opacity: 1 } : {}} transition={{ delay: 0.5 + i * 0.09 }}>
                      {es(d.salidas)}
                    </motion.span>
                    <motion.span className="barra__col" style={{ height: `${h}%` }}
                      initial={reduce ? false : { scaleY: 0 }} animate={visto ? { scaleY: 1 } : {}}
                      transition={{ duration: 0.9, delay: i * 0.09, ease: [0.2, 0.7, 0.2, 1] }} />
                  </button>
                );
              })}
            </div>
            <div className="barras__eje" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>{anual.map((d) => <span key={d.anio}>{d.anio}</span>)}</div>
          </div>
          <div className="notas">
            <div className="nota nota--hallazgo" aria-live="polite">
              <span className="nota__tipo">Hallazgo</span>
              <p>En <strong>{a.anio}</strong> hubo <strong className="num">{es(a.salidas)}</strong> salidas{activa > 0 ? <> (×{es(a.salidas / base.salidas, 1)} respecto de {base.anio})</> : ""}, con <span className="num">{es(a.especiesPorSalida, 1)}</span> especies por salida.</p>
            </div>
            <div className="nota"><span className="nota__tipo">Cómo leer</span><p>Cada barra suma las salidas del año en todo Chile. Pasa el cursor o usa el teclado para ver cada año.</p></div>
            <div className="nota"><span className="nota__tipo">Limitación</span><p>Las especies por salida se mantienen cerca de 9: más salidas reflejan más observación, no más aves.</p></div>
          </div>
        </div>
        <p className="cuerpo-s fuente">Fuente: {fuente}. <Link className="enlace" href="/estadisticas/#marea">Por mes y macrozona en el streamgraph</Link>.</p>
      </div>
    </section>
  );
}
