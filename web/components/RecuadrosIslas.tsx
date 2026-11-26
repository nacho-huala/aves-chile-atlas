import type { Recuadro } from "@/lib/geo";

/** Recuadros punteados de las islas oceánicas; `u` = unidades del SVG por píxel en pantalla. */
export function RecuadrosIslas({ recuadros, u }: { recuadros: Recuadro[]; u: number }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {recuadros.map((r) => (
        <g key={r.nombre.join(" ")}>
          <rect className="isla-recuadro" x={r.x} y={r.y} width={r.w} height={r.h} rx={3 * u} strokeWidth={u} strokeDasharray={`${3 * u} ${3 * u}`} />
          {r.nombre.map((t, i) => (
            <text key={t} className="isla-nombre" x={r.x + 1 * u} y={r.y + r.h + (10 + i * 10) * u} fontSize={9 * u} style={{ fontFamily: "var(--font-sans)" }}>{t}</text>
          ))}
        </g>
      ))}
    </g>
  );
}
