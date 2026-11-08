import { getCalculadora } from "@/lib/data";
import Calculadora from "@/components/Calculadora";

export const metadata = { title: "Tu salida · Aves en Chile" };

export default async function PaginaCalculadora() {
  const datos = await getCalculadora(); // se lee al compilar y viaja como props al componente interactivo
  return (
    <main>
      <h1>Si salgo a observar, ¿cuántas especies veré?</h1>
      <p className="apoyo" style={{ maxWidth: "62ch" }}>
        Con salidas reales de eBird de la misma zona y duración: cuántas especies se registran (mediana y rango
        de la mitad central) y qué especies aparecen en más salidas.
      </p>
      <Calculadora datos={datos} />
    </main>
  );
}
