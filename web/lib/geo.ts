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

/** Islas oceánicas. En el mapa vertical se dibujan en un recuadro junto a la costa, a su latitud real,
 *  para que no queden fuera del cuadro ni obliguen a achicar el continente
 *  (Juan Fernández está a ~670 km de la costa y Rapa Nui a ~3.700 km). */
const ISLAS = [
  { nombre: ["Juan", "Fernández"], lon: [-81.2, -78.5], lat: [-34.2, -33.2] },
  { nombre: ["Rapa Nui"], lon: [-109.6, -109.1], lat: [-27.6, -26.8] },
];
const CX_ISLA = 36, ANCHO_ISLA = 64;
export type Recuadro = { nombre: string[]; x: number; y: number; w: number; h: number };

/** Proyección vertical con las islas oceánicas trasladadas a su recuadro. */
export function proyectarVertical() {
  const P = proyectar("vertical");
  const porGrado = 1000 * R * geo.vertical.proj.k;
  const f = (lon: number, lat: number): [number, number] => {
    const [x, y] = P(lon, lat);
    const i = ISLAS.find((s) => lon >= s.lon[0] && lon <= s.lon[1] && lat >= s.lat[0] && lat <= s.lat[1]);
    return i ? [CX_ISLA + (lon - (i.lon[0] + i.lon[1]) / 2) * porGrado, y] : [x, y];
  };
  const recuadros: Recuadro[] = ISLAS.map((s) => {
    const y0 = P(-70, s.lat[1])[1], y1 = P(-70, s.lat[0])[1];
    return { nombre: s.nombre, x: CX_ISLA - ANCHO_ISLA / 2, y: y0, w: ANCHO_ISLA, h: y1 - y0 };
  });
  return { P: f, recuadros };
}
