"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { KbaSitio } from "@/lib/data";
import { MESES, entero } from "@/lib/formato";

const MACROZONAS = ["Norte Grande", "Norte Chico", "Centro", "Sur", "Austral"];

function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const mesPico = (s: KbaSitio) => s.meses.indexOf(Math.max(...s.meses));

export default function Lugares({ sitios }: { sitios: KbaSitio[] }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [estado, setEstado] = useState<"" | "buscando" | "error">("");
  const [zona, setZona] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);

  function ubicar() {
    if (!navigator.geolocation) { setEstado("error"); return; }
    setEstado("buscando");
    // La ubicación se usa solo en tu navegador para ordenar la lista; no se envía a ningún servidor.
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos([p.coords.latitude, p.coords.longitude]); setEstado(""); },
      () => setEstado("error"), { timeout: 10000 });
  }

  const lista = useMemo(() => {
    let l = sitios.map((s) => ({ s, d: pos && s.punto ? km(pos, s.punto) : null }));
    if (pos) {
      const con = l.filter((x) => x.d !== null).sort((a, b) => a.d! - b.d!);
      return con.slice(0, 8);
    }
    if (zona) l = l.filter((x) => x.s.macrozona === zona);
    return l.slice(0, 8); // ya vienen ordenados por salidas
  }, [sitios, pos, zona]);

  return (
    <div>
      <div className="controles">
        <button type="button" className="btn btn--primario" onClick={ubicar}>Usar mi ubicación</button>
        <label>…o elige una macrozona
          <select value={zona} onChange={(e) => { setZona(e.target.value); setPos(null); }}>
            <option value="">Todo Chile</option>
            {MACROZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        {pos && <button type="button" className="btn btn--secundario" onClick={() => setPos(null)}>Quitar ubicación</button>}
      </div>
      <p className="pie" role="status">
        {estado === "buscando" && "Buscando tu ubicación…"}
        {estado === "error" && "No pudimos obtener tu ubicación. Elige una macrozona."}
        {!estado && pos && "Ordenado por cercanía a ti. Tu ubicación no sale de tu navegador. Solo entran sitios con punto publicable."}
        {!estado && !pos && "Ordenado por salidas registradas."}
      </p>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
        {lista.map(({ s, d }) => {
          const pico = mesPico(s), ab = abierto === s.id;
          return (
            <li key={s.id} className="panel">
              <h3 style={{ margin: 0 }}>{s.nombre}</h3>
              <p className="apoyo" style={{ margin: ".2rem 0 .6rem" }}>
                {[s.region, d !== null ? `a ${entero(Math.round(d))} km` : null].filter(Boolean).join(" · ")}
              </p>
              <p style={{ margin: 0 }}>
                <strong>{entero(s.especies)}</strong> especies en {entero(s.salidas)} salidas · mejor mes: <strong>{MESES[pico]}</strong>
                {s.nGatillo ? ` · ${s.gatilloVistas}/${s.nGatillo} aves que justifican el sitio, vistas` : ""}
              </p>
              <button type="button" className="btn btn--secundario" style={{ marginTop: ".8rem" }} aria-expanded={ab}
                onClick={() => setAbierto(ab ? null : s.id)}>{ab ? "Ocultar aves" : "Qué puedes encontrar"}</button>
              {ab && (
                <ul style={{ listStyle: "none", padding: 0, marginTop: ".8rem", display: "grid", gap: ".4rem", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
                  {s.top.slice(0, 12).map((e) => (
                    <li key={e.slug}><Link href={`/especies/${e.slug}/`}>{e.nombre}</Link>
                      <span className="mono pequeno"> · {e.p !== null ? `${Math.round(e.p)} % de salidas` : `${e.salidas} salidas`}</span></li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
