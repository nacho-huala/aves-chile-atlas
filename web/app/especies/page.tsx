import { getEspecies } from "@/lib/data";
import BuscadorEspecies from "@/components/BuscadorEspecies";

export const metadata = { title: "Especies · Aves en Chile" };

export default async function PaginaEspecies() {
  const especies = await getEspecies();
  return (
    <main>
      <h1>Especies</h1>
      <p className="apoyo">{especies.length} especies registradas en eBird Chile 2019–2025, de la más a la menos frecuente.</p>
      <BuscadorEspecies especies={especies} />
    </main>
  );
}
