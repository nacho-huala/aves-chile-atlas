import { getMarea, getResumen } from "@/lib/data";
import { getMapa, getRasgos, getRed } from "@/lib/laminas-datos";
import { Lamina, Subnav } from "@/components/laminas/Lamina";
import { Marea } from "@/components/laminas/Marea";
import { MapaBivariado } from "@/components/laminas/MapaBivariado";
import { Red } from "@/components/laminas/Red";
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
  const carnivoras = rasgos.filter((e) => e.dieta === "carnívora / pescadora").length;

  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>03 · Estadísticas</p>
        <h1>Chile visto a través de {es(r.salidas)} salidas</h1>
        <p className="cuerpo-l">Cuándo y dónde se observa, con quién aparece cada especie y qué forma tiene la avifauna del país.</p>
      </header>
      <Subnav items={[{ id: "marea", txt: "La marea" }, { id: "mapa", txt: "Dónde" }, { id: "red", txt: "Con quién" }, { id: "rasgos", txt: "Rasgos" }]} />

      <Lamina id="marea" num={7} tipo="Streamgraph" titulo={`Las salidas casi se triplicaron entre ${a0.anio} y ${a1.anio}`} fuente={`${FUENTE} · 07_marea, 00_anual`}
        leer="El grosor de cada banda son las salidas de una macrozona en ese mes; su posición vertical no tiene significado. Bajo cada año, las salidas del año."
        hallazgo={<>Las salidas pasaron de <strong>{es(a0.salidas)}</strong> a <strong>{es(a1.salidas)}</strong> (×{(a1.salidas / a0.salidas).toLocaleString("es-CL", { maximumFractionDigits: 1 })}) y los observadores de {es(a0.observadores)} a {es(a1.observadores)}. El Austral domina los veranos; el Centro, el resto del año.</>}
        limitacion="Las especies por salida se mantienen cerca de 9: más salidas reflejan más observación, no más aves. El streamgraph dificulta comparar valores exactos.">
        <Marea filas={marea} anual={r.anual} />
      </Lamina>

      <Lamina id="mapa" num={1} tipo="Mapa bivariado" titulo="La riqueza no siempre está donde más se observa" fuente={`${FUENTE} · 01_hex`}
        bajada="Cada celda de 0,25° cruza cuántas salidas tuvo con cuántas especies distintas se registraron."
        leer="Verde: muchas salidas. Rosado: muchas especies con pocas salidas. Café oscuro (oro en Noche): ambos altos. Clases por terciles."
        hallazgo={<>La celda más rica tiene <strong>{es(masRica[3])} especies</strong> en {es(masRica[2])} salidas ({Math.abs(masRica[0]).toLocaleString("es-CL", { maximumFractionDigits: 1 })}° S); la más visitada, {es(masVisitada[3])} especies en <strong>{es(masVisitada[2])} salidas</strong>. Las celdas rosadas tienen más especies de lo que su esfuerzo haría esperar: lugares por explorar.</>}
        limitacion={`Las celdas de 0,25° no tienen igual área; ${mapa.fuera} celdas de islas oceánicas quedan fuera del encuadre.`}>
        <MapaBivariado datos={mapa} />
      </Lamina>

      <Lamina id="red" num={8} tipo="Red de co-ocurrencia" titulo="Las especies se agrupan en dos mundos: agua y tierra" fuente={`${FUENTE} · 08_nodos, 08_aristas + hábitat AVONET`}
        bajada={`Las ${red.nodos.length} especies más avistadas, unidas si comparten salidas completas más de lo esperado (lift ≥ 2: ${red.aristas.length} vínculos).`}
        leer="Nodo = especie (tamaño = % de salidas); línea = se ven juntas; grosor = lift. Color = hábitat principal (AVONET)."
        hallazgo={<>El par más fuerte: <strong>{nom(fuerte.a)}</strong> y <strong>{nom(fuerte.b)}</strong> (×{fuerte.lift.toLocaleString("es-CL")}). Louvain separa dos comunidades: agua (humedal y costa) y tierra.</>}
        limitacion="La posición en el plano no tiene escala: solo importan las conexiones. Lift = P(A∩B) / P(A)·P(B), en salidas completas.">
        <Red datos={red} />
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
