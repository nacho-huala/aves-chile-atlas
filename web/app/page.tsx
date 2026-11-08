import Link from "next/link";
import { getResumen } from "@/lib/data";
import { entero } from "@/lib/formato";
import BarrasAnuales from "@/components/BarrasAnuales";

export default async function Inicio() {
  const r = await getResumen();
  const a0 = r.anual[0], a1 = r.anual[r.anual.length - 1];
  const kpis = [
    [entero(r.salidas), "salidas de observación"],
    [entero(r.avistamientos), "avistamientos"],
    [entero(r.especies), "especies"],
    [entero(r.observadores), "observadores"],
  ];
  return (
    <main>
      <p className="apoyo mono pequeno">eBird Chile · {a0.anio}–{a1.anio}</p>
      <h1>Si salgo a mirar aves, ¿qué voy a ver?</h1>
      <p style={{ maxWidth: "62ch" }}>
        Un atlas construido con {entero(r.avistamientosCrudos)} registros de ciencia ciudadana. Contamos{" "}
        <strong>salidas</strong>, no registros: así la pregunta «si salgo, ¿la veo?» tiene respuesta.
      </p>

      <section className="lamina">
        <div className="kpis">
          {kpis.map(([v, e]) => (
            <div className="kpi" key={e}><div className="valor">{v}</div><div className="etiqueta">{e}</div></div>
          ))}
        </div>
      </section>

      <section className="lamina">
        <h2>La marea de salidas</h2>
        <p className="apoyo">
          Las salidas pasaron de {entero(a0.salidas)} a {entero(a1.salidas)} (×{(a1.salidas / a0.salidas).toLocaleString("es-CL", { maximumFractionDigits: 1 })}),
          pero las especies por salida se mantienen cerca de {Math.round(a1.especiesPorSalida)}: más registros no significa más aves.
        </p>
        <BarrasAnuales datos={r.anual} />
        <p className="pie">Fuente: {r.fuente} · {r.desde} a {r.hasta}</p>
      </section>

      <section className="dos-col">
        <Link className="lamina" href="/calculadora/" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>Tu salida →</h2>
          <p className="apoyo">Elige zona y duración: cuántas especies esperar y cuáles son más probables.</p>
        </Link>
        <Link className="lamina" href="/especies/" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>Especies →</h2>
          <p className="apoyo">{r.especies} fichas con foto, canto y el mes en que es más fácil verlas.</p>
        </Link>
      </section>
    </main>
  );
}
