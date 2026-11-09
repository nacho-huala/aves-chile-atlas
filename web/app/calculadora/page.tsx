import { getCalculadora } from "@/lib/data";
import { getZonas } from "@/lib/zonas";
import { getReloj, getRueda } from "@/lib/laminas-datos";
import Calculadora from "@/components/Calculadora";
import { Lamina, Subnav } from "@/components/laminas/Lamina";
import { Rueda } from "@/components/laminas/Rueda";
import { Reloj } from "@/components/laminas/Reloj";

export const metadata = { title: "Tu salida · Atlas de aves en Chile" };
const FUENTE = "eBird Basic Dataset (EBD) Chile, relSep-2026, 2019–2025";

export default async function PaginaCalculadora() {
  const [datos, zonas, rueda, reloj] = await Promise.all([getCalculadora(), getZonas(), getRueda(), getReloj()]);
  const pTarde = (m: number) => { const f = reloj.reloj.local.Chile[m]; const t = f.reduce((a, b) => a + b, 0); return (f.slice(18).reduce((a, b) => a + b, 0) / t) * 100; };
  const fmt = (v: number) => v.toLocaleString("es-CL", { maximumFractionDigits: 1 });
  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>02 · Lugar · Tu salida</p>
        <h1>Si salgo a observar, ¿qué voy a ver?</h1>
        <p className="cuerpo-l">Elige dónde, cuánto rato, en qué mes y a qué hora. Todo con salidas reales de eBird.</p>
      </header>
      <Subnav items={[{ id: "calculadora", txt: "Dónde y cuánto" }, { id: "que-buscar", txt: "Qué buscar este mes" }, { id: "a-que-hora", txt: "A qué hora" }]} />

      <section id="calculadora" className="vista" aria-labelledby="calc-t">
        <p className="etiqueta etiqueta--sol vista__eti">Lámina 6 · Calculadora de salida</p>
        <h2 id="calc-t" className="titulo-1 vista__titulo">¿Cuántas especies veré en mi zona?</h2>
        <p className="cuerpo-l vista__bajada">Elige la zona en el mapa y la duración: cuántas especies se registran (mediana y rango de la mitad central) y cuáles aparecen en más salidas.</p>
        <Calculadora datos={datos} zonas={zonas} />
      </section>

      <Lamina id="que-buscar" num={3} tipo="Rueda fenológica" titulo="Qué ave buscar en cada mes" fuente={`${FUENTE} · 03_fenologia`}
        leer="Un anillo por especie (las más comunes al centro), un sector por mes con enero arriba. Más oscuro (más claro en Noche) = aparece en más salidas completas."
        hallazgo={<>Zorzal, Tiuque y Chincol superan el 24 % de las salidas todo el año; el <strong>Fío-fío</strong> pasa de casi nada en julio a 1 de cada 3 salidas en enero. Run-run, Gaviota de Franklin y Viudita marcan las tres temporadas de migrantes.</>}
        limitacion="% de salidas completas de todo Chile: una especie común en una sola zona aparece diluida.">
        <Rueda especies={rueda} />
      </Lamina>

      <Lamina id="a-que-hora" num={4} tipo="Reloj polar hora × mes" titulo="La jornada de observación dura lo que dura la luz" fuente={`${FUENTE} · 04_reloj, 04_sol (amanecer y atardecer, NOAA)`}
        leer="Cada anillo es un mes (enero afuera) y cada sector una hora de inicio. El color muestra qué parte de las salidas del mes empieza a esa hora."
        hallazgo={<>En junio solo el <strong>{fmt(pTarde(5))} %</strong> de las salidas parte después de las 18 h; en enero, el <strong>{fmt(pTarde(0))} %</strong>. En hora solar desaparece el salto del cambio de hora y aparece el pico de la mañana.</>}
        limitacion="Hora de inicio declarada en eBird, sin las salidas «Historical». La hora solar solo está calculada para todo Chile.">
        <Reloj datos={reloj} />
      </Lamina>
    </main>
  );
}
