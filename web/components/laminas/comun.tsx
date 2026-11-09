"use client";
import { useCallback, useRef, useState } from "react";

export const es = (n: number, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
/** % con decimales que dependen del tamaño: 33 % · 2,4 % · 0,05 % · 0,0017 % */
export const pctTxt = (p: number) => `${p >= 10 ? es(p, 0) : p >= 1 ? es(p, 1) : p.toLocaleString("es-CL", { maximumSignificantDigits: 2 })} %`;
export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const ESTATUS = [
  { id: "nativa residente", txt: "Nativa residente", color: "var(--cat-musgo)" },
  { id: "migratoria / estacional", txt: "Migratoria / estacional", color: "var(--cat-mar)" },
  { id: "endémica", txt: "Endémica", color: "var(--cat-vino)" },
  { id: "introducida", txt: "Introducida", color: "var(--cat-ocre)" },
];
export const HABITATS = [
  { id: "bosque", txt: "Bosque", color: "var(--cat-musgo)" },
  { id: "costa", txt: "Costa y mar", color: "var(--cat-mar)" },
  { id: "ciudad", txt: "Ciudad", color: "var(--cat-vino)" },
  { id: "matorral", txt: "Matorral y pradera", color: "var(--cat-ocre)" },
  { id: "humedal", txt: "Humedal", color: "var(--cat-ciruela)" },
];
export const DIETAS = [
  { id: "invertívora", txt: "Invertívora", color: "var(--cat-musgo)" },
  { id: "carnívora / pescadora", txt: "Carnívora / pescadora", color: "var(--cat-mar)" },
  { id: "omnívora", txt: "Omnívora", color: "var(--cat-vino)" },
  { id: "granívora / herbívora", txt: "Granívora / herbívora", color: "var(--cat-ocre)" },
  { id: "nectarívora / frugívora", txt: "Nectarívora / frugívora", color: "var(--cat-ciruela)" },
];

/** Tooltip que sigue al puntero dentro de un contenedor posicionado. */
export function useTooltip<T>() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; d: T } | null>(null);
  const mover = useCallback((e: React.PointerEvent | React.FocusEvent, d: T) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    let x: number, y: number;
    if ("clientX" in e) { x = e.clientX - box.left; y = e.clientY - box.top; }
    else { const r = (e.target as Element).getBoundingClientRect(); x = r.left + r.width / 2 - box.left; y = r.top - box.top; }
    setTip({ x, y, d });
  }, []);
  const salir = useCallback(() => setTip(null), []);
  return { ref, tip, mover, salir };
}

export function Tip({ x, y, ancho, children }: { x: number; y: number; ancho: number; children: React.ReactNode }) {
  const izq = x > ancho * 0.62;
  return (
    <div className="tip" role="status" style={{ left: x, top: y, transform: `translate(${izq ? "calc(-100% - 14px)" : "14px"}, -50%)` }}>
      {children}
    </div>
  );
}

export function Leyenda({ items, activos, alternar }: { items: { id: string; txt: string; color: string; n?: number }[]; activos?: Set<string>; alternar?: (id: string) => void }) {
  return (
    <ul className="aa-leyenda leyenda-filtro" aria-label="Leyenda">
      {items.map((i) => {
        const on = !activos || activos.has(i.id);
        const cuerpo = <><i style={{ background: i.color, opacity: on ? 1 : 0.25 }} />{i.txt}{i.n !== undefined && <b>· {i.n}</b>}</>;
        return (
          <li key={i.id}>
            {alternar ? <button type="button" aria-pressed={on} onClick={() => alternar(i.id)}>{cuerpo}</button> : cuerpo}
          </li>
        );
      })}
    </ul>
  );
}
