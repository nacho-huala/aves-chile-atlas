import { getEspecies, getResumen } from "@/lib/data";
import { getZonas } from "@/lib/zonas";
import { unoDeCada } from "@/lib/formato";
import { Hero } from "@/components/Hero";
import { Unidades } from "@/components/Unidades";
import { Salidas } from "@/components/Salidas";
import { MapaMacrozonas } from "@/components/MapaMacrozonas";
import { Laminas } from "@/components/Laminas";
import { Cierre } from "@/components/Cierre";

// Foto del hero: el chincol (iNaturalist, © Esteban Poveda, CC BY). Se cambia aquí.
const HERO_SLUG = "zonotrichia-capensis";
const HERO_FOTO = "https://inaturalist-open-data.s3.amazonaws.com/photos/112061150/large.jpeg";

export default async function Inicio() {
  const [r, especies, zonas] = await Promise.all([getResumen(), getEspecies(), getZonas()]);
  const ave = especies.find((e) => e.slug === HERO_SLUG)!;
  return (
    <main className="inicio" id="contenido">
      <Hero
        especies={r.especies}
        salidas={r.salidas}
        desde={Number(r.desde.slice(0, 4))}
        hasta={Number(r.hasta.slice(0, 4))}
        destacada={{ nombre: ave.nombre, sci: ave.sci, frase: `Aparece ${unoDeCada(ave.pct)}`, foto: HERO_FOTO, href: `/especies/${ave.slug}/` }}
      />
      <Unidades r={r} />
      <Salidas anual={r.anual} fuente={r.fuente} />
      <section className="seccion" aria-labelledby="mapa-titulo" id="lugar">
        <div className="wrap">
          <div className="seccion__cabeza">
            <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>Lugar de avistamiento</p>
            <h2 id="mapa-titulo" className="titulo-1">Elige una macrozona y te decimos qué aves esperar</h2>
            <p className="cuerpo-l">Las mismas cinco zonas del análisis, de Arica a Punta Arenas. Al elegir una, planeas tu salida con datos reales de esa zona.</p>
          </div>
          <MapaMacrozonas zonas={zonas} />
        </div>
      </section>
      <Laminas />
      <Cierre />
    </main>
  );
}
