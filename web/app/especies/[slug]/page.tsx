import Link from "next/link";
import { getEspecies, getFicha } from "@/lib/data";
import { entero, MESES_LARGOS, pct, UICN, unoDeCada } from "@/lib/formato";
import { autorFoto, DIETA_ES, HABITAT_ES, licenciaCorta, UICN_ESCALA, urlLicencia } from "@/lib/ficha";
import Fenologia from "@/components/Fenologia";
import PerfilAltitud from "@/components/PerfilAltitud";
import { Icono, TituloIcono } from "@/components/Icono";
import { Fuente } from "@/components/laminas/Lamina";
import { OlaGrafico } from "@/components/laminas/Ola";

// Una página HTML por especie, generada al compilar.
export async function generateStaticParams() {
  return (await getEspecies()).map((e) => ({ slug: e.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const f = await getFicha((await params).slug);
  return { title: `${f.nombre} · Aves en Chile` };
}

const ESTATUS_CLASE: Record<string, string> = {
  "nativa residente": "musgo", "migratoria / estacional": "mar", "endémica": "vino", "introducida": "ocre",
};

/** Escala UICN de verde a rojo con la categoría de la especie marcada. */
function EscalaUicn({ cat }: { cat: string }) {
  const i = UICN_ESCALA.indexOf(cat as (typeof UICN_ESCALA)[number]);
  return (
    <div className="uicn" aria-label={`Categoría UICN: ${UICN[cat] ?? cat}`}>
      <div className="uicn__cab"><span className="uicn__eti">Estado de conservación (UICN)</span><b className={`uicn__nombre uicn--${cat.toLowerCase()}`}>{UICN[cat] ?? cat}</b></div>
      {i >= 0 ? (
        <ol className="uicn__escala" aria-hidden="true">
          {UICN_ESCALA.map((c, k) => <li key={c} className={`uicn--${c.toLowerCase()}`} data-on={k === i}>{c}</li>)}
        </ol>
      ) : <p className="pie" style={{ margin: 0 }}>Sin datos suficientes para evaluar su riesgo.</p>}
    </div>
  );
}

export default async function FichaEspecie({ params }: Props) {
  const f = await getFicha((await params).slug);
  const datos: { icono: string; eti: string; valor: React.ReactNode; nota?: string }[] = [
    { icono: "binoculares", eti: "Salidas con la especie", valor: entero(f.salidas), nota: pct(f.pct, 2) + " del total" },
    ...(f.mejorMes ? [{ icono: "calendario", eti: "Mejor mes", valor: MESES_LARGOS[f.mejorMes - 1] }] : []),
    ...(f.macrozona ? [{ icono: "pin", eti: "Zona con más registros", valor: f.macrozona }] : []),
    ...(f.observadores ? [{ icono: "ojo", eti: "Observadores", valor: entero(f.observadores) }] : []),
    ...(f.rasgos.masaG ? [{ icono: "ave", eti: "Masa", valor: `${entero(f.rasgos.masaG)} g` }] : []),
    ...(f.rasgos.habitat ? [{ icono: "montana", eti: "Hábitat · dieta", valor: HABITAT_ES[f.rasgos.habitat] ?? f.rasgos.habitat,
      nota: f.rasgos.dieta ? DIETA_ES[f.rasgos.dieta] ?? f.rasgos.dieta : undefined }] : []),
  ];
  const lic = licenciaCorta(f.canto?.licencia), licUrl = urlLicencia(f.canto?.licencia);
  const licFoto = licenciaCorta(f.imagen.licencia), licFotoUrl = urlLicencia(f.imagen.licencia);

  return (
    <main className="pagina" id="contenido">
      <Link href="/especies/" className="btn-volver"><Icono nombre="flecha" tam={18} />Volver a especies</Link>
      <div className="ficha-cabecera">
        <figure className="ficha-foto">
          {f.imagen.url ? <img src={f.imagen.url} alt={f.nombre} /> : <div className="ficha-foto__vacia"><Icono nombre="ave" tam={64} /></div>}
          {f.imagen.credito && (
            <figcaption className="credito">
              <Icono nombre="ojo" tam={14} />
              <span>Foto: <b>{autorFoto(f.imagen.credito)}</b>{licFoto && <> · {licFotoUrl ? <a href={licFotoUrl}>{licFoto}</a> : licFoto}</>} · vía {f.imagen.fuente ?? "iNaturalist"}</span>
            </figcaption>
          )}
        </figure>

        <div className="ficha-info">
          <h1>{f.nombre}</h1>
          <p className="ficha-sci"><em>{f.sci}</em> · {f.nombreIngles}</p>
          <p className="ficha-frase">Se registra <strong>{unoDeCada(f.pct)}</strong> en Chile.</p>

          <div className="insignias">
            {f.estatus && <span className={`insignia insignia--${ESTATUS_CLASE[f.estatus] ?? "musgo"}`}><i aria-hidden="true" />{f.estatus}</span>}
            {f.endemica && f.estatus !== "endémica" && <span className="insignia insignia--vino"><i aria-hidden="true" />endémica</span>}
            {f.nidificacion && <span className="insignia insignia--sol" title="Con registro de nidificación en el atlas 2011–2016"><Icono nombre="nido" tam={14} />nidifica en Chile</span>}
          </div>
          {f.uicn && <EscalaUicn cat={f.uicn} />}

          <dl className="ficha-datos">
            {datos.map((d) => (
              <div key={d.eti} className="ficha-dato">
                <dt><Icono nombre={d.icono} tam={15} />{d.eti}</dt>
                <dd>{d.valor}{d.nota && <small>{d.nota}</small>}</dd>
              </div>
            ))}
          </dl>

          {f.canto && (
            <div className="ficha-canto">
              <div className="ficha-canto__cab"><Icono nombre="canto" tam={18} /><b>Escúchala</b>{f.canto.tipo && <span className="apoyo">· {f.canto.tipo}</span>}</div>
              <audio controls preload="none" src={f.canto.audio} />
              <p className="credito">
                Grabación de <b>{f.canto.autor}</b>{lic && <> · {licUrl ? <a href={licUrl}>{lic}</a> : lic}</>}
                {f.canto.url && <> · <a href={f.canto.url}>ver en xeno-canto</a></>}
              </p>
            </div>
          )}
        </div>
      </div>

      {(f.fenologia || f.nidificacion?.resumen) && (
        <section className="lamina">
          <TituloIcono icono="calendario">{f.nidificacion?.meses.length ? "¿Cuándo buscarla y cuándo nidifica?" : "¿Cuándo buscarla?"}</TituloIcono>
          {f.fenologia && <Fenologia valores={f.fenologia} mejorMes={f.mejorMes} nidificacion={f.nidificacion?.meses} />}
          {/* dos lecturas distintas, cada una con su fuente */}
          <ul className="cal-claves">
            {f.fenologia && <li><i className="cal-claves__barra" aria-hidden="true" /><span><b>Barras: cuándo se registra más.</b> % de salidas completas de cada mes con la especie (eBird Chile, 2019–2025). El mes más alto va en otro color.</span></li>}
            {f.nidificacion?.meses.length
              ? <li><i className="cal-claves__nido" aria-hidden="true" /><span><b>Franja dorada: cuándo nidifica.</b> Meses de nidificación según Medrano et al. (2018), atlas de 2011–2016. Puede incluir el cuidado de polluelos.</span></li>
              : f.nidificacion
                ? <li><i className="cal-claves__sin" aria-hidden="true" /><span><b>Nidifica en Chile, sin meses precisos.</b> El atlas 2011–2016 registra su nidificación, pero su ficha no permite fijar los meses con seguridad.</span></li>
                : <li><i className="cal-claves__sin" aria-hidden="true" /><span><b>Sin registro de nidificación en el atlas.</b> El atlas 2011–2016 no encontró evidencia de que nidifique en Chile; eso no prueba que no lo haga.</span></li>}
          </ul>
          {f.nidificacion?.resumen && (
            <div className={f.nidificacion.altitud ? "nido-grid" : undefined} style={{ marginTop: "var(--esp-5)" }}>
              <div>
                <p className="dato-eti" style={{ marginTop: 0 }}><Icono nombre="nido" tam={14} /> Sobre su nidificación</p>
                <p className="cuerpo-l" style={{ marginTop: 0 }}>{f.nidificacion.resumen}</p>
                {!f.fenologia && f.nidificacion.meses.length > 0 && (
                  <ol className="meses-nido" aria-label="Meses de nidificación">
                    {MESES_LARGOS.map((m, i) => <li key={m} data-on={f.nidificacion!.meses.includes(i + 1)} title={m}>{m.slice(0, 3)}</li>)}
                  </ol>
                )}
                {f.nidificacion.revisar && <p className="aviso"><Icono nombre="alerta" tam={16} />Información reproductiva incompleta o por confirmar en el atlas.</p>}
              </div>
              {f.nidificacion.altitud && (
                <figure className="nido-perfil">
                  <p className="dato-eti">Altitud de nidificación</p>
                  <PerfilAltitud min={f.nidificacion.altitud[0]} max={f.nidificacion.altitud[1]} />
                  <figcaption className="pie">Franja dorada: entre {entero(f.nidificacion.altitud[0])} y {entero(f.nidificacion.altitud[1])} m s. n. m., sobre un perfil esquemático de la costa a los Andes.</figcaption>
                </figure>
              )}
            </div>
          )}
          <Fuente>{f.fenologia ? "Registros: eBird Chile 2019–2025. " : ""}{f.nidificacion?.meses.length || f.nidificacion?.resumen ? <>Nidificación: resumen propio a partir de Medrano et al. (2018), <em>Atlas de las aves nidificantes de Chile</em>, ROC (datos 2011–2016, período distinto al de eBird).</> : null}</Fuente>
        </section>
      )}

      {f.kba.length > 0 && (
        <section className="lamina">
          <TituloIcono icono="pin">¿Dónde verla? Sitios clave</TituloIcono>
          <p className="apoyo" style={{ marginTop: 0 }}>Áreas Clave para la Biodiversidad donde aparece en más salidas completas (mínimo 10 salidas con la especie).</p>
          <ul className="kba-aves">
            {f.kba.map((k) => (
              <li key={k.id}>
                <Link href="/lugares/">{k.nombre}{k.region ? <span className="apoyo"> · {k.region}</span> : null}</Link>
                <span className="kba-aves__barra" aria-hidden="true"><i style={{ width: `${k.p}%` }} /></span>
                <span className="mono pequeno">{Math.round(k.p)} %</span>
              </li>
            ))}
          </ul>
          <Link className="btn btn--primario" href={`/planificar/?especie=${f.slug}`} style={{ marginTop: 16 }}><Icono nombre="pin" tam={18} />Planifica cómo verla</Link>
          <Fuente>% de salidas completas del sitio con la especie · eBird 2019–2025 · KBA World Database sep-2026 · <Link href="/lugares/">Ver el mapa de sitios</Link></Fuente>
        </section>
      )}

      {f.ola && f.ola.bandas.length > 2 && (
        <section className="lamina">
          <TituloIcono icono="ola">¿Dónde, mes a mes?</TituloIcono>
          <OlaGrafico ola={f.ola} nombre={f.nombre} />
          <Fuente>% de salidas completas por franja de 0,5° de latitud (mín. 40 salidas) · eBird Chile 2019–2025 · <a href="/especies/#ola">Más sobre la ola</a></Fuente>
        </section>
      )}

      <nav className="ficha-enlaces" aria-label="Más sobre esta especie">
        {[["eBird", f.enlaces.ebird], ["iNaturalist", f.enlaces.inaturalist], ["Wikipedia", f.enlaces.wikipedia]]
          .filter(([, u]) => u).map(([n, u]) => <a key={n} className="btn btn--secundario" href={u!}>{n} <span aria-hidden="true">↗</span></a>)}
      </nav>
    </main>
  );
}
