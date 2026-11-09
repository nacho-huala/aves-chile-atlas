// Genera lib/chile-geo.json: Chile continental por macrozona (regiones BCN unidas) en dos orientaciones.
// Cartografía: Biblioteca del Congreso Nacional (BCN), vía el paquete react-chile-map (MIT).
// Uso: npm run geo
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { merge, mesh } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoMercator, geoPath, geoTransform, geoBounds } from 'd3-geo';
import { MACROZONAS } from '../lib/macrozonas.mjs';

const require = createRequire(import.meta.url);
let topo = JSON.parse(readFileSync(require.resolve('react-chile-map/data/regiones.json'), 'utf8'));
// Simplifica conservando la topología (bordes compartidos): basta para un mapa de 1200 px.
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.12));
const BCN = { '15': 'CL-AP', '01': 'CL-TA', '02': 'CL-AN', '03': 'CL-AT', '04': 'CL-CO', '05': 'CL-VS', '13': 'CL-RM', '06': 'CL-LI',
  '07': 'CL-ML', '16': 'CL-NB', '08': 'CL-BI', '09': 'CL-AR', '14': 'CL-LR', '10': 'CL-LL', '11': 'CL-AI', '12': 'CL-MA' };
const geoms = topo.objects.regiones.geometries;
const iso = (g) => BCN[g.properties.code];

// Sin Rapa Nui, Juan Fernández ni Desventuradas (al oeste de -76°), como en el mapa bivariado.
const continental = (f) => {
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
    .filter((p) => geoBounds({ type: 'Polygon', coordinates: p })[0][0] > -76);
  return { type: 'Feature', properties: f.properties, geometry: { type: 'MultiPolygon', coordinates: polys } };
};
const zonas = MACROZONAS.map((m) => ({ id: m.id, f: continental({ type: 'Feature', properties: {}, geometry: merge(topo, geoms.filter((g) => m.regiones.includes(iso(g)))) }) }));
const pais = { type: 'FeatureCollection', features: zonas.map((z) => z.f) };
const bordes = mesh(topo, topo.objects.regiones, (a, b) => a !== b && MACROZONAS.find((m) => m.regiones.includes(iso(a))) === MACROZONAS.find((m) => m.regiones.includes(iso(b))));

const CIUDADES = [['Arica', -70.3, -18.48], ['Antofagasta', -70.4, -23.65], ['La Serena', -71.25, -29.9], ['Santiago', -70.65, -33.45],
  ['Concepción', -73.05, -36.83], ['Puerto Montt', -72.94, -41.47], ['Coyhaique', -72.07, -45.57], ['Punta Arenas', -70.91, -53.16]];
const merc = geoMercator().scale(1000).translate([0, 0]);

function build(rotar, W) {
  const t = (x, y) => (rotar ? [y, -x] : [x, y]); // rotar: norte a la izquierda, océano abajo
  const crudo = geoTransform({ point(lon, lat) { const [x, y] = merc([lon, lat]); this.stream.point(...t(x, y)); } });
  const [[x0, y0], [x1, y1]] = geoPath(crudo).bounds(pais);
  const k = W / (x1 - x0);
  const p = (lon, lat) => { const [x, y] = merc([lon, lat]); const [a, b] = t(x, y); return [+((a - x0) * k).toFixed(1), +((b - y0) * k).toFixed(1)]; };
  const path = geoPath(geoTransform({ point(lon, lat) { this.stream.point(...p(lon, lat)); } }));
  path.digits?.(1);
  return {
    width: W, height: +((y1 - y0) * k).toFixed(1),
    // para proyectar lon/lat en el cliente: Mercator escala 1000, luego (rotar ? [y, -x] : [x, y]), restar x0/y0 y multiplicar por k
    proj: { rotar, x0: +x0.toFixed(4), y0: +y0.toFixed(4), k: +k.toFixed(6) },
    zonas: Object.fromEntries(zonas.map((z) => [z.id, path(z.f)])),
    bordes: path(bordes),
    ciudades: Object.fromEntries(CIUDADES.map(([n, lon, lat]) => [n, p(lon, lat)])),
  };
}
writeFileSync(new URL('../lib/chile-geo.json', import.meta.url), JSON.stringify({ fuente: 'BCN, mapas vectoriales (vía react-chile-map)', horizontal: build(true, 1200), vertical: build(false, 220) }));
console.log('lib/chile-geo.json listo');
