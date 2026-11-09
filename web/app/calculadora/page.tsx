import { getCalculadora } from "@/lib/data";
import { getZonas } from "@/lib/zonas";
import Calculadora from "@/components/Calculadora";

export const metadata = { title: "Tu salida · Atlas de aves en Chile" };

export default async function PaginaCalculadora() {
  const [datos, zonas] = await Promise.all([getCalculadora(), getZonas()]); // se leen al compilar y viajan como props
  return (
    <main className="pagina" id="contenido">
      <p className="etiqueta etiqueta--sol" style={{ margin: "0 0 12px" }}>02 · Lugar</p>
      <h1>Si salgo a observar, ¿cuántas especies veré?</h1>
      <p className="apoyo" style={{ maxWidth: "62ch" }}>
        Elige la zona en el mapa y la duración: con salidas reales de eBird de esa zona y duración, cuántas especies se
        registran (mediana y rango de la mitad central) y qué especies aparecen en más salidas.
      </p>
      <Calculadora datos={datos} zonas={zonas} />
    </main>
  );
}
