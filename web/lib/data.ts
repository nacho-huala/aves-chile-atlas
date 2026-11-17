// Único lugar del sitio que conoce el formato de los datos.
// Los JSON los genera pipeline/export_web.py en web/public/data/ y se leen aquí AL COMPILAR
// (componentes de servidor). Así no hay backend: cada página sale como HTML estático
// y los componentes interactivos reciben sus datos como props.
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "data");

async function leer<T>(archivo: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DIR, archivo), "utf8")) as T;
}

// ─────────────── tipos (deben coincidir con export_web.py)
export type Estatus = "nativa residente" | "migratoria / estacional" | "endémica" | "introducida";

export interface EspecieIndice {
  slug: string;
  sci: string;
  nombre: string;
  familia: string | null;
  pct: number; // % de TODAS las salidas con la especie (0–100)
  salidas: number;
  estatus: Estatus | null;
  uicn: string | null; // LC, NT, VU, EN, CR, DD
  foto: string | null;
  mejorMes: number | null; // 1–12
}

export interface Ficha extends EspecieIndice {
  nombreIngles: string;
  orden: string | null;
  observadores: number | null;
  macrozona: string | null;
  endemica: boolean;
  primerAvistamiento: string | null;
  ultimoAvistamiento: string | null;
  fenologia: (number | null)[] | null; // % de salidas COMPLETAS por mes, ene → dic
  nidificacion: { resumen: string | null; revisar: boolean; meses: number[]; altitud: [number, number] | null } | null; // Medrano et al. 2018
  ola: { bandas: number[]; pct: (number | null)[][] } | null; // lámina 2: mes × franja de 0,5° (norte → sur)
  imagen: { url: string | null; credito: string | null; licencia: string | null };
  canto: {
    audio: string; tipo: string | null; calidad: string | null; autor: string | null;
    licencia: string | null; url: string | null; grabacionesChile: number | null;
  } | null;
  rasgos: {
    masaG: number | null; picoMm: number | null; alaMm: number | null; habitat: string | null;
    dieta: string | null; estiloVida: string | null; migracion: string | null;
  };
  enlaces: { ebird: string | null; wikipedia: string | null; inaturalist: string | null };
}

export interface Resumen {
  desde: string; hasta: string; salidas: number; salidasCompletas: number; avistamientos: number;
  avistamientosCrudos: number; listasEbird: number; especies: number; observadores: number; localidades: number;
  anual: { anio: number; salidas: number; observadores: number; especiesPorSalida: number }[];
  fuente: string;
}

export interface PuntoAcumulacion { n: number; mediana: number; q1: number; q3: number }
export interface Calculadora {
  zonas: string[];
  acumulacion: Record<string, Record<string, PuntoAcumulacion>>; // zona → minutos → resumen
  probabilidad: Record<string, Record<string, { slug: string; nombre: string; p: number }[]>>;
  nota: string;
}

export interface FilaMarea { anio: number; mes: number; macrozona: string; salidas: number }

// ─────────────── lectores
export interface KbaEspecie { slug: string; nombre: string; salidas: number; p: number | null; mes: number | null }
export interface KbaSitio {
  id: number; nombre: string; region: string | null; macrozona: string | null;
  salidas: number; localidades: number; especies: number; riqueza: number | null;
  nGatillo: number | null; gatilloVistas: number | null;
  punto: [number, number] | null; // celda de ~1 km derivada de eBird, no de la capa KBA
  meses: number[]; // salidas por mes (1–12)
  top: KbaEspecie[];
}
export interface Kba {
  sitios: KbaSitio[];
  resumen: { sitiosTotal: number; sitiosConDatos: number; sitiosSinSalidas: number; puntosPublicables: number;
             proteccion: { tramo: string; sitios: number; salidas: number; pct: number }[] };
  nota: string; cita: string;
}

export interface UicnAgregado {
  categorias: { cat: string; especies: number; decreciente: number; estable: number; creciente: number; desconocida: number }[];
  cita: string;
}

export const getResumen = () => leer<Resumen>("resumen.json");
export const getEspecies = () => leer<EspecieIndice[]>("especies.json");
export const getFicha = (slug: string) => leer<Ficha>(`especies/${slug}.json`);
export const getCalculadora = () => leer<Calculadora>("calculadora.json");
export const getMarea = () => leer<FilaMarea[]>("marea.json");
export const getKba = () => leer<Kba>("kba.json");
export const getUicn = () => leer<UicnAgregado>("uicn.json");
