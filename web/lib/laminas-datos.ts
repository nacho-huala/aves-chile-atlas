// Tipos y lectores de las láminas interactivas. Los JSON los escribe exportar_laminas() en
// pipeline/export_web.py (web/public/data/laminas/). Si cambias un campo, cámbialo en los dos.
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "data", "laminas");
const leer = async <T,>(a: string) => JSON.parse(await readFile(path.join(DIR, a), "utf8")) as T;

export interface Ref { slug: string; nombre: string }

/** 1 · mapa bivariado: [lat, lon, salidas, especies, claseEsfuerzo 0–2, claseRiqueza 0–2] */
export interface DatosMapa { campos: string[]; celdas: [number, number, number, number, number, number][]; fuera: number }

/** 2 · la ola: % de salidas completas por mes (12 filas) × franja de 0,5° (norte → sur) */
export interface Ola { bandas: number[]; pct: (number | null)[][] }
export interface OlaEspecie extends Ref, Ola { sci: string }

/** 3 · rueda fenológica */
export interface RuedaEspecie extends Ref { sci: string; pct: (number | null)[]; comun: boolean }

/** 4 · reloj: reloj[local|solar][zona][mes 0–11][hora 0–23] = salidas; sol[zona][mes] = [amanecer, atardecer] */
export interface DatosReloj { zonas: string[]; reloj: Record<string, Record<string, number[][]>>; sol: Record<string, ([number, number] | null)[]> }

/** 5 · enjambre · 9 riesgo */
export interface EspecieLamina extends Ref { pct: number; obs: number | null; estatus: string | null; uicn: string | null; endemica: boolean }

/** 10 · oído vs. vista: log10(grab) = a + b·log10(pct) */
export interface OidoEspecie extends Ref { pct: number; grab: number; veces: number; audio: string | null; autor: string | null; licencia: string | null; url: string | null }
export interface DatosOido { a: number; b: number; n: number; especies: OidoEspecie[] }

/** 11 · rasgos (AVONET) */
export interface RasgoEspecie extends Ref { masa: number; culmen: number; picoRel: number; pct: number | null; dieta: string | null; habitat: string | null }

/** 8 · red de co-ocurrencia */
export interface Nodo extends Ref { sci: string; pct: number; comunidad: number; habitat: string | null }
export interface DatosRed { nodos: Nodo[]; aristas: { a: string; b: string; lift: number; juntas: number }[] }

export const getMapa = () => leer<DatosMapa>("mapa.json");
export const getOla = () => leer<OlaEspecie[]>("ola.json");
export const getRueda = () => leer<RuedaEspecie[]>("rueda.json");
export const getReloj = () => leer<DatosReloj>("reloj.json");
export const getEspeciesLamina = () => leer<EspecieLamina[]>("especies.json");
export const getOido = () => leer<DatosOido>("oido.json");
export const getRasgos = () => leer<RasgoEspecie[]>("rasgos.json");
export const getRed = () => leer<DatosRed>("red.json");
