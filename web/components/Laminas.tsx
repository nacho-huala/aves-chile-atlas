import Image from "next/image";
import Link from "next/link";
import { LAMINAS } from "@/lib/laminas";

export function Laminas() {
  const [grande, ...resto] = [LAMINAS[1], LAMINAS[3], LAMINAS[4], LAMINAS[0]];
  return (
    <section className="seccion" aria-labelledby="laminas-titulo">
      <div className="wrap">
        <div className="seccion__cabeza">
          <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>Explorar los datos</p>
          <h2 id="laminas-titulo" className="titulo-1">Las láminas del atlas, para leer el país con binoculares de datos</h2>
        </div>
        <div className="laminas-grid">
          <Link href={`/datos/#${grande.id}`} className="lamina-card lamina-card--grande">
            <div className="lamina-card__img"><Image src={grande.img} alt={grande.alt} width={grande.w} height={grande.h} sizes="(max-width: 900px) 100vw, 56vw" /></div>
            <div className="lamina-card__pie">
              <div><span className="etiqueta etiqueta--sol">{grande.tipo}</span><h3 className="titulo-3">{grande.titulo}: 107 aparecen en menos de 10 salidas</h3></div>
              <span className="opcion__ir" aria-hidden="true"><span className="flecha">→</span></span>
            </div>
          </Link>
          <div className="laminas-grid__lado">
            {resto.map((l) => (
              <Link key={l.id} href={`/datos/#${l.id}`} className="lamina-card lamina-card--fila">
                <div className="lamina-card__img"><Image src={l.img} alt={l.alt} width={l.w} height={l.h} sizes="200px" /></div>
                <div><span className="etiqueta etiqueta--sol">{l.tipo}</span><h3 className="titulo-3" style={{ fontSize: 19 }}>{l.titulo}</h3></div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
