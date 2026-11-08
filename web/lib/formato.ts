export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];

export const entero = (n: number) => n.toLocaleString("es-CL");
export const pct = (n: number, d = 1) => `${n.toLocaleString("es-CL", { maximumFractionDigits: d })} %`;

/** «1 de cada N salidas»: la forma en que el atlas comunica el % de salidas. */
export function unoDeCada(p: number): string {
  if (p <= 0) return "no registrada";
  const n = 100 / p;
  if (n < 1.5) return "en casi todas las salidas";
  if (n < 10) return `en 1 de cada ${Math.round(n)} salidas`;
  if (n < 1000) return `en 1 de cada ${Math.round(n / 5) * 5 || Math.round(n)} salidas`;
  return `en 1 de cada ${entero(Math.round(n / 100) * 100)} salidas`;
}

export const UICN: Record<string, string> = {
  LC: "Preocupación menor", NT: "Casi amenazada", VU: "Vulnerable", EN: "En peligro",
  CR: "En peligro crítico", DD: "Datos insuficientes",
};
