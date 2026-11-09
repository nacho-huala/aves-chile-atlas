import Image from "next/image";
import { LAMINAS } from "@/lib/laminas";

export const metadata = { title: "Datos · Atlas de aves en Chile" };

export default function PaginaDatos() {
  return (
    <main className="pagina" id="contenido">
      <p className="etiqueta etiqueta--sol" style={{ margin: "0 0 12px" }}>03 · Datos</p>
      <h1>Cinco láminas para leer las aves de Chile</h1>
      <p className="cuerpo-l" style={{ marginBottom: 32 }}>Las láminas de la entrega L2, con su lectura, su hallazgo y su limitación. Pronto, cada una será interactiva.</p>
      {LAMINAS.map((l) => (
        <section key={l.id} id={l.id} className="lamina" style={{ scrollMarginTop: 96 }}>
          <p className="etiqueta etiqueta--sol" style={{ margin: "0 0 8px" }}>{l.tipo}</p>
          <h2>{l.titulo}</h2>
          <div style={{ borderRadius: 8, overflow: "hidden", background: "#f2f0e8", margin: "16px 0" }}>
            <Image src={l.img} alt={l.alt} width={l.w} height={l.h} sizes="(max-width: 1160px) 100vw, 1100px" style={{ width: "100%", height: "auto" }} />
          </div>
          <div className="notas notas--fila">
            <div className="nota"><span className="nota__tipo">Cómo leer</span><p>{l.leer}</p></div>
            <div className="nota nota--hallazgo"><span className="nota__tipo">Hallazgo</span><p>{l.hallazgo}</p></div>
            <div className="nota"><span className="nota__tipo">Limitación</span><p>{l.limitacion}</p></div>
          </div>
          <p className="pie">Fuente: eBird Basic Dataset (EBD) Chile, relSep-2026, 2019–2025.</p>
        </section>
      ))}
    </main>
  );
}
