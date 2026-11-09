import Link from "next/link";

export function Cierre() {
  return (
    <section className="cierre" aria-labelledby="cierre-titulo">
      <div className="wrap">
        <p className="etiqueta etiqueta--sol" style={{ margin: "0 0 20px" }}>Binoculares listos</p>
        <h2 id="cierre-titulo" className="cierre__h">Sal a buscar<br />tu próxima especie.</h2>
        <div className="cierre__acciones">
          <Link className="btn btn--primario" href="/especies/">Ver el catálogo <span className="flecha" aria-hidden="true">→</span></Link>
          <Link className="btn btn--secundario" href="/calculadora/">Planear mi salida</Link>
          <Link className="btn btn--secundario" href="/datos/">Explorar los gráficos</Link>
        </div>
      </div>
    </section>
  );
}
