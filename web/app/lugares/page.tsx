import { getKba } from "@/lib/data";
import Lugares from "@/components/Lugares";
import { Lamina, Subnav } from "@/components/laminas/Lamina";
import { entero } from "@/lib/formato";

export const metadata = { title: "Lugares · Atlas de aves en Chile" };

export default async function PaginaLugares() {
  const k = await getKba();
  const r = k.resumen;
  const conPunto = k.sitios.filter((s) => s.punto);
  const sinProt = r.proteccion.find((p) => p.tramo === "0 %");
  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>03 · Lugares</p>
        <h1>¿Dónde conviene ir a observar?</h1>
        <p className="cuerpo-l">Chile tiene {r.sitiosTotal} Áreas Clave para la Biodiversidad (KBA). Cruzamos cada una con las salidas de eBird para decirte cuáles son las más observadas y qué aves esperar.</p>
      </header>
      <Subnav items={[{ id: "cerca", txt: "Cerca de ti" }, { id: "proteccion", txt: "Protección" }]} />

      <section id="cerca" className="vista" aria-labelledby="cerca-t">
        <p className="etiqueta etiqueta--sol vista__eti">Lugares · Sitios KBA</p>
        <h2 id="cerca-t" className="titulo-1 vista__titulo">Sitios con aves cerca de ti</h2>
        <p className="cuerpo-l vista__bajada">Hay {entero(r.sitiosConDatos)} sitios con al menos 20 salidas; {entero(conPunto.length)} tienen un punto de referencia para calcular distancias.</p>
        <Lugares sitios={k.sitios} />
        <p className="pie">{k.nota} Fuente: eBird EBD relSep-2026 (2019–2025) y KBA World Database, sep-2026.</p>
      </section>

      <Lamina id="proteccion" num={11} tipo="Tabla · Protección" titulo="¿Dónde se observa más: en sitios protegidos o no?"
        bajada="Agrupamos los sitios KBA según qué parte de su superficie está dentro de un área protegida."
        leer="Cada fila agrupa los sitios por porcentaje de superficie protegida (PA/OECM) y muestra cuántos son y qué parte de las salidas en KBA ocurre allí."
        hallazgo={sinProt ? `Los ${sinProt.sitios} sitios sin protección concentran ${sinProt.pct.toLocaleString("es-CL")} % de las salidas en KBA.` : "—"}
        limitacion="Una salida en dos KBA superpuestos se cuenta en ambos. La cobertura viene de la base KBA y no distingue el tipo de protección."
        fuente="eBird EBD relSep-2026 (2019–2025) · KBA World Database sep-2026">
        <table className="mono pequeno" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th align="left">Superficie protegida</th><th align="right">Sitios</th><th align="right">Salidas</th><th align="right">% de salidas en KBA</th></tr></thead>
          <tbody>{r.proteccion.map((p) => (
            <tr key={p.tramo}><td>{p.tramo}</td><td align="right">{entero(p.sitios)}</td><td align="right">{entero(p.salidas)}</td><td align="right">{p.pct.toLocaleString("es-CL")} %</td></tr>
          ))}</tbody>
        </table>
      </Lamina>
      <p className="pie">{k.cita}</p>
    </main>
  );
}
