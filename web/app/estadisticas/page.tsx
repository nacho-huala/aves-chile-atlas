import { getMarea, getResumen } from "@/lib/data";
import { getMapa, getRasgos, getRed } from "@/lib/laminas-datos";
import { Lamina, Subnav } from "@/components/laminas/Lamina";
import { CrecimientoEbird, Marea } from "@/components/laminas/Marea";
import { MapaBivariado } from "@/components/laminas/MapaBivariado";
import { RedNavegable } from "@/components/laminas/RedNavegable";
import { Rasgos } from "@/components/laminas/Rasgos";

export const metadata = { title: "Estadísticas · Atlas de aves en Chile" };
const FUENTE = "eBird Basic Dataset (EBD) Chile, relSep-2026, 2019–2025";
const es = (n: number) => n.toLocaleString("es-CL");

export default async function PaginaEstadisticas() {
  const [r, marea, mapa, red, rasgos] = await Promise.all([getResumen(), getMarea(), getMapa(), getRed(), getRasgos()]);
  const a0 = r.anual[0], a1 = r.anual[r.anual.length - 1];
  const masRica = [...mapa.celdas].sort((a, b) => b[3] - a[3])[0];
  const masVisitada = [...mapa.celdas].sort((a, b) => b[2] - a[2])[0];
  const fuerte = [...red.aristas].sort((a, b) => b.lift - a.lift)[0];
  const nom = (sci: string) => red.nodos.find((n) => n.sci === sci)?.nombre ?? sci;
  // crecimiento de salidas = observadores × salidas por observador (en log, cuánto aporta cada factor)
  const aporteObs = Math.log(a1.observadores / a0.observadores) / Math.log(a1.salidas / a0.salidas);
  const fx = (v: number) => v.toLocaleString("es-CL", { maximumFractionDigits: 1 });
  const carnivoras = rasgos.filter((e) => e.dieta === "carnívora / pescadora").length;

  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>04 · Estadísticas</p>
        <h1>Chile visto a través de {es(r.salidas)} salidas</h1>
        <p className="cuerpo-l">Cuándo y dónde se observa, con quién aparece cada especie y qué forma tiene la avifauna del país.</p>
      </header>
      <Subnav items={[{ id: "marea", txt: "La marea" }, { id: "mapa", txt: "Dónde" }, { id: "red", txt: "Con quién" }, { id: "rasgos", txt: "Rasgos" }]} />

      <Lamina id="marea" num={7} tipo="Streamgraph" titulo={`Las salidas registradas en eBird casi se triplicaron, sobre todo porque se sumaron observadores`} fuente={`${FUENTE} · 07_marea, 00_anual`}
        bajada="Es crecimiento dentro de eBird: muestra que más personas registran sus salidas en la plataforma, no necesariamente que más gente salga a observar aves en Chile."
        leer="El grosor de cada banda son las salidas de una macrozona en ese mes; su posición vertical no tiene significado. Bajo el gráfico, cada año separa las salidas en observadores y salidas por observador."
        hallazgo={<>Las salidas pasaron de <strong>{es(a0.salidas)}</strong> a <strong>{es(a1.salidas)}</strong> (×{fx(a1.salidas / a0.salidas)}) y los observadores de {es(a0.observadores)} a {es(a1.observadores)} (×{fx(a1.observadores / a0.observadores)}). Las salidas por observador casi no cambian ({fx(a0.salidas / a0.observadores)} → {fx(a1.salidas / a1.observadores)}): cerca del <strong>{Math.round(aporteObs * 100)} %</strong> del crecimiento viene de que hay más observadores. El Austral domina los veranos; el Centro, el resto del año.</>}
        limitacion="Un observador es una cuenta de eBird con al menos una salida ese año; no distingue personas nuevas en la observación de personas que antes no usaban eBird. Las especies por salida se mantienen cerca de 9. El streamgraph dificulta comparar valores exactos.">
        <Marea filas={marea} anual={r.anual} />
        <CrecimientoEbird anual={r.anual} />
      </Lamina>

      <Lamina id="mapa" num={1} tipo="Mapa bivariado" titulo="La riqueza no siempre está donde más se observa" fuente={`${FUENTE} · 01_hex`}
        bajada="Cada celda de 0,25° cruza cuántas salidas tuvo con cuántas especies distintas se registraron."
        leer="Verde: muchas salidas. Rosado: muchas especies con pocas salidas. Café oscuro (oro en Noche): ambos altos. Bajo, medio y alto reúnen cada uno un tercio de las celdas; la leyenda muestra los rangos. Toca una celda para ver su ficha."
        hallazgo={<>La celda más rica tiene <strong>{es(masRica[3])} especies</strong> en {es(masRica[2])} salidas ({Math.abs(masRica[0]).toLocaleString("es-CL", { maximumFractionDigits: 1 })}° S); la más visitada, {es(masVisitada[3])} especies en <strong>{es(masVisitada[2])} salidas</strong>. En las celdas rosadas el nivel de especies supera al de salidas: llaman la atención, aunque comparar niveles no basta para decir que tengan más especies de lo esperable.</>}
        limitacion={`Las celdas de 0,25° no tienen igual área; ${mapa.fuera} celdas de islas oceánicas quedan fuera del encuadre. Las coordenadas de la ficha son el centro de la celda, no un acceso.`}>
        <MapaBivariado datos={mapa} />
      </Lamina>

      <Lamina id="red" num={8} tipo="Red de co-ocurrencia" titulo="Dime con quién te ven y te diré dónde vives" fuente={`${FUENTE} · 08b_red_nodos, 08b_red_aristas (build_red_ampliada.py) + hábitat AVONET`}
        bajada="Hasta 150 especies unidas cuando se anotan juntas en la misma salida más de lo que pasaría por azar. Muévete, acércate y fija una especie para ver sus compañeras."
        leer="Tamaño del círculo: % de salidas en que se registra la especie. Línea: las dos especies se registran juntas más de lo esperado por azar; más gruesa, mayor el lift. Color: el «barrio» que la red forma por sí sola, o el hábitat principal. Posición: cada barrio ocupa una zona; la distancia exacta entre círculos no se mide."
        hallazgo={<>Sin darle información de hábitat, la red se separa en cinco barrios: humedal, matorral, bosque, costa y costa austral. Entre las 40 más vistas, el par más unido es <strong>{nom(fuerte.a)}</strong> y <strong>{nom(fuerte.b)}</strong>: se registran juntas {fuerte.lift.toLocaleString("es-CL")} veces lo esperado si sus registros fueran independientes (lift ×{fuerte.lift.toLocaleString("es-CL")}).</>}
        limitacion="El lift compara dos especies entre sí: no dice que una cause la presencia de la otra ni que haya ese múltiplo de probabilidad de verla en cualquier salida. Suele indicar que comparten lugar o temporada. Se usan solo salidas completas.">
        <RedNavegable />
      </Lamina>

      <Lamina id="rasgos" num={11} tipo="Espacio de rasgos" titulo="La masa y el pico delatan la dieta" fuente="AVONET (Tobias et al. 2022) + eBird · 11_rasgos"
        bajada={`Masa contra pico relativo (culmen ÷ masa^⅓) en ${rasgos.length} especies con rasgos en AVONET.`}
        leer="Arriba: pico largo para su tamaño. Derecha: aves más pesadas. Color = dieta; tamaño = % de salidas. Clic en la leyenda para filtrar."
        hallazgo={<>Picaflores arriba a la izquierda; rapaces, pingüinos y pelícanos a la derecha. <strong>{carnivoras} especies</strong> son carnívoras o pescadoras, reflejo del peso de las aves marinas en Chile.</>}
        limitacion="Rasgos promedio por especie (AVONET), no medidos en aves de Chile; faltan especies sin equivalencia en AVONET.">
        <Rasgos especies={rasgos} />
      </Lamina>
    </main>
  );
}
