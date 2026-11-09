import Link from "next/link";

export function PieSitio() {
  return (
    <footer className="pie-sitio">
      <div className="wrap">
        <div className="pie-sitio__grid">
          <div>
            <Link href="/" className="pie-sitio__logo" aria-label="Atlas de aves en Chile, inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo-dia" src="/brand/logo-dia.svg" alt="" width={316} height={96} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo-noche" src="/brand/logo-noche.svg" alt="" width={316} height={96} />
            </Link>
            <p className="cuerpo-s" style={{ maxWidth: 380, marginTop: 16 }}>Grupo 05 · Visualización de Datos y Storytelling, Magíster en Data Science, Universidad del Desarrollo.</p>
          </div>
          <div><h2 className="etiqueta etiqueta--sol">Guía</h2><ul><li><Link href="/especies/">Especies</Link></li><li><Link href="/calculadora/">Tu salida</Link></li><li><Link href="/datos/">Datos</Link></li></ul></div>
          <div><h2 className="etiqueta etiqueta--sol">Fuentes</h2><ul><li><a href="https://ebird.org/data/download">eBird (EBD)</a></li><li><a href="https://www.wikidata.org">Wikidata</a></li><li><a href="https://www.inaturalist.org">iNaturalist</a></li><li><a href="https://xeno-canto.org">xeno-canto</a></li></ul></div>
          <div><h2 className="etiqueta etiqueta--sol">Equipo</h2><ul className="cuerpo-s"><li>Victoria Albornoz</li><li>Matías Gebauer</li><li>Luciano Hernández</li><li>Manuel Huala</li><li>Betzabeth Torres</li></ul></div>
        </div>
        <div className="pie-sitio__base cuerpo-s">
          <span>Datos: eBird Basic Dataset relSep-2026, Cornell Lab of Ornithology. Foto del chincol: © Esteban Poveda, CC BY, vía iNaturalist. Mapa: BCN.</span>
          <span>IA como apoyo, no como fuente de cifras.</span>
        </div>
      </div>
    </footer>
  );
}
