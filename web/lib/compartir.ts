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
  bloques: { titulo: string; detalle: string; especies: { nombre: string; p: number }[] }[];
  pie: string;
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
  ctx.fillStyle = C.texto; ctx.font = `500 62px ${DISP}`;
  const tl = envolver(ctx, t.titulo, W - 168).slice(0, 2); tl.forEach((l, i) => ctx.fillText(l, 84, 182 + i * 68));
  let y = 182 + tl.length * 68 - 10;
  ctx.fillStyle = C.suave; ctx.font = `400 28px ${SANS}`; envolver(ctx, t.subtitulo, W - 168).slice(0, 2).forEach((l) => { ctx.fillText(l, 84, y + 12); y += 38; });
  y += 24;

  // mapa a la izquierda (encuadre en las paradas)
  const MX = 84, MY = y, MW = 300, MH = H - y - 170;
  ctx.fillStyle = C.fondo; ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.fill();
  const P = proyectar("vertical"), G = geo.vertical;
  const pts = [...t.puntos, ...(t.origen ? [t.origen] : [])].map((p) => P(p[1], p[0]));
  if (pts.length) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minimo = pts.length <= 2 ? 90 : 24; // con un solo sitio, dejar costa y cordillera de contexto
    let vh = Math.max(Math.max(...ys) - Math.min(...ys), minimo) * 1.5, vw = Math.max(Math.max(...xs) - Math.min(...xs) + 16, 12);
    if (vw / vh > MW / MH) vh = vw * MH / MW; else vw = vh * MW / MH;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, s = MW / vw;
    const tx = (x: number) => MX + (x - (cx - vw / 2)) * s, ty = (yy: number) => MY + (yy - (cy - vh / 2)) * s;
    ctx.save(); ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.clip();
    ctx.translate(MX - (cx - vw / 2) * s, MY - (cy - vh / 2) * s); ctx.scale(s, s);
    ctx.fillStyle = C.tierra; ctx.strokeStyle = C.sup; ctx.lineWidth = 1 / s;
    for (const d of Object.values(G.zonas as Record<string, string>)) { const p2 = new Path2D(d); ctx.fill(p2); ctx.stroke(p2); }
    ctx.restore(); ctx.save(); ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 18); ctx.clip();
    const ruta = [...(t.origen ? [P(t.origen[1], t.origen[0])] : []), ...t.puntos.map((p) => P(p[1], p[0]))];
    ctx.strokeStyle = C.foco; ctx.lineWidth = 4; ctx.setLineDash([12, 9]); ctx.beginPath();
    ruta.forEach(([x, yy], i) => (i ? ctx.lineTo(tx(x), ty(yy)) : ctx.moveTo(tx(x), ty(yy)))); ctx.stroke(); ctx.setLineDash([]);
    if (t.origen) { const [x, yy] = P(t.origen[1], t.origen[0]); ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(tx(x), ty(yy), 10, 0, 7); ctx.fill(); ctx.strokeStyle = C.sup; ctx.lineWidth = 4; ctx.stroke(); }
    t.puntos.forEach((p, i) => {
      const [x, yy] = P(p[1], p[0]); ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(tx(x), ty(yy), 20, 0, 7); ctx.fill();
      ctx.strokeStyle = C.sup; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = C.sup; ctx.font = `700 22px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(String(i + 1), tx(x), ty(yy) + 8); ctx.textAlign = "left";
    });
    ctx.restore();
  }

  // paradas y especies a la derecha
  const LX = MX + MW + 44, LW = W - 84 - LX; let ly = MY + 8;
  const maxY = MY + MH;
  t.bloques.forEach((b, i) => {
    if (ly > maxY - 90) return;
    if (t.bloques.length > 1) {
      ctx.fillStyle = C.foco; ctx.beginPath(); ctx.arc(LX + 18, ly + 14, 18, 0, 7); ctx.fill();
      ctx.fillStyle = C.sup; ctx.font = `700 20px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(String(i + 1), LX + 18, ly + 21); ctx.textAlign = "left";
    }
    ctx.fillStyle = C.texto; ctx.font = `600 30px ${DISP}`;
    const tt = envolver(ctx, b.titulo, LW - 52).slice(0, 2); tt.forEach((l, k) => ctx.fillText(l, LX + 52, ly + 24 + k * 34)); ly += tt.length * 34 + 4;
    ctx.fillStyle = C.suave; ctx.font = `400 21px ${SANS}`; ctx.fillText(b.detalle, LX + 52, ly + 16); ly += 34;
    for (const e of b.especies) {
      if (ly > maxY - 30) break;
      ctx.fillStyle = C.texto; ctx.font = `500 23px ${SANS}`;
      const nom = envolver(ctx, e.nombre, LW - 52 - 150)[0]; ctx.fillText(nom, LX + 52, ly + 18);
      const bx = LX + LW - 140; ctx.fillStyle = C.hund; ctx.beginPath(); ctx.roundRect(bx, ly + 5, 90, 12, 6); ctx.fill();
      ctx.fillStyle = C.musgo; ctx.beginPath(); ctx.roundRect(bx, ly + 5, Math.max(6, 90 * e.p), 12, 6); ctx.fill();
      ctx.fillStyle = C.suave; ctx.font = `500 19px ${SANS}`; ctx.fillText(`${Math.max(1, Math.round(e.p * 10))}/10`, bx + 100, ly + 18);
      ly += 34;
    }
    ly += 18;
  });

  // pie
  ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(84, H - 140); ctx.lineTo(W - 84, H - 140); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.texto; ctx.font = `500 34px ${DISP}`; ctx.fillText("Atlas de aves en Chile", 84, H - 88);
  ctx.fillStyle = C.suave; ctx.font = `400 20px ${SANS}`; ctx.fillText(t.pie, 84, H - 58);
  ctx.fillStyle = C.suave; ctx.font = `400 18px ${SANS}`; ctx.textAlign = "right";
  ctx.fillText("x/10 = salidas con la especie · eBird 2019–2025", W - 84, H - 88); ctx.textAlign = "left";
  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
