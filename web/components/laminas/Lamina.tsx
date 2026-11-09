// Marco común de cada lámina: sobretítulo, título-hallazgo, la vista y las tres notas.
export function Lamina({ id, num, tipo, titulo, bajada, leer, hallazgo, limitacion, fuente, children }: {
  id: string; num: number; tipo: string; titulo: string; bajada?: string;
  leer: React.ReactNode; hallazgo: React.ReactNode; limitacion: React.ReactNode; fuente: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="vista" aria-labelledby={`${id}-t`}>
      <p className="etiqueta etiqueta--sol vista__eti">Lámina {num} · {tipo}</p>
      <h2 id={`${id}-t`} className="titulo-1 vista__titulo">{titulo}</h2>
      {bajada && <p className="cuerpo-l vista__bajada">{bajada}</p>}
      <div className="vista__lienzo">{children}</div>
      <div className="notas notas--fila">
        <div className="nota"><span className="nota__tipo">Cómo leer</span><p>{leer}</p></div>
        <div className="nota nota--hallazgo"><span className="nota__tipo">Hallazgo</span><p>{hallazgo}</p></div>
        <div className="nota"><span className="nota__tipo">Limitación</span><p>{limitacion}</p></div>
      </div>
      <p className="pie">Fuente: {fuente}</p>
    </section>
  );
}

/** Subnavegación de una pestaña: anclas a cada lámina. */
export function Subnav({ items }: { items: { id: string; txt: string }[] }) {
  return (
    <nav className="subnav" aria-label="En esta página">
      <ul>{items.map((i) => <li key={i.id}><a href={`#${i.id}`}>{i.txt}</a></li>)}</ul>
    </nav>
  );
}
