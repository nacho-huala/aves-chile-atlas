// Compartir un plan: URL con el estado, ruta en Google Maps, evento .ics e imagen 1080×1350 dibujada en canvas.
// Todo ocurre en el navegador; no hay servidor ni se envían datos a terceros hasta que la persona elige compartir.
import { geo, proyectar } from "@/lib/geo";
import { CIUDADES } from "@/lib/ciudades";
import { km, type Origen, type Punto } from "@/lib/planificador";

export interface EstadoURL { desde?: string; lista?: string[]; modo?: "cerca" | "lista"; radio?: number; sitio?: number }

/** El origen GPS no se publica tal cual: se reemplaza por la ciudad más cercana (≤ 30 km) o se redondea a ~10 km. */
export function origenParaURL(o: Origen | null) {
  if (!o) return undefined;
  if (o.tipo !== "gps") return o.nombre;
  const c = [...CIUDADES].sort((a, b) => km(o.punto, [a[2], a[3]]) - km(o.punto, [b[2], b[3]]))[0];
  if (c && km(o.punto, [c[2], c[3]]) <= 30) return c[0];
  return `${o.punto[0].toFixed(1)},${o.punto[1].toFixed(1)}`;
}

export function aURL(e: EstadoURL) {
  const p = new URLSearchParams();
  if (e.desde) p.set("desde", e.desde);
  if (e.modo === "lista") p.set("modo", "lista");
  if (e.lista?.length) p.set("lista", e.lista.join(","));
  if (e.radio !== undefined && e.radio !== 150) p.set("radio", Number.isFinite(e.radio) ? String(e.radio) : "chile");
  if (e.sitio !== undefined) p.set("sitio", String(e.sitio));
  const q = p.toString();
  return `${window.location.origin}/planificar/${q ? `?${q}` : ""}`;
}

export function deURL(): EstadoURL & { especie?: string } {
  const p = new URLSearchParams(window.location.search);
  const r = p.get("radio");
  return {
    desde: p.get("desde") ?? undefined, lista: p.get("lista")?.split(",").filter(Boolean), especie: p.get("especie") ?? undefined,
    modo: p.get("modo") === "lista" ? "lista" : undefined, radio: r === "chile" ? Infinity : r ? Number(r) : undefined,
    sitio: p.get("sitio") ? Number(p.get("sitio")) : undefined,
  };
}

/** Google Maps: ruta en auto desde el origen por las paradas (máx. 9 intermedias). Sin origen, parte desde la primera parada. */
export function urlGoogleMaps(origen: Punto | null, paradas: Punto[]) {
  if (!paradas.length) return null;
  const f = (p: Punto) => `${p[0]},${p[1]}`;
  const pts = origen ? paradas : paradas.slice(1);
  const ori = origen ?? paradas[0];
  const dest = pts[pts.length - 1] ?? paradas[0];
  const medio = pts.slice(0, -1).slice(0, 9);
  const q = new URLSearchParams({ api: "1", origin: f(ori), destination: f(dest), travelmode: "driving" });
  if (medio.length) q.set("waypoints", medio.map(f).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/** Evento de día completo (.ics) con las paradas y especies en la descripción; Google Calendar, Outlook y Apple lo importan. */
export function archivoICS(fecha: string, titulo: string, lugar: string, descripcion: string, url: string) {
  const d = fecha.replace(/-/g, ""), sig = new Date(`${fecha}T12:00:00`); sig.setDate(sig.getDate() + 1);
  const d2 = sig.toISOString().slice(0, 10).replace(/-/g, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Atlas de aves en Chile//Planificador//ES", "BEGIN:VEVENT",
    `UID:${ahora}-${Math.random().toString(36).slice(2)}@aves-chile-atlas`, `DTSTAMP:${ahora}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`,
    `SUMMARY:${esc(titulo)}`, `LOCATION:${esc(lugar)}`, `DESCRIPTION:${esc(`${descripcion}\n\n${url}`)}`, `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

export function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ─────────────── imagen para redes (1080 × 1350, formato vertical 4:5)
export type Capa = "atlas" | "esfuerzo" | "riqueza" | "topo" | "carto";
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
export const CAPAS: { id: Capa; txt: string; nota: string }[] = [
  { id: "atlas", txt: "Regiones", nota: "Contorno y límites regionales (BCN)" },
  { id: "esfuerzo", txt: "Esfuerzo eBird", nota: "Salidas por celda de 0,25°" },
  { id: "riqueza", txt: "Riqueza", nota: "Especies por celda de 0,25°" },
  { id: "topo", txt: "Topográfico", nota: "OpenTopoMap (si no carga, se usa Regiones)" },
  ...(CARTO_KEY ? [{ id: "carto" as Capa, txt: "Calles", nota: "CARTO Voyager" }] : []),
];
const ATRIB: Partial<Record<Capa, string>> = {
  topo: "© OpenStreetMap contributors, SRTM · estilo © OpenTopoMap (CC-BY-SA)",
  carto: "© OpenStreetMap contributors · © CARTO",
  esfuerzo: "eBird 2019–2025 · contorno BCN", riqueza: "eBird 2019–2025 · contorno BCN", atlas: "Contorno y regiones: BCN",
};

export interface Tarjeta {
  eyebrow: string; titulo: string; subtitulo: string; origen: Punto | null; puntos: Punto[];
  bloques: { titulo: string; detalle: string; especies: { nombre: string; p: number; foto?: string | null }[] }[];
  pie: string;
  contexto?: Punto[]; // otros sitios clave, como puntos tenues
  capa?: Capa;
}
const C = { fondo: "#e9e7dc", sup: "#f4f2ea", hund: "#dfddd0", texto: "#22261c", suave: "#595d4e", foco: "#7a2638", sol: "#8c6418", linea: "#bdbaa9", musgo: "#788445", tierra: "#d6d8b8", mar: "#dde4e6" };
const DISP = '"Fraunces Variable", Georgia, serif', SANS = '"Hanken Grotesk Variable", system-ui, sans-serif';
const ESC_MUSGO = ["#eef0dc", "#dfe4bf", "#c8d199", "#a9b673", "#879a4d", "#667b26"];
const ESC_VINO = ["#f3e8e6", "#e9d0cf", "#d9adb1", "#c3858d", "#a85f6c", "#86394a"];

function envolver(ctx: CanvasRenderingContext2D, t: string, ancho: number) {
  const out: string[] = []; let l = "";
  for (const w of t.split(" ")) { const p = l ? `${l} ${w}` : w; if (ctx.measureText(p).width > ancho && l) { out.push(l); l = w; } else l = p; }
  if (l) out.push(l); return out;
}

/** Imagen apta para canvas: mismo dominio o servidor con CORS. Si falla, null (nunca «contamina» el canvas). */
function cargarImagen(url: string | null | undefined, ms = 6000): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((res) => {
    const im = new Image(); if (/^https?:/.test(url)) im.crossOrigin = "anonymous";
    const t = setTimeout(() => res(null), ms);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = url;
  });
}
let celdas: Promise<{ celdas: [number, number, number, number, number, number][] } | null> | null = null;
const cargarCeldas = () => (celdas ??= fetch("/data/laminas/mapa.json").then((r) => r.json()).catch(() => null));

/** Inversa de la proyección vertical (Mercator escalada): coordenadas del SVG → [lat, lon]. */
function inversa(X: number, Y: number): Punto {
  const { x0, y0, k } = geo.vertical.proj, R = Math.PI / 180;
  const lon = (X / k + x0) / (1000 * R), ym = -(Y / k + y0) / 1000;
  return [(2 * Math.atan(Math.exp(ym)) - Math.PI / 2) / R, lon];
}

export async function dibujarTarjeta(t: Tarjeta): Promise<Blob> {
  await document.fonts?.ready;
  const capaPedida: Capa = t.capa ?? "atlas";
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.sup; ctx.beginPath(); ctx.roundRect(40, 40, W - 80, H - 80, 28); ctx.fill();
  ctx.fillStyle = C.sol; ctx.font = `600 24px ${SANS}`; ctx.fillText(t.eyebrow.toUpperCase(), 84, 112);
  // título: 62 px en hasta dos líneas; si no cabe, 48 px en hasta tres
  ctx.fillStyle = C.texto; ctx.font = `500 62px ${DISP}`;
  let tam = 62, tl = envolver(ctx, t.titulo, W - 168);
  if (tl.length > 2) { tam = 48; ctx.font = `500 48px ${DISP}`; tl = envolver(ctx, t.titulo, W - 168).slice(0, 3); }
  const alto = Math.round(tam * 1.1);
  tl.forEach((l, i) => ctx.fillText(l, 84, 182 + i * alto));
  let y = 182 + tl.length * alto - 10;
  ctx.fillStyle = C.suave; ctx.font = `400 28px ${SANS}`; envolver(ctx, t.subtitulo, W - 168).slice(0, 2).forEach((l) => { ctx.fillText(l, 84, y + 12); y += 38; });
  y += 24;

  // recursos en paralelo: fotos, logo y (si hace falta) celdas de eBird
  const urls = [...new Set(t.bloques.flatMap((b) => b.especies.map((e) => e.foto)).filter(Boolean) as string[])];
  const [fotosL, logo, datosCeldas] = await Promise.all([
    Promise.all(urls.map((u) => cargarImagen(u))), cargarImagen("/brand/logo-dia.svg"),
    capaPedida === "esfuerzo" || capaPedida === "riqueza" ? cargarCeldas() : Promise.resolve(null),
  ]);
  const fotos = new Map(urls.map((u, i) => [u, fotosL[i]]));

  // ── mapa
  const MX = 84, MY = y, MW = 330, MH = H - y - 226;
  let capa = capaPedida;
  const P = proyectar("vertical"), G = geo.vertical;
  const pts = [...t.puntos, ...(t.origen ? [t.origen] : [])].map((p) => P(p[1], p[0]));
  ctx.fillStyle = C.mar; ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.fill();
  if (pts.length) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minimo = pts.length <= 2 ? 26 : 14;
    let vh = Math.max(Math.max(...ys) - Math.min(...ys), minimo) * 1.35, vw = Math.max(Math.max(...xs) - Math.min(...xs), minimo * 0.4) * 1.5;
    if (vw / vh > MW / MH) vh = vw * MH / MW; else vw = vh * MW / MH;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, s = MW / vw;
    const x0 = cx - vw / 2, y0 = cy - vh / 2;
    const tx = (x: number) => MX + (x - x0) * s, ty = (yy: number) => MY + (yy - y0) * s;
    const aPantalla = (p: Punto) => { const [X, Y] = P(p[1], p[0]); return [tx(X), ty(Y)]; };
    const dentro = (X: number, Y: number, m = 0) => X > MX + m && X < MX + MW - m && Y > MY + m && Y < MY + MH - m;
    ctx.save(); ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.clip();

    // fondo según la capa
    const tierra = (relleno: string, borde = "#f4f2ea", grosor = 1.5) => {
      ctx.save(); ctx.translate(MX - x0 * s, MY - y0 * s); ctx.scale(s, s);
      ctx.fillStyle = relleno; ctx.strokeStyle = borde; ctx.lineWidth = grosor / s;
      for (const d of Object.values(G.zonas as Record<string, string>)) { const p2 = new Path2D(d); ctx.fill(p2); ctx.stroke(p2); }
      ctx.restore();
    };
    const limites = (color: string) => {
      ctx.save(); ctx.translate(MX - x0 * s, MY - y0 * s); ctx.scale(s, s);
      ctx.strokeStyle = color; ctx.lineWidth = 2 / s; ctx.setLineDash([6 / s, 4 / s]); ctx.stroke(new Path2D(G.bordes)); ctx.restore(); ctx.setLineDash([]);
    };
    if (capa === "topo" || capa === "carto") {
      const [latN, lonW] = inversa(x0, y0), [latS, lonE] = inversa(x0 + vw, y0 + vh);
      const pxGrado = Math.abs(aPantalla([latN, lonW + 1])[0] - aPantalla([latN, lonW])[0]);
      const z = Math.max(3, Math.min(capa === "topo" ? 15 : 17, Math.ceil(Math.log2((pxGrado * 360) / 256))));
      const n = 2 ** z, R = Math.PI / 180;
      const tX = (lo: number) => Math.floor(((lo + 180) / 360) * n), tY = (la: number) => Math.floor(((1 - Math.log(Math.tan(la * R) + 1 / Math.cos(la * R)) / Math.PI) / 2) * n);
      const lonT = (x: number) => (x / n) * 360 - 180, latT = (yy: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) / R;
      const fichas: { x: number; y: number }[] = [];
      for (let x = tX(lonW); x <= tX(lonE); x++) for (let yy = tY(latN); yy <= tY(latS); yy++) fichas.push({ x, y: yy });
      const url = (f: { x: number; y: number }, i: number) => capa === "topo"
        ? `https://${"abc"[i % 3]}.tile.opentopomap.org/${z}/${f.x}/${f.y}.png`
        : `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${f.x}/${f.y}.png?key=${CARTO_KEY}`;
      const imgs = fichas.length <= 60 ? await Promise.all(fichas.map((f, i) => cargarImagen(url(f, i), 8000))) : [];
      if (imgs.length && imgs.filter(Boolean).length / imgs.length > 0.6) {
        fichas.forEach((f, i) => {
          const im = imgs[i]; if (!im) return;
          const [ax, ay] = aPantalla([latT(f.y), lonT(f.x)]), [bx, by] = aPantalla([latT(f.y + 1), lonT(f.x + 1)]);
          ctx.drawImage(im, ax, ay, bx - ax + 0.5, by - ay + 0.5);
        });
        ctx.fillStyle = "rgba(244,242,234,.18)"; ctx.fillRect(MX, MY, MW, MH); // suaviza para que resalten las marcas
      } else { capa = "atlas"; }
    }
    if (capa === "atlas") { tierra(C.tierra); limites("rgba(89,93,78,.45)"); }
    if (capa === "esfuerzo" || capa === "riqueza") {
      tierra("#eeeedf");
      const cs = datosCeldas?.celdas ?? [];
      const v = (c: (typeof cs)[number]) => (capa === "esfuerzo" ? c[2] : c[3]);
      const esc = capa === "esfuerzo" ? ESC_MUSGO : ESC_VINO;
      // clases por cuantiles (seis tramos con igual número de celdas): evita que todo quede en el tono más oscuro
      const orden: number[] = cs.map(v).sort((a: number, b: number) => a - b);
      const cortes = esc.map((_, i) => orden[Math.floor(((i + 1) / esc.length) * (orden.length - 1))]);
      const clase = (x: number) => Math.min(esc.length - 1, cortes.findIndex((c) => x <= c));
      // las celdas se recortan a la tierra (no se pintan sobre el mar)
      ctx.save(); ctx.translate(MX - x0 * s, MY - y0 * s); ctx.scale(s, s);
      const tierraPath = new Path2D(); for (const d of Object.values(G.zonas as Record<string, string>)) tierraPath.addPath(new Path2D(d));
      ctx.clip(tierraPath); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const c of cs) {
        const [ax, ay] = aPantalla([c[0] + 0.125, c[1] - 0.125]), [bx, by] = aPantalla([c[0] - 0.125, c[1] + 0.125]);
        if (bx < MX || ax > MX + MW || by < MY || ay > MY + MH) continue;
        ctx.fillStyle = esc[Math.max(0, clase(v(c)))]; ctx.fillRect(ax, ay, bx - ax + 0.6, by - ay + 0.6);
      }
      ctx.restore(); // vuelve al recorte del mapa (el save/clip exterior sigue activo)
      limites("rgba(89,93,78,.5)");
      // mini leyenda de la capa
      ctx.fillStyle = "rgba(244,242,234,.92)"; ctx.beginPath(); ctx.roundRect(MX + 12, MY + MH - 88, 200, 62, 8); ctx.fill();
      ctx.fillStyle = C.texto; ctx.font = `600 15px ${SANS}`; ctx.fillText(capa === "esfuerzo" ? "Salidas por celda" : "Especies por celda", MX + 24, MY + MH - 64);
      esc.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(MX + 24 + i * 28, MY + MH - 54, 28, 14); });
      ctx.fillStyle = C.suave; ctx.font = `400 13px ${SANS}`; ctx.fillText("menos", MX + 24, MY + MH - 30); ctx.textAlign = "right"; ctx.fillText("más", MX + 24 + 168, MY + MH - 30); ctx.textAlign = "left";
    }
    if (capa === "atlas") { ctx.fillStyle = "#7d97a0"; ctx.font = `italic 400 22px ${DISP}`; ctx.fillText("Océano Pacífico", MX + 18, MY + MH - 22); }

    // otros sitios clave
    ctx.fillStyle = C.suave; ctx.globalAlpha = .5;
    for (const q of t.contexto ?? []) { const [X, Y] = aPantalla(q); ctx.beginPath(); ctx.arc(X, Y, 5, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // ciudades visibles (en la capa topográfica ya vienen rotuladas)
    const marcas = [...t.puntos, ...(t.origen ? [t.origen] : [])].map(aPantalla);
    if (capa !== "topo" && capa !== "carto") {
      ctx.font = `500 19px ${SANS}`;
      const ocupadas: [number, number, number, number][] = []; // cajas de rótulos ya puestos, para no encimarlos
      for (const [n, , la, lo] of CIUDADES) {
        const [sx, sy] = aPantalla([la, lo]);
        if (!dentro(sx, sy, 24) || marcas.some(([a, b]) => Math.hypot(a - sx, b - sy) < 34)) continue;
        ctx.fillStyle = C.texto; ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, 7); ctx.fill();
        const w = ctx.measureText(n).width, der = sx + 10 + w < MX + MW - 8;
        const caja: [number, number, number, number] = [der ? sx - 6 : sx - 14 - w, sy - 16, w + 22, 26];
        if (ocupadas.some(([a, b, c, d]) => caja[0] < a + c && a < caja[0] + caja[2] && caja[1] < b + d && b < caja[1] + caja[3])) continue;
        ocupadas.push(caja);
        ctx.fillStyle = "rgba(244,242,234,.88)"; ctx.fillRect(der ? sx + 8 : sx - 12 - w, sy - 14, w + 6, 22);
        ctx.fillStyle = C.texto; ctx.fillText(n, der ? sx + 11 : sx - 9 - w, sy + 3);
      }
    }
    // ruta, origen y paradas
    const ruta = [...(t.origen ? [t.origen] : []), ...t.puntos].map(aPantalla);
    ctx.strokeStyle = C.sup; ctx.lineWidth = 8; ctx.beginPath(); ruta.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke();
    ctx.strokeStyle = C.foco; ctx.lineWidth = 4; ctx.setLineDash([12, 9]); ctx.beginPath();
    ruta.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke(); ctx.setLineDash([]);
    if (t.origen) { const [X, Y] = aPantalla(t.origen); ctx.fillStyle = "rgba(122,38,56,.22)"; ctx.beginPath(); ctx.arc(X, Y, 22, 0, 7); ctx.fill();
      ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(X, Y, 9, 0, 7); ctx.fill(); ctx.strokeStyle = C.sup; ctx.lineWidth = 4; ctx.stroke(); }
    t.puntos.forEach((p, i) => {
      const [X, Y] = aPantalla(p); ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(X, Y, 20, 0, 7); ctx.fill();
      ctx.strokeStyle = C.sup; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = C.sup; ctx.font = `700 22px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(String(i + 1), X, Y + 8); ctx.textAlign = "left";
    });
    // barra de escala
    const la = t.puntos[0]?.[0] ?? -33, lo = t.puntos[0]?.[1] ?? -71;
    const pxKm = Math.abs(aPantalla([la, lo + 0.5])[0] - aPantalla([la, lo])[0]) / km([la, lo], [la, lo + 0.5]);
    const kmBar = [1, 2, 5, 10, 20, 50, 100, 200, 500].reduce((b, v2) => (v2 * pxKm <= MW * 0.4 ? v2 : b), 1), bw = kmBar * pxKm;
    ctx.fillStyle = "rgba(244,242,234,.92)"; ctx.beginPath(); ctx.roundRect(MX + MW - bw - 40, MY + 14, bw + 26, 46, 8); ctx.fill();
    ctx.fillStyle = C.texto; ctx.fillRect(MX + MW - bw - 27, MY + 46, bw, 5);
    ctx.font = `600 17px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(`${kmBar} km`, MX + MW - bw / 2 - 27, MY + 37); ctx.textAlign = "left";
    ctx.restore();
  }
  // atribución del mapa, bajo el mapa
  ctx.fillStyle = C.suave; ctx.font = `400 15px ${SANS}`;
  envolver(ctx, ATRIB[capa] ?? "", MW).slice(0, 2).forEach((l, i) => ctx.fillText(l, MX, MY + MH + 24 + i * 19));

  // ── paradas y especies (con miniatura de cada ave)
  const LX = MX + MW + 40, LW = W - 84 - LX; let ly = MY + 4;
  const maxY = MY + MH, numerar = t.bloques.length > 1, IND = numerar ? 50 : 0;
  // reparto del alto disponible: cada parada recibe filas según su lista; lo que no cabe se resume como «+N más»
  const FILA = 50, CAB = 84;
  const filasTot = Math.max(t.bloques.length, Math.floor((MH - t.bloques.length * (CAB + 14)) / FILA));
  const dosCol = t.bloques.length === 1 && t.bloques[0].especies.length > filasTot; // un solo sitio con muchas aves → dos columnas
  const porBloque = t.bloques.map((b) => b.especies.length);
  const cupo = porBloque.map(() => 1); let libres = filasTot - cupo.length;
  while (libres > 0 && cupo.some((c, i) => c < porBloque[i])) { cupo.forEach((c, i) => { if (libres > 0 && c < porBloque[i]) { cupo[i]++; libres--; } }); }
  const filaAve = (e: { nombre: string; p: number; foto?: string | null }, x0: number, ancho: number, fy: number, R2: number, fs: number) => {
    const fx = x0 + R2, im = e.foto ? fotos.get(e.foto) : null;
    ctx.save(); ctx.beginPath(); ctx.arc(fx, fy, R2, 0, 7); ctx.closePath();
    if (im) { ctx.clip(); const m = Math.min(im.width, im.height); ctx.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, fx - R2, fy - R2, R2 * 2, R2 * 2); }
    else { ctx.fillStyle = C.hund; ctx.fill(); ctx.fillStyle = C.sol; ctx.font = `600 ${R2}px ${DISP}`; ctx.textAlign = "center"; ctx.fillText(e.nombre[0], fx, fy + R2 * 0.35); ctx.textAlign = "left"; }
    ctx.restore();
    ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, R2, 0, 7); ctx.stroke();
    const barra = dosCol ? 44 : 84, bx = x0 + ancho - barra - 48;
    ctx.fillStyle = C.texto; ctx.font = `500 ${fs}px ${SANS}`;
    ctx.fillText(envolver(ctx, e.nombre, bx - (x0 + R2 * 2 + 12) - 8)[0], x0 + R2 * 2 + 12, fy + fs * 0.35);
    ctx.fillStyle = C.hund; ctx.beginPath(); ctx.roundRect(bx, fy - 5, barra, 10, 5); ctx.fill();
    ctx.fillStyle = C.musgo; ctx.beginPath(); ctx.roundRect(bx, fy - 5, Math.max(5, barra * e.p), 10, 5); ctx.fill();
    ctx.fillStyle = C.suave; ctx.font = `500 ${fs - 4}px ${SANS}`; ctx.fillText(`${Math.max(1, Math.round(e.p * 10))}/10`, bx + barra + 6, fy + 6);
  };
  t.bloques.forEach((b, i) => {
    if (ly > maxY - 100) return;
    if (numerar) {
      ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(LX + 18, ly + 14, 18, 0, 7); ctx.fill();
      ctx.fillStyle = C.sup; ctx.font = `700 20px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(String(i + 1), LX + 18, ly + 21); ctx.textAlign = "left";
    }
    ctx.fillStyle = C.texto; ctx.font = `600 29px ${DISP}`;
    const tt = envolver(ctx, b.titulo, LW - IND).slice(0, 2); tt.forEach((l, k) => ctx.fillText(l, LX + IND, ly + 24 + k * 33)); ly += tt.length * 33 + 2;
    ctx.fillStyle = C.suave; ctx.font = `400 20px ${SANS}`; ctx.fillText(b.detalle, LX + IND, ly + 14); ly += 32;
    if (dosCol) {
      const filas = Math.floor((maxY - ly) / 40), colW = (LW - 16) / 2;
      const max = Math.min(b.especies.length, filas * 2);
      b.especies.slice(0, max).forEach((e, k) => filaAve(e, LX + (k < filas ? 0 : colW + 16), colW, ly + 16 + (k % filas) * 40, 16, 18));
      if (b.especies.length > max) { ctx.fillStyle = C.suave; ctx.font = `500 18px ${SANS}`; ctx.fillText(`+${b.especies.length - max} especies más`, LX, maxY + 4); }
      ly = maxY;
    } else {
      const n = Math.min(b.especies.length, cupo[i]);
      for (const e of b.especies.slice(0, n)) { if (ly > maxY - 40) break; filaAve(e, LX + IND, LW - IND, ly + 21, 21, 23); ly += FILA; }
      if (b.especies.length > n) { ctx.fillStyle = C.suave; ctx.font = `500 19px ${SANS}`; ctx.fillText(`+${b.especies.length - n} especies más en esta parada`, LX + IND, ly + 10); ly += 30; }
    }
    ly += 14;
  });

  // ── pie: logo a la izquierda, leyenda «x/10» encuadrada a la derecha
  const PY = H - 168;
  ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(84, PY); ctx.lineTo(W - 84, PY); ctx.stroke(); ctx.setLineDash([]);
  const LBW = 400, LBX = W - 84 - LBW, LBY = PY + 18;
  if (logo) { const lh = 56, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, 76, PY + 14, lw, lh); }
  else { ctx.fillStyle = C.texto; ctx.font = `500 34px ${DISP}`; ctx.fillText("Atlas de aves en Chile", 84, PY + 54); }
  ctx.fillStyle = C.suave; ctx.font = `400 15px ${SANS}`;
  envolver(ctx, `${t.pie}${[...fotos.values()].some(Boolean) ? " · fotos: iNaturalist y Wikimedia Commons (licencias CC)" : ""}`, LBX - 84 - 24).slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, 84, PY + 90 + i * 19));
  ctx.fillStyle = C.hund; ctx.beginPath(); ctx.roundRect(LBX, LBY, LBW, 84, 12); ctx.fill();
  ctx.strokeStyle = C.linea; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = C.sup; ctx.beginPath(); ctx.roundRect(LBX + 18, LBY + 24, 84, 12, 6); ctx.fill();
  ctx.fillStyle = C.musgo; ctx.beginPath(); ctx.roundRect(LBX + 18, LBY + 24, 50, 12, 6); ctx.fill();
  ctx.fillStyle = C.texto; ctx.font = `700 19px ${SANS}`; ctx.fillText("6/10", LBX + 112, LBY + 36);
  ctx.font = `400 17px ${SANS}`; ctx.fillText("= en 6 de cada 10 salidas", LBX + 166, LBY + 36);
  ctx.fillStyle = C.suave; ctx.font = `400 15px ${SANS}`; ctx.fillText("se registró la especie · eBird 2019–2025", LBX + 18, LBY + 64);
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
