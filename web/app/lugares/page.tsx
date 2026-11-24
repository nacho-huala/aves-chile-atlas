import { getKba } from "@/lib/data";
import Lugares from "@/components/Lugares";
import { Fuente, Lamina, Notas, Subnav } from "@/components/laminas/Lamina";
import { Icono } from "@/components/Icono";
import { KbaDispersion } from "@/components/laminas/KbaDispersion";
import { ProteccionKba } from "@/components/laminas/Apiladas";
import { entero } from "@/lib/formato";

export const metadata = { title: "Lugares · Atlas de aves en Chile" };
const FUENTE = "eBird EBD relSep-2026 (2019–2025) · KBA World Database sep-2026 · 13_kba_sitios";

export default async function PaginaLugares() {
  const k = await getKba();
  const r = k.resumen, s = k.sitios;
  const sinProt = r.proteccion.find((p) => p.tramo === "0 %");
  const totalProt = r.proteccion.find((p) => p.tramo === "100 %");
  const parcial = r.proteccion.find((p) => p.tramo === "1–50 %");
  const totS = r.proteccion.reduce((a, p) => a + p.sitios, 0);
  // sitio con más especies por encima de lo esperable (ajuste log-lineal, igual que en la lámina)
  const xs = s.map((x) => Math.log10(x.salidas)), mx = xs.reduce((a, b) => a + b) / s.length, my = s.reduce((a, x) => a + x.especies, 0) / s.length;
  const b = xs.reduce((a, v, i) => a + (v - mx) * (s[i].especies - my), 0) / xs.reduce((a, v) => a + (v - mx) ** 2, 0);
  const res = s.map((x, i) => ({ x, d: x.especies - (my + b * (xs[i] - mx)) })).sort((p, q) => q.d - p.d);
  const gat = s.filter((x) => x.nGatillo), vistas = gat.reduce((a, x) => a + (x.gatilloVistas ?? 0), 0), totG = gat.reduce((a, x) => a + (x.nGatillo ?? 0), 0);

  return (
    <main className="pagina" id="contenido">
      <header className="pestana__cabeza">
        <p className="etiqueta etiqueta--sol" style={{ margin: 0 }}>03 · Lugares</p>
        <h1>¿Dónde conviene ir a observar?</h1>
        <p className="cuerpo-l">Chile tiene {r.sitiosTotal} Áreas Clave para la Biodiversidad (KBA). Cruzamos cada una con las salidas de eBird para mostrarte dónde están, qué aves esperar y en qué mes ir.</p>
      </header>
      <Subnav items={[{ id: "cerca", txt: "Mapa de sitios" }, { id: "explorar", txt: "Por explorar" }, { id: "proteccion", txt: "Protección" }]} />

      <section id="cerca" className="vista" aria-labelledby="cerca-t">
        <p className="etiqueta etiqueta--sol vista__eti">Lámina 11 · Mapa de sitios KBA</p>
        <h2 id="cerca-t" className="titulo-1 vista__titulo titulo-icono"><span className="titulo-icono__marca" aria-hidden="true"><Icono nombre="mapa" tam={24} /></span><span>Sitios clave con aves, cerca de ti</span></h2>
        <p className="cuerpo-l vista__bajada">{entero(r.sitiosConDatos)} sitios tienen al menos 20 salidas; {entero(r.puntosPublicables)} tienen punto en el mapa. En los sitios con aves clave (las que justifican el KBA), se registraron {entero(vistas)} de {entero(totG)}.</p>
        <div className="vista__lienzo"><Lugares sitios={s} /></div>
        <Notas
          leer="Cada círculo es un sitio KBA: su tamaño son las salidas de eBird dentro del sitio y su color la macrozona. Al elegir uno se ven sus cifras, sus meses y sus aves más frecuentes."
          hallazgo={<>El sitio más observado es <strong>{s[0].nombre}</strong>, con {entero(s[0].salidas)} salidas y {s[0].especies} especies.</>}
          limitacion="El punto no es el centro ni el límite del KBA: es la celda de ~1 km con más salidas dentro del sitio, y solo se muestra si hay 2 localidades y 20 salidas. Los límites oficiales no se publican aquí." />
        <Fuente>{FUENTE}</Fuente>
      </section>

      <Lamina id="explorar" num={12} tipo="Dispersión · Esfuerzo y riqueza" titulo="Sitios con más especies de las que su esfuerzo hace esperar"
        bajada="Cada punto es un sitio KBA. La línea punteada marca cuántas especies se esperan según sus salidas."
        leer="Eje horizontal: salidas dentro del sitio (log). Vertical: especies registradas. Sobre la línea, el sitio rinde más de lo esperable para su esfuerzo; los cinco con mayor diferencia van rotulados."
        hallazgo={<><strong>{res[0].x.nombre}</strong> registra {res[0].x.especies} especies en {entero(res[0].x.salidas)} salidas: unas {Math.round(res[0].d)} más de lo esperable. Son buenos candidatos para visitar.</>}
        limitacion="Las especies acumuladas dependen del tamaño y la diversidad de hábitats del sitio, que aquí no se controlan."
        fuente={FUENTE}>
        <KbaDispersion sitios={s} />
      </Lamina>

      <Lamina id="proteccion" num={13} tipo="Barras · Protección" titulo="Los sitios clave sin protección son la mitad, pero reciben un cuarto de las salidas"
        bajada="Sitios KBA agrupados según qué parte de su superficie está dentro de un área protegida (PA/OECM)."
        leer="Para cada tramo, la barra clara es la parte de los sitios KBA y la oscura la parte de las salidas que ocurren dentro de ellos."
        hallazgo={sinProt && totalProt && parcial ? <>Los {sinProt.sitios} sitios sin protección son el {Math.round((100 * sinProt.sitios) / totS)} % de los KBA, pero reciben {sinProt.pct.toLocaleString("es-CL")} % de las salidas. Los parcialmente protegidos (1–50 %) concentran {parcial.pct.toLocaleString("es-CL")} %; en ese tramo, tres sitios muy visitados reúnen cerca de dos tercios de las salidas.</> : "—"}
        limitacion="Solo se publica el agregado por tramo. Una salida en dos KBA superpuestos se cuenta en ambos, y la cobertura no distingue el tipo de protección."
        fuente="eBird EBD relSep-2026 (2019–2025) · KBA World Database sep-2026 · 13_kba_proteccion">
        <ProteccionKba proteccion={r.proteccion} />
      </Lamina>
      <Fuente etiqueta="Cita KBA">{k.cita}</Fuente>
    </main>
  );
}
