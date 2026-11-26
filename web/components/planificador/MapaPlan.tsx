"use client";
import { useMemo } from "react";
import { COLOR_MACROZONA, geo, proyectarVertical } from "@/lib/geo";
import { RecuadrosIslas } from "@/components/RecuadrosIslas";
import type { Punto, SitioPlan } from "@/lib/planificador";

const { P, recuadros } = proyectarVertical();
const G = geo.vertical;
const xy = (p: Punto) => P(p[1], p[0]);

/** Mapa vertical: todos los sitios tenues, los del plan destacados y numerados, y la ruta desde el origen. */
export function MapaPlan({ sitios, destacados, ruta, origen, sel, elegir }: {
  sitios: SitioPlan[]; destacados: number[]; ruta: number[]; origen: Punto | null; sel: number | null; elegir: (i: number) => void;
}) {
  const vb = useMemo(() => {
    const pts = [...destacados.map((i) => xy(sitios[i].punto)), ...(origen ? [xy(origen)] : [])];
    if (pts.length < 2 && !origen) return { x: -6, y: -6, w: G.width + 12, h: G.height + 12 };
    if (pts.length < 2) { const [cx, cy] = pts[0]; return { x: cx - 60, y: cy - 140, w: 120, h: 280 }; }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const h = Math.max(Math.max(...ys) - Math.min(...ys), 90) * 1.35, w = Math.max(Math.max(...xs) - Math.min(...xs) + 50, h * 0.45);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [sitios, destacados, origen]);
  const k = vb.h / 600; // tamaño constante en pantalla (el mapa se dibuja a ~600 px de alto), con o sin zoom
  const linea = [...(origen ? [xy(origen)] : []), ...ruta.map((i) => xy(sitios[i].punto))];

  return (
    <svg className="plan-mapa" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img"
      aria-label={`Mapa con ${destacados.length} sitios recomendados${origen ? " y tu punto de partida" : ""}`}>
      {Object.values(G.zonas as Record<string, string>).map((d, i) => <path key={i} d={d} fill="var(--superficie-hundida)" stroke="var(--linea)" strokeWidth={0.6 * k} />)}
      <RecuadrosIslas recuadros={recuadros} u={k} />
      {sitios.map((s, i) => { const [x, y] = xy(s.punto); return destacados.includes(i) ? null : <circle key={s.id} cx={x} cy={y} r={2.2 * k} fill="var(--texto-suave)" opacity={0.35} />; })}
      {linea.length > 1 && <polyline points={linea.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--foco)" strokeWidth={2 * k} strokeDasharray={`${5 * k} ${4 * k}`} strokeLinejoin="round" />}
      {destacados.map((i) => {
        const s = sitios[i], [x, y] = xy(s.punto), n = ruta.indexOf(i), on = sel === i;
        return (
          <g key={s.id} role="button" tabIndex={0} aria-label={`${s.nombre}${n >= 0 ? `, parada ${n + 1}` : ""}`} style={{ cursor: "pointer" }}
            onClick={() => elegir(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(i); } }}>
            <circle cx={x} cy={y} r={(on ? 11 : 9) * k} fill={COLOR_MACROZONA[s.macrozona ?? ""] ?? "var(--foco)"} stroke={on ? "var(--texto)" : "var(--superficie)"} strokeWidth={(on ? 2.5 : 1.5) * k} />
            {n >= 0 && <text x={x} y={y + 3.8 * k} textAnchor="middle" fontSize={10.5 * k} fontWeight={700} style={{ fill: "var(--sobre-foco)", fontFamily: "var(--font-sans)" }}>{n + 1}</text>}
            <title>{s.nombre}</title>
          </g>
        );
      })}
      {origen && (() => { const [x, y] = xy(origen); return (
        <g pointerEvents="none"><circle cx={x} cy={y} r={12 * k} fill="var(--foco)" opacity={0.18} /><circle cx={x} cy={y} r={5 * k} fill="var(--foco)" stroke="var(--superficie)" strokeWidth={2 * k} /></g>); })()}
    </svg>
  );
}
