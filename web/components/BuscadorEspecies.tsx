"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { EspecieIndice } from "@/lib/data";
import { unoDeCada } from "@/lib/formato";

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const PASO = 24;
const UICN_GRUPOS: Record<string, string[]> = { amenazada: ["VU", "EN", "CR"], NT: ["NT"], LC: ["LC"], otra: ["DD"] };

/** Catálogo: muestra de a 24 especies; los filtros reinician la paginación. */
export default function BuscadorEspecies({ especies }: { especies: EspecieIndice[] }) {
  const [q, setQ] = useState("");
  const [estatus, setEstatus] = useState("");
  const [nid, setNid] = useState("");
  const [uicn, setUicn] = useState("");
  const [orden, setOrden] = useState("frecuencia");
  const [n, setN] = useState(PASO);
  const cambia = <T,>(f: (v: T) => void) => (v: T) => { f(v); setN(PASO); };

  const lista = useMemo(() => {
    const t = sinTildes(q.trim());
    const l = especies.filter((e) => (!estatus || e.estatus === estatus) &&
      (!nid || (nid === "si") === !!e.nidifica) &&
      (!uicn || (uicn === "sin" ? !e.uicn : UICN_GRUPOS[uicn].includes(e.uicn ?? ""))) &&
      (!t || sinTildes(e.nombre).includes(t) || sinTildes(e.sci).includes(t)));
    return orden === "nombre" ? [...l].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      : orden === "rara" ? [...l].sort((a, b) => a.pct - b.pct) : l;
  }, [especies, q, estatus, nid, uicn, orden]);
  const visibles = lista.slice(0, n);

  return (
    <>
      <div className="controles">
        <label>Buscar
          <input type="search" placeholder="Chincol, Turdus…" value={q} onChange={(e) => cambia(setQ)(e.target.value)} />
        </label>
        <label>Estatus
          <select value={estatus} onChange={(e) => cambia(setEstatus)(e.target.value)}>
            <option value="">Todas</option>
            <option>nativa residente</option><option>migratoria / estacional</option>
            <option>endémica</option><option>introducida</option>
          </select>
        </label>
        <label>Nidifica en Chile
          <select value={nid} onChange={(e) => cambia(setNid)(e.target.value)}>
            <option value="">Indistinto</option><option value="si">Sí (atlas 2011–2016)</option><option value="no">No registrada</option>
          </select>
        </label>
        <label>Categoría UICN
          <select value={uicn} onChange={(e) => cambia(setUicn)(e.target.value)}>
            <option value="">Todas</option><option value="amenazada">Amenazadas (VU, EN, CR)</option>
            <option value="NT">Casi amenazada</option><option value="LC">Preocupación menor</option>
            <option value="otra">Datos insuficientes</option><option value="sin">Sin evaluación</option>
          </select>
        </label>
        <label>Ordenar
          <select value={orden} onChange={(e) => cambia(setOrden)(e.target.value)}>
            <option value="frecuencia">Más vistas primero</option><option value="rara">Más raras primero</option><option value="nombre">Alfabético</option>
          </select>
        </label>
      </div>
      <p className="apoyo pequeno" role="status">Mostrando {visibles.length} de {lista.length} especies</p>
      <ul className="grilla-especies">
        {visibles.map((e) => (
          <li key={e.slug}>
            <Link className="tarjeta" href={`/especies/${e.slug}/`}>
              {e.foto ? <img src={e.foto} alt="" loading="lazy" /> : <span className="sin-foto" />}
              <span>
                <span className="n">{e.nombre}</span><br />
                <span className="apoyo pequeno">{unoDeCada(e.pct)}</span>
                {(e.nidifica || ["VU", "EN", "CR"].includes(e.uicn ?? "")) && (
                  <span className="tarjeta__marcas">
                    {e.nidifica && <span className="marca-mini marca-mini--nido" title="Nidifica en Chile">nidifica</span>}
                    {["VU", "EN", "CR"].includes(e.uicn ?? "") && <span className="marca-mini marca-mini--uicn" title="Categoría UICN">{e.uicn}</span>}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {lista.length > PASO && (
        <div className="catalogo__mas">
          {n < lista.length && <button type="button" className="btn btn--secundario" onClick={() => setN(n + PASO)}>Mostrar {Math.min(PASO, lista.length - n)} más</button>}
          {n < lista.length && <button type="button" className="btn btn--secundario" onClick={() => setN(lista.length)}>Ver las {lista.length}</button>}
          {n > PASO && <button type="button" className="btn btn--secundario" onClick={() => { setN(PASO); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}>Ver menos</button>}
        </div>
      )}
    </>
  );
}
