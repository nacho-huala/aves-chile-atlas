// Textos de la ficha: traducciones de AVONET y créditos legibles.
export const HABITAT_ES: Record<string, string> = {
  Marine: "Mar", Wetland: "Humedal", Grassland: "Pastizal", Shrubland: "Matorral", Forest: "Bosque",
  "Human Modified": "Ciudad y campo", Woodland: "Bosque abierto", Coastal: "Costa", Riverine: "Ríos", Rock: "Roquerío",
};
export const DIETA_ES: Record<string, string> = {
  "Aquatic predator": "Depredadora acuática", Invertivore: "Insectívora", Omnivore: "Omnívora", Granivore: "Granívora",
  "Herbivore aquatic": "Herbívora acuática", Vertivore: "Carnívora", "Herbivore terrestrial": "Herbívora",
  Nectarivore: "Nectarívora", Frugivore: "Frugívora", Scavenger: "Carroñera",
};

/** "https://creativecommons.org/licenses/by-nc-sa/4.0/" o "cc-by-nc" → "CC BY-NC-SA 4.0" */
export function licenciaCorta(l: string | null | undefined) {
  if (!l) return null;
  const m = l.match(/licenses\/([a-z-]+)\/([\d.]+)/i);
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
  if (/^cc0/i.test(l)) return "CC0";
  if (/^cc-/i.test(l)) return `CC ${l.slice(3).toUpperCase()}`;
  return l;
}
export function urlLicencia(l: string | null | undefined) {
  if (!l) return null;
  if (l.startsWith("http") || l.startsWith("//")) return l.startsWith("//") ? `https:${l}` : l;
  const m = l.match(/^cc-([a-z-]+)$/i);
  return m ? `https://creativecommons.org/licenses/${m[1].toLowerCase()}/4.0/` : null;
}
/** "(c) Esteban Poveda, some rights reserved (CC BY), uploaded by …" → "Esteban Poveda" */
export function autorFoto(c: string | null | undefined) {
  if (!c) return null;
  const m = c.match(/^\(c\)\s*([^,]+)/i);
  return (m ? m[1] : c.split(",")[0]).trim();
}

export const UICN_ESCALA = ["LC", "NT", "VU", "EN", "CR"] as const;
