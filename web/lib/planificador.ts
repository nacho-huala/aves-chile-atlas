// Planificador de salidas: sitios KBA cercanos y ruta mínima para ver una lista de especies.
// Datos: public/data/planificador.json (export_web.py → exportar_planificador). Todo se calcula en el navegador.

export interface SitioPlan {
  id: number; nombre: string; region: string | null; macrozona: string | null;
  punto: [number, number]; salidas: number; especies: number; riqueza: number | null; meses: number[];
}
/** e: [slug, nombre, foto, estatus, % de todas las salidas de Chile, UICN, dieta, hábitat] · r[i]: [índice de especie, % salidas completas, mes pico] */
export interface DatosPlan { e: [string, string, string | null, string | null, number, string | null, string | null, string | null][]; s: SitioPlan[]; r: [number, number, number][][]; nota: string }
export type Punto = [number, number];
export interface Origen { nombre: string; punto: Punto; tipo: "gps" | "ciudad" | "sitio"; precision?: number; cerca?: string }

export function km(a: Punto, b: Punto) {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Índice de probabilidad: prob[sitio].get(especie) = p (0–1) y su mes pico. */
export function indexar(d: DatosPlan) {
  return d.r.map((fila) => new Map(fila.map(([e, p, m]) => [e, { p: p / 100, mes: m }])));
}

export function cercanos(d: DatosPlan, o: Punto, radio: number, n = 8) {
  return d.s.map((s, i) => ({ i, s, d: km(o, s.punto) })).filter((x) => x.d <= radio).sort((a, b) => a.d - b.d).slice(0, n);
}

export interface Parada { i: number; s: SitioPlan; d: number | null; aporta: { e: number; p: number; mes: number }[] }
export interface Plan {
  paradas: Parada[];
  especies: { e: number; prob: number; mejor: { i: number; p: number } | null }[]; // prob de verla al menos una vez en el viaje
  sinSitio: number[]; // especies objetivo sin registros en sitios KBA con punto
  kmTotal: number | null;
}

/**
 * Cobertura voraz: en cada paso elige el sitio que más sube la probabilidad conjunta de ver las especies que faltan,
 * castigando la distancia al punto de partida o a la parada más cercana ya elegida (para agrupar el viaje).
 * Se detiene al llegar a la meta (por defecto 80 % por especie), al tope de paradas o si ningún sitio suma.
 */
export function planificar(d: DatosPlan, prob: ReturnType<typeof indexar>, objetivo: number[],
  origen: Punto | null, opts: { maxParadas?: number; meta?: number; radio?: number } = {}): Plan {
  const { maxParadas = 5, meta = 0.75, radio = Infinity } = opts;
  const q = new Map(objetivo.map((e) => [e, 1])); // probabilidad de NO verla aún
  const sinSitio = objetivo.filter((e) => !prob.some((m) => m.has(e)));
  const elegidos: number[] = [];
  let primeraGanancia = 0;
  const candidatos = d.s.map((s, i) => i).filter((i) => !origen || km(origen, d.s[i].punto) <= radio);
  for (let paso = 0; paso < maxParadas; paso++) {
    const faltan = objetivo.filter((e) => 1 - (q.get(e) ?? 1) < meta && !sinSitio.includes(e));
    if (!faltan.length) break;
    let mejor = -1, mejorScore = 0, mejorGan = 0;
    for (const i of candidatos) {
      if (elegidos.includes(i)) continue;
      let gan = 0;
      for (const e of faltan) { const x = prob[i].get(e); if (x) gan += (q.get(e) ?? 1) * x.p; }
      if (gan < Math.max(0.05, 0.2 * primeraGanancia)) continue; // una parada extra debe aportar al menos 1/5 de lo que aportó la primera
      const anclas = [...(origen ? [origen] : []), ...elegidos.map((j) => d.s[j].punto)];
      const dist = anclas.length ? Math.min(...anclas.map((a) => km(a, d.s[i].punto))) : 0;
      const score = gan / (1 + dist / 150);
      if (score > mejorScore) { mejorScore = score; mejor = i; mejorGan = gan; }
    }
    if (mejor < 0) break;
    if (!elegidos.length) primeraGanancia = mejorGan;
    elegidos.push(mejor);
    for (const e of objetivo) { const x = prob[mejor].get(e); if (x) q.set(e, (q.get(e) ?? 1) * (1 - x.p)); }
  }
  // orden de visita: vecino más cercano desde el origen (o desde el sitio más al norte)
  const orden: number[] = []; const resto = [...elegidos];
  let pos: Punto | null = origen ?? (resto.length ? [...resto].sort((a, b) => d.s[b].punto[0] - d.s[a].punto[0]).map((i) => d.s[i].punto)[0] : null);
  let kmTotal = 0;
  while (resto.length && pos) {
    const p0: Punto = pos;
    resto.sort((a, b) => km(p0, d.s[a].punto) - km(p0, d.s[b].punto));
    const i = resto.shift()!; kmTotal += km(p0, d.s[i].punto); orden.push(i); pos = d.s[i].punto;
  }
  const paradas = orden.map((i) => ({
    i, s: d.s[i], d: origen ? km(origen, d.s[i].punto) : null,
    aporta: objetivo.map((e) => ({ e, ...(prob[i].get(e) ?? { p: 0, mes: 0 }) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p),
  }));
  const especies = objetivo.map((e) => {
    const cand = orden.map((i) => ({ i, p: prob[i].get(e)?.p ?? 0 })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
    return { e, prob: 1 - (q.get(e) ?? 1), mejor: cand[0] ?? null };
  });
  return { paradas, especies, sinSitio, kmTotal: elegidos.length ? kmTotal : null };
}
