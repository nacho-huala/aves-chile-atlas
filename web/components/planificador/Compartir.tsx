"use client";
import { useEffect, useState } from "react";
import { archivoICS, descargar, dibujarTarjeta, type Tarjeta } from "@/lib/compartir";
import { Icono } from "@/components/Icono";

function proximoSabado() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/** «Llévate el plan»: imagen para redes, enlace, Google Maps, calendario y apps de mensajería. */
export function Compartir({ tarjeta, url, maps, texto, lugar }: { tarjeta: Tarjeta; url: string; maps: string | null; texto: string; lugar: string }) {
  const [img, setImg] = useState<{ blob: Blob; src: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [fecha, setFecha] = useState(proximoSabado);
  const clave = JSON.stringify(tarjeta);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => dibujarTarjeta(tarjeta).then((blob) => {
      if (!vivo) return;
      setImg((prev) => { if (prev) URL.revokeObjectURL(prev.src); return { blob, src: URL.createObjectURL(blob) }; });
    }), 350);
    return () => { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(""), 2500); };
  const archivo = img ? new File([img.blob], "mi-salida-de-aves.png", { type: "image/png" }) : null;
  const puedeArchivo = typeof navigator !== "undefined" && !!archivo && !!navigator.canShare?.({ files: [archivo] });
  const puedeCompartir = typeof navigator !== "undefined" && !!navigator.share;

  async function compartir() {
    try {
      if (puedeArchivo) await navigator.share({ files: [archivo!], title: tarjeta.titulo, text: `${texto}\n${url}` });
      else await navigator.share({ title: tarjeta.titulo, text: texto, url });
    } catch { /* la persona canceló */ }
  }
  async function copiar(t: string, m: string) {
    try { await navigator.clipboard.writeText(t); avisar(m); } catch { avisar("No se pudo copiar"); }
  }
  const enc = encodeURIComponent;

  return (
    <section className="compartir" aria-labelledby="compartir-t">
      <h3 id="compartir-t" className="titulo-icono"><span className="titulo-icono__marca" aria-hidden="true"><Icono nombre="pin" tam={20} /></span><span>Llévate el plan</span></h3>
      <div className="compartir__grid">
        <figure className="compartir__img">
          {img ? <img src={img.src} alt={`Imagen para compartir: ${tarjeta.titulo}`} /> : <div className="compartir__cargando">Preparando la imagen…</div>}
          <figcaption className="pie">Formato vertical 4:5, listo para Instagram, Facebook o WhatsApp.</figcaption>
        </figure>
        <div className="compartir__acciones">
          {puedeCompartir && <button type="button" className="btn btn--primario" onClick={compartir}><Icono nombre="ave" tam={18} />Compartir…</button>}
          <button type="button" className={`btn ${puedeCompartir ? "btn--secundario" : "btn--primario"}`} disabled={!img} onClick={() => img && descargar(img.blob, "mi-salida-de-aves.png")}>Descargar imagen</button>
          <button type="button" className="btn btn--secundario" onClick={() => copiar(url, "Enlace copiado")}>Copiar enlace al plan</button>
          <button type="button" className="btn btn--secundario" onClick={() => copiar(`${texto}\n${url}`, "Lista copiada")}>Copiar lista como texto</button>
          {maps && <a className="btn btn--secundario" href={maps} target="_blank" rel="noopener noreferrer"><Icono nombre="mapa" tam={18} />Ruta en Google Maps</a>}
          <div className="compartir__cal">
            <label>Fecha de la salida<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            <button type="button" className="btn btn--secundario" onClick={() => descargar(new Blob([archivoICS(fecha, tarjeta.titulo, lugar, texto, url)], { type: "text/calendar" }), "salida-de-aves.ics")}>
              <Icono nombre="calendario" tam={18} />Agregar al calendario
            </button>
          </div>
          <div className="compartir__redes" aria-label="Compartir en">
            <a href={`https://wa.me/?text=${enc(`${texto}\n${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a href={`https://x.com/intent/post?text=${enc(texto.split("\n")[0])}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">X</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
          </div>
          <p className="pie" role="status">{aviso || "Para Instagram: descarga la imagen o usa «Compartir…» desde el celular. El enlace guarda tu punto de partida como ciudad, no tu ubicación exacta."}</p>
        </div>
      </div>
    </section>
  );
}
