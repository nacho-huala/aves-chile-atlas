import { getEspecies, getResumen, getUicn } from "@/lib/data";
import { getEspeciesLamina, getNidificacion, getOido, getOla } from "@/lib/laminas-datos";
import { AltitudNidificacion, CalendarioNidificacion } from "@/components/laminas/Nidificacion";
import { TendenciaUicn } from "@/components/laminas/Apiladas";
import BuscadorEspecies from "@/components/BuscadorEspecies";
import { Fuente, Lamina, Subnav } from "@/components/laminas/Lamina";
import { Enjambre, Riesgo } from "@/components/laminas/Enjambre";
import { Oido } from "@/components/laminas/Oido";
import { OlaSelector } from "@/components/laminas/Ola";

export const metadata = { title: "Especies · Atlas de aves en Chile" };
const FUENTE = "eBird Basic Dataset (EBD) Chile, relSep-2026, 2019–2025";
const es = (n: number) => n.toLocaleString("es-CL");

export default async function PaginaEspecies() {
  const [especies, r, lam, oido, ola, uicn, nid] = await Promise.all([getEspecies(), getResumen(), getEspeciesLamina(), getOido(), getOla(), getUicn(), getNidificacion()]);
  const conAlt = nid.especies.filter((e) => e.alt && e.alt[1] > e.alt[0]);
  const altas = conAlt.filter((e) => e.alt![1] >= 4000).length;
  const masAlta = [...conAlt].sort((a, b) => b.alt![1] - a.alt![1])[0];
  const mesesNid = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const mesMax = nid.porMes.indexOf(Math.max(...nid.porMes)), mesMin = nid.porMes.indexOf(Math.min(...nid.porMes));
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
      <Subnav items={[{ id: "catalogo", txt: "Catálogo" }, { id: "rareza", txt: "Rareza" }, { id: "amenazadas", txt: "Amenazadas" }, { id: "cantos", txt: "Cantos" }, { id: "ola", txt: "Temporadas" }, { id: "nidificacion", txt: "Nidificación" }, { id: "altitud", txt: "Altitud" }]} />

      <section id="catalogo" className="vista" aria-label="Catálogo de especies">
        <BuscadorEspecies especies={especies} />
      </section>

      <Lamina id="rareza" num={5} tipo="Enjambre de rareza" titulo="La mayoría de las especies se registra muy pocas veces" fuente={`${FUENTE} + iNaturalist + AVONET · 05b`}
        leer="Cada punto es una especie según el % de salidas en que aparece (escala log); el tamaño es el número de observadores. Clic en la leyenda para filtrar por estatus."
        hallazgo={<><strong>{raras} especies</strong> se vieron en menos de 10 salidas. Zorzal patagónico, Tiuque y Chincol aparecen en 1 de cada 3.</>}
        limitacion="Poco registrada no es lo mismo que rara en la naturaleza: influyen dónde se observa y cuán fácil es detectarla. El origen y la presencia (nativa, migratoria, endémica, introducida) combinan fuentes globales y estacionalidad en Chile: son un aproximado.">
        <Enjambre especies={lam} salidas={r.salidas} />
      </Lamina>

      <Lamina id="amenazadas" num={9} tipo="Riesgo vs. visibilidad" titulo="Las amenazadas que casi nadie ve" fuente={`UICN Red List (categorías) + Wikidata + ${FUENTE} · 10_riesgo · 14_uicn_agregado`}
        leer="Una fila por categoría UICN; cada punto es una especie según el % de salidas en que aparece (escala log)."
        hallazgo={<>De {amenazadas.length} especies amenazadas (VU, EN, CR), <strong>{invisibles}</strong> aparecen en menos de 1 de cada 1.000 salidas, muchas de ellas marinas. La más visible: <strong>{visible.nombre}</strong> ({visible.uicn}).</>}
        limitacion="Categoría UICN global, sin la clasificación nacional (RCE). La tendencia poblacional se muestra solo como total por categoría, por los términos de uso de UICN. 11 especies sin categoría.">
        <Riesgo especies={lam} />
        <h3 style={{ marginTop: "2.5rem" }}>Tendencia poblacional según UICN, por categoría</h3>
        <TendenciaUicn uicn={uicn} />
        <Fuente etiqueta="Cita UICN">{uicn.cita}</Fuente>
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

      <Lamina id="nidificacion" num={14} tipo="Calendario · Nidificación" titulo="Lo más visto no coincide con la temporada de nidos"
        bajada="Meses en que cada especie nidifica según el atlas (2011–2016), frente a cuándo se registra más en eBird (2019–2025)."
        fuente={`Medrano et al. (2018), Atlas de las aves nidificantes de Chile + ${FUENTE} · 15_nidificacion`}
        leer="Arriba, cuántas especies nidifican cada mes. Abajo, una fila por especie: la celda más oscura es su mes con más registros en eBird y la línea dorada marca los meses de nidificación."
        hallazgo={<>La nidificación se concentra en {mesesNid[mesMax]} ({nid.porMes[mesMax]} especies) y cae en {mesesNid[mesMin]} ({nid.porMes[mesMin]}). En {nid.cruce.coincide} de {nid.cruce.n} especies ({Math.round((100 * nid.cruce.coincide) / nid.cruce.n)} %) el mes más registrado cae dentro de su temporada de nidos; por azar se esperaría {String(nid.cruce.azar).replace(".", ",")} %.</>}
        limitacion="Los meses salen del texto del atlas y pueden incluir cuidado de polluelos; 60 fichas por revisar no se incluyen. Atlas y eBird cubren períodos distintos.">
        <CalendarioNidificacion datos={nid} />
      </Lamina>

      <Lamina id="altitud" num={15} tipo="Rangos · Altitud de nidificación" titulo="De la playa al altiplano: dónde ponen sus nidos"
        bajada="Rango de altitud en que nidifica cada especie según el atlas, ordenado de las que anidan más bajo a las que anidan más alto."
        fuente="Medrano et al. (2018), Atlas de las aves nidificantes de Chile · 15_nidificacion"
        leer="Cada barra vertical es una especie: va desde la altitud mínima a la máxima en que nidifica. Clic en la leyenda para filtrar por estatus; clic en una barra para abrir su ficha."
        hallazgo={<>{altas} de {conAlt.length} especies nidifican sobre los 4.000 m; la que llega más alto es <strong>{masAlta?.nombre}</strong> ({masAlta?.alt?.[1].toLocaleString("es-CL")} m).</>}
        limitacion="El rango resume los registros del atlas 2011–2016; especies con pocos nidos pueden tener rangos más estrechos que los reales.">
        <AltitudNidificacion datos={nid} />
      </Lamina>
    </main>
  );
}
