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
  { href: "/calculadora/#a-que-hora", icono: "reloj", t: "¿A qué hora salir?", d: "Cuándo se concentran las salidas en cada mes y zona." },
  { href: "/calculadora/#que-buscar", icono: "rueda", t: "¿Qué buscar este mes?", d: "Las especies que tienen su temporada ahora." },
  { href: "/calculadora/#calculadora", icono: "reloj", t: "¿Cuánto rato?", d: "Cuántas especies suma cada media hora de salida." },
  { href: "/lugares/", icono: "mapa", t: "Explorar todos los sitios", d: "El mapa completo de sitios clave, su esfuerzo y su protección." },
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
              <span><b>{a.t}</b><span className="apoyo">{a.d}</span></span>
              <span className="flecha" aria-hidden="true">→</span>
            </Link></li>
          ))}
        </ul>
        <Fuente>eBird Basic Dataset relSep-2026, Chile 2019–2025 · sitios: KBA World Database sep-2026 (solo como filtro; el punto de cada sitio sale de eBird)</Fuente>
      </section>
    </main>
  );
}
