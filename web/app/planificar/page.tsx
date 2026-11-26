import Link from "next/link";
import Planificador from "@/components/planificador/Planificador";
import { Icono } from "@/components/Icono";
import { Fuente } from "@/components/laminas/Lamina";

export const metadata = {
  title: "Planifica tu salida · Atlas de aves en Chile",
  description: "Sitios clave para observar aves cerca de ti y la ruta más corta para ver tu lista de especies.",
  openGraph: { title: "Planifica tu salida de observación de aves", description: "Sitios clave cercanos, qué aves esperar y la ruta para ver tu lista.", images: ["/og.png"] },
};

const AFINAR = [
  { href: "/calculadora/#a-que-hora", icono: "reloj", t: "¿A qué hora salir?", d: "Las horas en que más se sale a observar, según el mes y la zona." },
  { href: "/calculadora/#que-buscar", icono: "calendario", t: "¿Qué buscar este mes?", d: "Las especies que están en su mejor temporada ahora." },
  { href: "/calculadora/#calculadora", icono: "barras", t: "¿Cuánto tiempo salir?", d: "Cuántas especies más suma cada media hora de salida." },
  { href: "/lugares/", icono: "mapa", t: "¿Dónde más ir?", d: "El mapa de todos los sitios clave, su esfuerzo y su protección." },
];

export default function PaginaPlanificar() {
  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>02 · Planifica</p>
        <h1>Planifica tu salida</h1>
        <p className="cuerpo-l">Desde donde estás o adonde vas a viajar: los sitios clave para la biodiversidad más cercanos, qué aves se registran en cada uno y la ruta más corta para ver las especies que buscas.</p>
      </header>

      <Planificador />

      <section className="vista" aria-labelledby="afinar-t">
        <h2 id="afinar-t" className="titulo-1 vista__titulo titulo-icono">
          <span className="titulo-icono__marca" aria-hidden="true"><Icono nombre="binoculares" tam={24} /></span><span>Antes de salir, afina el plan</span>
        </h2>
        <ul className="afinar">
          {AFINAR.map((a) => (
            <li key={a.href}><Link href={a.href} className="afinar__item">
              <span className="titulo-icono__marca" aria-hidden="true"><Icono nombre={a.icono} tam={22} /></span>
              <span className="afinar__titulo">{a.t}</span>
              <span className="afinar__texto">{a.d}</span>
            </Link></li>
          ))}
        </ul>
        <Fuente>eBird Basic Dataset relSep-2026, Chile 2019–2025 · sitios: KBA World Database sep-2026 (solo como filtro; el punto de cada sitio sale de eBird)</Fuente>
      </section>
    </main>
  );
}
