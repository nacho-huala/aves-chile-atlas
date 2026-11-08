"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { EspecieIndice } from "@/lib/data";
import { unoDeCada } from "@/lib/formato";

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function BuscadorEspecies({ especies }: { especies: EspecieIndice[] }) {
  const [q, setQ] = useState("");
  const [estatus, setEstatus] = useState("");
  const lista = useMemo(() => {
    const t = sinTildes(q.trim());
    return especies.filter((e) => (!estatus || e.estatus === estatus) &&
      (!t || sinTildes(e.nombre).includes(t) || sinTildes(e.sci).includes(t)));
  }, [especies, q, estatus]);

  return (
    <>
      <div className="controles">
        <label>Buscar
          <input type="search" placeholder="Chincol, Turdus…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>Estatus
          <select value={estatus} onChange={(e) => setEstatus(e.target.value)}>
            <option value="">Todas</option>
            <option>nativa residente</option><option>migratoria / estacional</option>
            <option>endémica</option><option>introducida</option>
          </select>
        </label>
        <span className="apoyo pequeno">{lista.length} especies</span>
      </div>
      <ul className="grilla-especies">
        {lista.map((e) => (
          <li key={e.slug}>
            <Link className="tarjeta" href={`/especies/${e.slug}/`}>
              {e.foto ? <img src={e.foto} alt="" loading="lazy" /> : <span className="sin-foto" />}
              <span>
                <span className="n">{e.nombre}</span><br />
                <span className="apoyo pequeno">{unoDeCada(e.pct)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
