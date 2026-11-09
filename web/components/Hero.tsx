"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GlifoDatos, GlifoEspecie, GlifoLugar } from "./Glifos";

const EASE = [0.2, 0.7, 0.2, 1] as const;

export interface HeroProps {
  especies: number;
  salidas: number;
  desde: number;
  hasta: number;
  destacada: { nombre: string; sci: string; frase: string; foto: string; href: string };
}

export function Hero({ especies, salidas, desde, hasta, destacada }: HeroProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const es = (n: number) => n.toLocaleString("es-CL");

  const OPCIONES = [
    { tecla: "1", num: "01 · Especie", titulo: "Una especie", texto: `Busca entre ${es(especies)} especies por nombre o estatus.`, href: "/especies/", Glifo: GlifoEspecie },
    { tecla: "2", num: "02 · Lugar", titulo: "Un lugar", texto: "Elige una macrozona en el mapa y te decimos qué aves esperar.", href: "/calculadora/", Glifo: GlifoLugar },
    { tecla: "3", num: "03 · Datos", titulo: "Los datos", texto: "Rareza, temporadas y qué especies se ven juntas.", href: "/datos/", Glifo: GlifoDatos },
  ];

  // Atajo: 1, 2 o 3 abre la vía correspondiente.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      const o = OPCIONES.find((x) => x.tecla === e.key);
      if (o) router.push(o.href);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Celdas detrás de la foto: la escalera de celdas de 0,25° del mapa.
  const celdas = useMemo(() => {
    const out: { x: number; y: number; t: number }[] = [];
    for (let r = 0; r < 11; r++) for (let c = 0; c < 11; c++) {
      const diag = c - r;
      if (diag >= -3 && diag <= 3 && (r * 7 + c * 3) % 5 !== 0) out.push({ x: c, y: r, t: Math.abs(diag) });
    }
    return out;
  }, []);

  const entra = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: d, ease: EASE } });

  return (
    <section className="hero" aria-labelledby="hero-titulo">
      <div className="wrap">
        <div className="hero__grid">
          <div className="hero__texto">
            <motion.p className="etiqueta etiqueta--foco" {...entra(0.05)} style={{ margin: 0 }}>
              Guía de campo · eBird Chile {desde}–{hasta}
            </motion.p>
            <h1 id="hero-titulo" className="display-xl hero__h1">
              {[<>¿Qué buscas</>, <><em>hoy</em>?</>].map((l, i) => (
                <span className="linea" key={i}>
                  <motion.span initial={reduce ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.12 + i * 0.1, ease: EASE }}>{l}</motion.span>
                </span>
              ))}
            </h1>
            <motion.p className="cuerpo-l" {...entra(0.35)}>
              {es(especies)} especies y {es(salidas)} salidas de observación, ordenadas para que sepas qué mirar y dónde.
            </motion.p>
          </div>

          <div className="hero__ave">
            <svg className="hero__celdas" viewBox="0 0 66 66" aria-hidden="true">
              {celdas.map((c, i) => (
                <motion.rect key={i} x={c.x * 6} y={c.y * 6} width={5} height={5} rx={1}
                  fill={`var(--musgo-${[3, 2, 2, 1][c.t] ?? 1})`}
                  initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ transformOrigin: `${c.x * 6 + 2.5}px ${c.y * 6 + 2.5}px` }}
                  transition={{ duration: 0.5, delay: 0.3 + (c.x + c.y) * 0.025, ease: EASE }} />
              ))}
            </svg>
            <motion.div className="hero__foto" initial={reduce ? false : { opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.1, delay: 0.25, ease: EASE }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={destacada.foto} alt={`${destacada.nombre} (${destacada.sci}) posado`} width={1024} height={1024} fetchPriority="high" />
            </motion.div>
            <motion.div {...entra(0.75)} className="hero__dato">
              <Link href={destacada.href}>
                <span className="etiqueta etiqueta--sol">La más común</span>
                <b>{destacada.nombre}</b>
                <span className="cuerpo-s">{destacada.frase}</span>
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.ul className="opciones" aria-label="Elige por dónde empezar"
          initial={reduce ? false : "oculto"} animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}>
          {OPCIONES.map(({ tecla, num, titulo, texto, href, Glifo }) => (
            <motion.li key={href} variants={{ oculto: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
              <Link href={href} className="opcion" aria-keyshortcuts={tecla}>
                <span className="opcion__glifo"><Glifo /></span>
                <span className="opcion__num">{num}</span>
                <span className="opcion__titulo">{titulo}</span>
                <span className="opcion__texto">{texto}</span>
                <span className="opcion__ir" aria-hidden="true"><span className="flecha">→</span></span>
                <kbd className="opcion__tecla" aria-hidden="true">{tecla}</kbd>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
