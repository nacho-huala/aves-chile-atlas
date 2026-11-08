import Link from "next/link";
import { getEspecies, getFicha } from "@/lib/data";
import { entero, MESES_LARGOS, pct, UICN, unoDeCada } from "@/lib/formato";
import Fenologia from "@/components/Fenologia";

// Una página HTML por especie, generada al compilar.
export async function generateStaticParams() {
  return (await getEspecies()).map((e) => ({ slug: e.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const f = await getFicha((await params).slug);
  return { title: `${f.nombre} · Aves en Chile` };
}

export default async function FichaEspecie({ params }: Props) {
  const f = await getFicha((await params).slug);
  return (
    <main>
      <p className="pequeno"><Link href="/especies/">← Especies</Link></p>
      <div className="ficha-cabecera">
        <figure style={{ margin: 0 }}>
          {f.imagen.url ? <img src={f.imagen.url} alt={f.nombre} /> : null}
          {f.imagen.credito && <figcaption className="pie">Foto: {f.imagen.credito} · vía iNaturalist</figcaption>}
        </figure>
        <div>
          <h1>{f.nombre}</h1>
          <p className="apoyo"><em>{f.sci}</em> · {f.nombreIngles}</p>
          <p style={{ fontSize: "1.2rem" }}>Se registra <strong>{unoDeCada(f.pct)}</strong> en Chile.</p>
          <p>{f.estatus && <span className="etiqueta-estatus">{f.estatus}</span>}{" "}
            {f.uicn && <span className="etiqueta-estatus">UICN: {UICN[f.uicn] ?? f.uicn}</span>}</p>
          <dl className="datos">
            <dt>Salidas con la especie</dt><dd className="mono">{entero(f.salidas)} ({pct(f.pct, 2)})</dd>
            {f.mejorMes && <><dt>Mejor mes</dt><dd>{MESES_LARGOS[f.mejorMes - 1]}</dd></>}
            {f.macrozona && <><dt>Zona con más registros</dt><dd>{f.macrozona}</dd></>}
            {f.observadores && <><dt>Observadores</dt><dd className="mono">{entero(f.observadores)}</dd></>}
            {f.rasgos.masaG && <><dt>Masa</dt><dd className="mono">{entero(f.rasgos.masaG)} g</dd></>}
            {f.rasgos.habitat && <><dt>Hábitat · dieta</dt><dd>{f.rasgos.habitat} · {f.rasgos.dieta}</dd></>}
          </dl>
          {f.canto && (
            <div style={{ marginTop: "1rem" }}>
              <audio controls preload="none" src={f.canto.audio} />
              <p className="pie">Canto ({f.canto.tipo}): {f.canto.autor} · {f.canto.licencia?.replace(/^\/\//, "")} ·{" "}
                {f.canto.url && <a href={f.canto.url}>xeno-canto</a>}</p>
            </div>
          )}
        </div>
      </div>

      {f.fenologia && (
        <section className="lamina">
          <h2>¿Cuándo buscarla?</h2>
          <Fenologia valores={f.fenologia} mejorMes={f.mejorMes} />
          <p className="pie">% de salidas completas de cada mes en que se registró · eBird Chile 2019–2025</p>
        </section>
      )}

      <p className="pequeno">
        {[["eBird", f.enlaces.ebird], ["iNaturalist", f.enlaces.inaturalist], ["Wikipedia", f.enlaces.wikipedia]]
          .filter(([, u]) => u).map(([n, u], i) => <span key={n}>{i > 0 && " · "}<a href={u!}>{n}</a></span>)}
      </p>
    </main>
  );
}
