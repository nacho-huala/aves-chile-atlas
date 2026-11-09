import { getEspecies, getResumen } from "@/lib/data";
import { getEspeciesLamina, getOido, getOla } from "@/lib/laminas-datos";
import BuscadorEspecies from "@/components/BuscadorEspecies";
import { Lamina, Subnav } from "@/components/laminas/Lamina";
import { Enjambre, Riesgo } from "@/components/laminas/Enjambre";
import { Oido } from "@/components/laminas/Oido";
import { OlaSelector } from "@/components/laminas/Ola";

export const metadata = { title: "Especies · Atlas de aves en Chile" };
const FUENTE = "eBird Basic Dataset (EBD) Chile, relSep-2026, 2019–2025";
const es = (n: number) => n.toLocaleString("es-CL");

export default async function PaginaEspecies() {
  const [especies, r, lam, oido, ola] = await Promise.all([getEspecies(), getResumen(), getEspeciesLamina(), getOido(), getOla()]);
  const amenazadas = lam.filter((e) => ["VU", "EN", "CR"].includes(e.uicn ?? ""));
  const invisibles = amenazadas.filter((e) => e.pct < 0.1).length;
  const visible = [...amenazadas].sort((a, b) => b.pct - a.pct)[0];
  const top = [...oido.especies].sort((a, b) => b.veces - a.veces).slice(0, 4).map((e) => e.nombre);
  const raras = lam.filter((e) => Math.round((e.pct * r.salidas) / 100) < 10).length;

  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>01 · Especie</p>
        <h1>{es(especies.length)} especies, de lo cotidiano a lo casi imposible</h1>
        <p className="cuerpo-l">Busca una por nombre o recórrelas por rareza, amenaza, canto y temporada.</p>
      </header>
      <Subnav items={[{ id: "catalogo", txt: "Catálogo" }, { id: "rareza", txt: "Rareza" }, { id: "amenazadas", txt: "Amenazadas" }, { id: "cantos", txt: "Cantos" }, { id: "ola", txt: "Temporadas" }]} />

      <section id="catalogo" className="vista" aria-label="Catálogo de especies">
        <BuscadorEspecies especies={especies} />
      </section>

      <Lamina id="rareza" num={5} tipo="Enjambre de rareza" titulo="La mayoría de las especies se ve muy pocas veces" fuente={`${FUENTE} + iNaturalist + AVONET · 05b`}
        leer="Cada punto es una especie según el % de salidas en que aparece (escala log); el tamaño es el número de observadores. Clic en la leyenda para filtrar por estatus."
        hallazgo={<><strong>{raras} especies</strong> se vieron en menos de 10 salidas. Zorzal patagónico, Tiuque y Chincol aparecen en 1 de cada 3.</>}
        limitacion="El estatus (nativa, migratoria, endémica, introducida) combina fuentes globales y estacionalidad en Chile: es un aproximado.">
        <Enjambre especies={lam} salidas={r.salidas} />
      </Lamina>

      <Lamina id="amenazadas" num={9} tipo="Riesgo vs. visibilidad" titulo="Las amenazadas que casi nadie ve" fuente={`UICN vía Wikidata + ${FUENTE} · 10_riesgo`}
        leer="Una fila por categoría UICN; cada punto es una especie según el % de salidas en que aparece (escala log)."
        hallazgo={<>De {amenazadas.length} especies amenazadas (VU, EN, CR), <strong>{invisibles}</strong> aparecen en menos de 1 de cada 1.000 salidas, muchas de ellas marinas. La más visible: <strong>{visible.nombre}</strong> ({visible.uicn}).</>}
        limitacion="Categoría UICN global (Wikidata), sin tendencia poblacional ni la clasificación nacional (RCE). 42 especies sin categoría.">
        <Riesgo especies={lam} />
      </Lamina>

      <Lamina id="cantos" num={10} tipo="Oído vs. vista" titulo="Las que se escuchan más de lo que se ven" fuente="xeno-canto (grabaciones en Chile) + eBird · 12_sonidos"
        bajada={`Grabaciones en xeno-canto contra % de salidas en ${oido.n} especies con audio. Haz clic en un punto para escuchar.`}
        leer="Regresión log–log: la línea punteada es lo esperado. Sobre ella, especies que se graban más de lo que se ven."
        hallazgo={<><strong>{top.join(", ")}</strong> se graban varias veces más de lo esperado. Muchas de las que están sobre la línea son aves de sotobosque y matorral: se oyen mucho y se ven poco.</>}
        limitacion="Las grabaciones dependen de quién graba y dónde; xeno-canto no es una muestra al azar. Licencias CC por grabación.">
        <Oido datos={oido} />
      </Lamina>

      <Lamina id="ola" num={2} tipo="Ridgeline latitudinal" titulo="La ola: las migratorias recorren Chile mes a mes" fuente={`${FUENTE} · 02_ridge`}
        bajada="Cada cresta es un mes: % de salidas completas con la especie por franja de 0,5° de latitud, de Arica (izquierda) a Magallanes."
        leer="Más alta la cresta, más fácil verla en esa latitud y ese mes. Elige otra especie arriba; cada ficha trae su propia ola."
        hallazgo={<>El <strong>Fío-fío</strong> llega en primavera, cubre el centro-sur en verano y desaparece en invierno. La <strong>Viudita</strong> y el <strong>Picaflor chico</strong> hacen lo contrario: bajan al centro en invierno.</>}
        limitacion="Franjas de 0,5° con un mínimo de 40 salidas completas; donde hay pocas salidas la cresta se corta.">
        <OlaSelector especies={ola} />
      </Lamina>
    </main>
  );
}
