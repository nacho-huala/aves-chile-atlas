// Resumen por macrozona para el mapa (se arma AL COMPILAR desde calculadora.json y marea.json).
import { getCalculadora, getMarea } from "./data";
import { MACROZONAS, REGIONES } from "./macrozonas.mjs";

export interface ZonaResumen {
  id: string;
  nombre: string;
  color: string;
  regiones: string;
  salidas: number;
  mediana60: number | null; // especies (mediana) en una salida de 60 min
  top: { slug: string; nombre: string; p: number }[]; // las 3 más probables en 60 min
}

export async function getZonas(): Promise<ZonaResumen[]> {
  const [calc, marea] = await Promise.all([getCalculadora(), getMarea()]);
  return MACROZONAS.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    color: m.color,
    regiones: m.regiones.map((r) => REGIONES[r]).join(" · "),
    salidas: marea.filter((f) => f.macrozona === m.nombre).reduce((s, f) => s + f.salidas, 0),
    mediana60: calc.acumulacion[m.nombre]?.["60"]?.mediana ?? null,
    top: (calc.probabilidad[m.nombre]?.["60"] ?? []).slice(0, 3),
  }));
}
