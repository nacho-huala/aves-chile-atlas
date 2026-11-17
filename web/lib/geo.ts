// Proyección del contorno de Chile (lib/chile-geo.json, BCN). La usan los mapas que dibujan puntos o celdas.
import geo from "@/lib/chile-geo.json";

export type Orient = "horizontal" | "vertical";
export { geo };

const R = Math.PI / 180;
const merc = (lon: number, lat: number) => [1000 * lon * R, -1000 * Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2))];

/** Devuelve (lon, lat) → [x, y] en las coordenadas del SVG de esa orientación. */
export function proyectar(o: Orient) {
  const { rotar, x0, y0, k } = geo[o].proj;
  return (lon: number, lat: number): [number, number] => {
    const [x, y] = merc(lon, lat);
    const [a, b] = rotar ? [y, -x] : [x, y];
    return [(a - x0) * k, (b - y0) * k];
  };
}

export const COLOR_MACROZONA: Record<string, string> = {
  "Norte Grande": "var(--cat-musgo)", "Norte Chico": "var(--cat-mar)", Centro: "var(--cat-vino)",
  Sur: "var(--cat-ocre)", Austral: "var(--cat-ciruela)",
};
export const MACROZONAS = Object.keys(COLOR_MACROZONA);
