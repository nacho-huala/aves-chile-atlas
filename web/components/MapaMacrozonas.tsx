"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import geo from "@/lib/chile-geo.json";
import type { ZonaResumen } from "@/lib/zonas";

type Orient = "horizontal" | "vertical";
const es = (n: number) => n.toLocaleString("es-CL");

function Mapa({ orient, zonas, activa, marcada, setActiva, elegir }: {
  orient: Orient; zonas: ZonaResumen[]; activa: string | null; marcada: string | null;
  setActiva: (z: string | null) => void; elegir: (z: ZonaResumen) => void;
}) {
  const g = geo[orient];
  const reduce = useReducedMotion();
  const H = orient === "horizontal";
  const pad = H ? { t: 58, r: 8, b: 40, l: 8 } : { t: 8, r: 120, b: 8, l: 8 };
  const vb = `${-pad.l} ${-pad.t} ${g.width + pad.l + pad.r} ${g.height + pad.t + pad.b}`;
  const ciudades = Object.entries(g.ciudades) as [string, number[]][];
  const foco = activa ?? marcada;

  return (
    <svg className={`mapa__svg mapa__svg--${H ? "h" : "v"}`} viewBox={vb} role="group" aria-label="Mapa de Chile continental dividido en cinco macrozonas">
      {zonas.map((z, i) => (
        <motion.g key={z.id} className="zona" tabIndex={0} role="button"
          aria-label={`${z.nombre}: ${z.regiones}`} aria-pressed={marcada === z.id}
          data-activa={foco === z.id}
          onMouseEnter={() => setActiva(z.id)} onMouseLeave={() => setActiva(null)}
          onFocus={() => setActiva(z.id)} onBlur={() => setActiva(null)}
          onClick={() => elegir(z)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(z); } }}
          initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.6, delay: i * 0.12 }}>
          <path d={(g.zonas as Record<string, string>)[z.id]} fill={`var(--${z.color})`} className="zona__forma" />
        </motion.g>
      ))}
      <path d={g.bordes} fill="none" stroke="var(--superficie)" strokeWidth={0.6} strokeOpacity={0.7} pointerEvents="none" />
      {ciudades.map(([n, [x, y]], i) => H ? (
        <g key={n} className="ciudad" pointerEvents="none">
          <line x1={x} x2={x} y1={y} y2={i % 2 ? -32 : -14} stroke="var(--texto-suave)" strokeWidth={0.8} />
          <circle cx={x} cy={y} r={2.6} />
          <text x={x} y={i % 2 ? -38 : -20} textAnchor="middle">{n}</text>
        </g>
      ) : (
        <g key={n} className="ciudad" pointerEvents="none">
          <line x1={x} x2={g.width + 12} y1={y} y2={y} stroke="var(--texto-suave)" strokeWidth={0.8} />
          <circle cx={x} cy={y} r={2.6} />
          <text x={g.width + 16} y={y + 4}>{n}</text>
        </g>
      ))}
      {H && <text className="mapa__oceano" style={{ fontFamily: "var(--font-display)" }} x={g.width * 0.42} y={g.height + 30}>Océano Pacífico</text>}
    </svg>
  );
}

/**
 * modo "enlace": al elegir una zona navega a la calculadora con ?zona=.
 * modo "selector": marca la zona y avisa con onElegir (lo usa la calculadora).
 */
export function MapaMacrozonas({ zonas, modo = "enlace", marcada = null, onElegir }: {
  zonas: ZonaResumen[]; modo?: "enlace" | "selector"; marcada?: string | null; onElegir?: (nombre: string) => void;
}) {
  const router = useRouter();
  const [activa, setActiva] = useState<string | null>(null);
  const elegir = (z: ZonaResumen) => (modo === "enlace" ? router.push(`/calculadora/?zona=${encodeURIComponent(z.nombre)}`) : onElegir?.(z.nombre));
  const zona = zonas.find((z) => z.id === (activa ?? marcada));

  return (
    <div className="mapa" data-hay-activa={(activa ?? marcada) !== null}>
      <div className="mapa__lienzo">
        <Mapa orient="horizontal" zonas={zonas} activa={activa} marcada={marcada} setActiva={setActiva} elegir={elegir} />
        <Mapa orient="vertical" zonas={zonas} activa={activa} marcada={marcada} setActiva={setActiva} elegir={elegir} />
      </div>
      <div className="mapa__fila">
        <ul className="zonas" aria-label="Macrozonas">
          {zonas.map((z) => (
            <li key={z.id}>
              <button type="button" aria-pressed={marcada === z.id} onMouseEnter={() => setActiva(z.id)} onMouseLeave={() => setActiva(null)} onFocus={() => setActiva(z.id)} onBlur={() => setActiva(null)} onClick={() => elegir(z)}>
                <i style={{ background: `var(--${z.color})` }} aria-hidden="true" />{z.nombre}
              </button>
            </li>
          ))}
        </ul>
        <div className="mapa__ficha" aria-live="polite">
          {zona ? (
            <>
              <span className="etiqueta etiqueta--sol">{zona.regiones}</span>
              <b>{zona.nombre}</b>
              <span className="cuerpo-s">
                <span className="num">{es(zona.salidas)}</span> salidas
                {zona.mediana60 !== null && <> · en 60 min se ven <span className="num">{es(zona.mediana60)}</span> especies (mediana)</>}
              </span>
              {zona.top.length > 0 && (
                <span className="cuerpo-s">Más probables: {zona.top.map((t, i) => (
                  <span key={t.slug}>{i > 0 && ", "}{modo === "selector" ? t.nombre : <Link className="enlace" href={`/especies/${t.slug}/`}>{t.nombre}</Link>} <span className="num">{Math.round(t.p * 100)}%</span></span>
                ))}</span>
              )}
            </>
          ) : (
            <><span className="etiqueta etiqueta--sol">Pista</span><span className="cuerpo-s">Pasa sobre el mapa o elige una zona.</span></>
          )}
        </div>
      </div>
    </div>
  );
}
