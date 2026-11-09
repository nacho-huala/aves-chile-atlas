import { Contador } from "./Contador";
import type { Resumen } from "@/lib/data";

export function Unidades({ r }: { r: Resumen }) {
  const es = (n: number) => n.toLocaleString("es-CL");
  return (
    <section className="seccion" aria-labelledby="unidades-titulo">
      <div className="wrap unidades">
        <div>
          <p className="etiqueta etiqueta--sol" style={{ margin: "0 0 16px" }}>Qué contamos</p>
          <h2 id="unidades-titulo" className="titulo-1">Contamos salidas, no registros</h2>
          <dl className="unidades__def">
            <div><dt>Salida</dt><dd>Una persona o grupo observando en un lugar y un tiempo. Si la lista se compartió, cuenta una sola vez.</dd></div>
            <div><dt>Avistamiento</dt><dd>Una especie dentro de una salida: diez chincoles en la misma salida son un avistamiento.</dd></div>
            <div><dt>% de salidas</dt><dd>Salidas en que se vio la especie ÷ total de salidas. Así «si salgo, ¿la veo?» tiene respuesta.</dd></div>
          </dl>
        </div>
        <div className="cifras">
          <div className="cifra cifra--grande">
            <span className="cifra__valor num"><Contador valor={r.avistamientosCrudos} /></span>
            <span className="cifra__nombre">registros de eBird en Chile entre {r.desde.slice(0, 4)} y {r.hasta.slice(0, 4)}</span>
          </div>
          <div className="cifra"><span className="cifra__valor num"><Contador valor={r.salidas} /></span><span className="cifra__nombre">salidas, desde {es(r.listasEbird)} listas</span></div>
          <div className="cifra"><span className="cifra__valor num"><Contador valor={r.avistamientos} /></span><span className="cifra__nombre">avistamientos</span></div>
          <div className="cifra"><span className="cifra__valor num"><Contador valor={r.especies} /></span><span className="cifra__nombre">especies</span></div>
          <div className="cifra"><span className="cifra__valor num"><Contador valor={r.observadores} /></span><span className="cifra__nombre">observadores en {es(r.localidades)} localidades</span></div>
        </div>
      </div>
    </section>
  );
}
