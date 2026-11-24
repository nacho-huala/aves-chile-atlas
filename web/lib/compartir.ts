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
export interface Tarjeta {
  eyebrow: string; titulo: string; subtitulo: string; origen: Punto | null; puntos: Punto[];
  bloques: { titulo: string; detalle: string; especies: { nombre: string; p: number; foto?: string | null }[] }[];
  pie: string;
  contexto?: Punto[]; // otros sitios clave, como puntos tenues
}

/** Carga una foto apta para canvas (CORS). Prueba la URL y su copia en el bucket abierto de iNaturalist; si no, null. */
function cargarFoto(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  const intentos = [url, url.replace("static.inaturalist.org/photos", "inaturalist-open-data.s3.amazonaws.com/photos")];
  const uno = (u: string) => new Promise<HTMLImageElement | null>((res) => {
    const im = new Image(); im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer";
    const t = setTimeout(() => res(null), 5000);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = u;
  });
  return intentos.reduce<Promise<HTMLImageElement | null>>((p, u) => p.then((r) => r ?? uno(u)), Promise.resolve(null));
}
const C = { fondo: "#e9e7dc", sup: "#f4f2ea", hund: "#dfddd0", texto: "#22261c", suave: "#595d4e", foco: "#7a2638", sol: "#8c6418", linea: "#bdbaa9", musgo: "#788445", tierra: "#c8cb9f" };
const DISP = '"Fraunces Variable", Georgia, serif', SANS = '"Hanken Grotesk Variable", system-ui, sans-serif';

function envolver(ctx: CanvasRenderingContext2D, t: string, ancho: number) {
  const out: string[] = []; let l = "";
  for (const w of t.split(" ")) { const p = l ? `${l} ${w}` : w; if (ctx.measureText(p).width > ancho && l) { out.push(l); l = w; } else l = p; }
  if (l) out.push(l); return out;
}

export async function dibujarTarjeta(t: Tarjeta): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, W, H);
  // marco y cabecera
  ctx.fillStyle = C.sup; ctx.beginPath(); ctx.roundRect(40, 40, W - 80, H - 80, 28); ctx.fill();
  ctx.fillStyle = C.sol; ctx.font = `600 24px ${SANS}`; ctx.fillText(t.eyebrow.toUpperCase(), 84, 112);
  // título: 62 px en hasta dos líneas; si no cabe, 48 px en hasta tres (nombres largos de sitios)
  ctx.fillStyle = C.texto; ctx.font = `500 62px ${DISP}`;
  let tam = 62, tl = envolver(ctx, t.titulo, W - 168);
  if (tl.length > 2) { tam = 48; ctx.font = `500 48px ${DISP}`; tl = envolver(ctx, t.titulo, W - 168).slice(0, 3); }
  const alto = Math.round(tam * 1.1);
  tl.forEach((l, i) => ctx.fillText(l, 84, 182 + i * alto));
  let y = 182 + tl.length * alto - 10;
  ctx.fillStyle = C.suave; ctx.font = `400 28px ${SANS}`; envolver(ctx, t.subtitulo, W - 168).slice(0, 2).forEach((l) => { ctx.fillText(l, 84, y + 12); y += 38; });
  y += 24;

  // fotos de las especies (en paralelo; las que no permitan CORS quedan como círculo con inicial)
  const fotos = new Map<string, HTMLImageElement | null>();
  await Promise.all([...new Set(t.bloques.flatMap((b) => b.especies.map((e) => e.foto)).filter(Boolean) as string[])]
    .map(async (u) => fotos.set(u, await cargarFoto(u))));

  // mapa a la izquierda: encuadre justo en las paradas (y el origen), con ciudades, otros sitios y escala
  const MX = 84, MY = y, MW = 330, MH = H - y - 170;
  ctx.fillStyle = "#dde4e6"; ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.fill(); // mar
  const P = proyectar("vertical"), G = geo.vertical;
  const pts = [...t.puntos, ...(t.origen ? [t.origen] : [])].map((p) => P(p[1], p[0]));
  if (pts.length) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minimo = pts.length <= 2 ? 26 : 14; // con uno o dos puntos, dejar algo de costa y valle de contexto
    let vh = Math.max(Math.max(...ys) - Math.min(...ys), minimo) * 1.35, vw = Math.max(Math.max(...xs) - Math.min(...xs), minimo * 0.4) * 1.5;
    if (vw / vh > MW / MH) vh = vw * MH / MW; else vw = vh * MW / MH;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, s = MW / vw;
    const x0 = cx - vw / 2, y0 = cy - vh / 2;
    const tx = (x: number) => MX + (x - x0) * s, ty = (yy: number) => MY + (yy - y0) * s;
    const dentro = (X: number, Y: number, m = 0) => X > MX + m && X < MX + MW - m && Y > MY + m && Y < MY + MH - m;
    ctx.save(); ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.clip();
    ctx.save(); ctx.translate(MX - x0 * s, MY - y0 * s); ctx.scale(s, s);
    ctx.fillStyle = C.tierra; ctx.strokeStyle = "#f4f2ea"; ctx.lineWidth = 1.5 / s;
    for (const d of Object.values(G.zonas as Record<string, string>)) { const p2 = new Path2D(d); ctx.fill(p2); ctx.stroke(p2); }
    ctx.restore();
    ctx.fillStyle = "#7d97a0"; ctx.font = `italic 400 22px ${DISP}`; ctx.fillText("Océano Pacífico", MX + 18, MY + MH - 22);
    // otros sitios clave
    ctx.fillStyle = C.suave; ctx.globalAlpha = .45;
    for (const q of t.contexto ?? []) { const [X, Y] = P(q[1], q[0]); ctx.beginPath(); ctx.arc(tx(X), ty(Y), 5, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // ciudades visibles
    const marcas = [...t.puntos, ...(t.origen ? [t.origen] : [])].map((q) => { const [X, Y] = P(q[1], q[0]); return [tx(X), ty(Y)]; });
    ctx.font = `500 19px ${SANS}`;
    for (const [n, , la, lo] of CIUDADES) {
      const [X, Y] = P(lo, la), sx = tx(X), sy = ty(Y);
      if (!dentro(sx, sy, 24) || marcas.some(([a, b]) => Math.hypot(a - sx, b - sy) < 34)) continue;
      ctx.fillStyle = C.texto; ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, 7); ctx.fill();
      const w = ctx.measureText(n).width, der = sx + 10 + w < MX + MW - 8;
      ctx.fillStyle = "rgba(244,242,234,.85)"; ctx.fillRect(der ? sx + 8 : sx - 12 - w, sy - 14, w + 6, 22);
      ctx.fillStyle = C.texto; ctx.fillText(n, der ? sx + 11 : sx - 9 - w, sy + 3);
    }
    // ruta y paradas
    const ruta = [...(t.origen ? [P(t.origen[1], t.origen[0])] : []), ...t.puntos.map((p) => P(p[1], p[0]))];
    ctx.strokeStyle = C.foco; ctx.lineWidth = 4; ctx.setLineDash([12, 9]); ctx.beginPath();
    ruta.forEach(([x, yy], i) => (i ? ctx.lineTo(tx(x), ty(yy)) : ctx.moveTo(tx(x), ty(yy)))); ctx.stroke(); ctx.setLineDash([]);
    if (t.origen) { const [x, yy] = P(t.origen[1], t.origen[0]); ctx.fillStyle = "rgba(122,38,56,.2)"; ctx.beginPath(); ctx.arc(tx(x), ty(yy), 22, 0, 7); ctx.fill();
      ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(tx(x), ty(yy), 9, 0, 7); ctx.fill(); ctx.strokeStyle = C.sup; ctx.lineWidth = 4; ctx.stroke(); }
    t.puntos.forEach((p, i) => {
      const [x, yy] = P(p[1], p[0]); ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(tx(x), ty(yy), 20, 0, 7); ctx.fill();
      ctx.strokeStyle = C.sup; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = C.sup; ctx.font = `700 22px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(String(i + 1), tx(x), ty(yy) + 8); ctx.textAlign = "left";
    });
    // barra de escala
    const la = t.puntos[0]?.[0] ?? -33, lo = t.puntos[0]?.[1] ?? -71;
    const pxKm = Math.abs(tx(P(lo + 0.5, la)[0]) - tx(P(lo, la)[0])) / km([la, lo], [la, lo + 0.5]);
    const kmBar = [1, 2, 5, 10, 20, 50, 100, 200, 500].reduce((b, v) => (v * pxKm <= MW * 0.4 ? v : b), 1), bw = kmBar * pxKm;
    ctx.fillStyle = "rgba(244,242,234,.9)"; ctx.beginPath(); ctx.roundRect(MX + MW - bw - 40, MY + 14, bw + 26, 46, 8); ctx.fill();
    ctx.fillStyle = C.texto; ctx.fillRect(MX + MW - bw - 27, MY + 46, bw, 5);
    ctx.font = `600 17px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(`${kmBar} km`, MX + MW - bw / 2 - 27, MY + 37); ctx.textAlign = "left";
    ctx.restore();
  }

  // paradas y especies a la derecha (con miniatura de cada ave)
  const LX = MX + MW + 40, LW = W - 84 - LX; let ly = MY + 4;
  const maxY = MY + MH, numerar = t.bloques.length > 1, IND = numerar ? 50 : 0;
  t.bloques.forEach((b, i) => {
    if (ly > maxY - 100) return;
    if (numerar) {
      ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(LX + 18, ly + 14, 18, 0, 7); ctx.fill();
      ctx.fillStyle = C.sup; ctx.font = `700 20px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(String(i + 1), LX + 18, ly + 21); ctx.textAlign = "left";
    }
    ctx.fillStyle = C.texto; ctx.font = `600 29px ${DISP}`;
    const tt = envolver(ctx, b.titulo, LW - IND).slice(0, 2); tt.forEach((l, k) => ctx.fillText(l, LX + IND, ly + 24 + k * 33)); ly += tt.length * 33 + 2;
    ctx.fillStyle = C.suave; ctx.font = `400 20px ${SANS}`; ctx.fillText(b.detalle, LX + IND, ly + 14); ly += 32;
    for (const e of b.especies) {
      if (ly > maxY - 48) break;
      const R2 = 21, fx = LX + IND + R2, fy = ly + R2;
      const im = e.foto ? fotos.get(e.foto) : null;
      ctx.save(); ctx.beginPath(); ctx.arc(fx, fy, R2, 0, 7); ctx.closePath();
      if (im) { ctx.clip(); const m = Math.min(im.width, im.height); ctx.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, fx - R2, fy - R2, R2 * 2, R2 * 2); }
      else { ctx.fillStyle = C.hund; ctx.fill(); ctx.fillStyle = C.sol; ctx.font = `600 20px ${DISP}`; ctx.textAlign = "center"; ctx.fillText(e.nombre[0], fx, fy + 7); ctx.textAlign = "left"; }
      ctx.restore();
      ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, R2, 0, 7); ctx.stroke();
      ctx.fillStyle = C.texto; ctx.font = `500 23px ${SANS}`;
      const nom = envolver(ctx, e.nombre, LW - IND - 54 - 140)[0]; ctx.fillText(nom, LX + IND + 54, fy + 8);
      const bx = LX + LW - 132; ctx.fillStyle = C.hund; ctx.beginPath(); ctx.roundRect(bx, fy - 6, 84, 12, 6); ctx.fill();
      ctx.fillStyle = C.musgo; ctx.beginPath(); ctx.roundRect(bx, fy - 6, Math.max(6, 84 * e.p), 12, 6); ctx.fill();
      ctx.fillStyle = C.suave; ctx.font = `500 19px ${SANS}`; ctx.fillText(`${Math.max(1, Math.round(e.p * 10))}/10`, bx + 92, fy + 7);
      ly += 50;
    }
    ly += 16;
  });

  // pie
  ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(84, H - 140); ctx.lineTo(W - 84, H - 140); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.texto; ctx.font = `500 34px ${DISP}`; ctx.fillText("Atlas de aves en Chile", 84, H - 88);
  ctx.fillStyle = C.suave; ctx.font = `400 20px ${SANS}`; ctx.fillText(t.pie, 84, H - 58);
  ctx.fillStyle = C.suave; ctx.font = `400 18px ${SANS}`; ctx.textAlign = "right";
  ctx.fillText("x/10 = salidas con la especie · eBird 2019–2025", W - 84, H - 88); ctx.textAlign = "left";
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
