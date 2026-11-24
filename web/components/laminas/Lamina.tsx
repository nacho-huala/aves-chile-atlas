import { Icono, iconoDeTipo } from "@/components/Icono";

/** Línea de fuente: etiqueta + texto en la tipografía de cuerpo, separada del contenido. */
export function Fuente({ children, etiqueta = "Fuente" }: { children: React.ReactNode; etiqueta?: string }) {
  return (
    <p className="fuente">
      <span className="fuente__eti"><Icono nombre="libro" tam={14} />{etiqueta}</span>
      <span className="fuente__txt">{children}</span>
    </p>
  );
}

// Marco común de cada lámina: sobretítulo, título-hallazgo con ícono, la vista y las tres notas.
export function Lamina({ id, num, tipo, titulo, bajada, leer, hallazgo, limitacion, fuente, icono, children }: {
  id: string; num: number; tipo: string; titulo: string; bajada?: string; icono?: string;
  leer: React.ReactNode; hallazgo: React.ReactNode; limitacion: React.ReactNode; fuente: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="vista" aria-labelledby={`${id}-t`}>
      <p className="etiqueta etiqueta--sol vista__eti">Lámina {num} · {tipo}</p>
      <h2 id={`${id}-t`} className="titulo-1 vista__titulo titulo-icono">
        <span className="titulo-icono__marca" aria-hidden="true"><Icono nombre={icono ?? iconoDeTipo(tipo)} tam={24} /></span>
        <span>{titulo}</span>
      </h2>
      {bajada && <p className="cuerpo-l vista__bajada">{bajada}</p>}
      <div className="vista__lienzo">{children}</div>
      <Notas leer={leer} hallazgo={hallazgo} limitacion={limitacion} />
      <Fuente>{fuente}</Fuente>
    </section>
  );
}

export function Notas({ leer, hallazgo, limitacion }: { leer: React.ReactNode; hallazgo: React.ReactNode; limitacion: React.ReactNode }) {
  return (
    <div className="notas notas--fila">
      <div className="nota"><span className="nota__tipo"><Icono nombre="ojo" tam={13} />Cómo leer</span><p>{leer}</p></div>
      <div className="nota nota--hallazgo"><span className="nota__tipo"><Icono nombre="binoculares" tam={13} />Hallazgo</span><p>{hallazgo}</p></div>
      <div className="nota"><span className="nota__tipo"><Icono nombre="alerta" tam={13} />Limitación</span><p>{limitacion}</p></div>
    </div>
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
