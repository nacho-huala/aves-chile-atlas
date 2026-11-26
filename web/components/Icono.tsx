// Íconos de trazo (24×24, currentColor) para títulos de sección y metadatos. Dibujados a mano para el atlas.
const P: Record<string, React.ReactNode> = {
  ave: <><path d="M4 14c2.5 0 4-1.5 5-4 1-2.5 3-4 5.5-4 2 0 3.5 1.2 4 3l2 .5-2 1.2c0 4.5-3.5 8.3-9 8.3H5l2-2" /><circle cx="15.5" cy="8.6" r=".6" fill="currentColor" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14h2M14 14h2M8 17h2" /></>,
  nido: <><path d="M3 13c0 4 4 7 9 7s9-3 9-7" /><path d="M4 13h16M6 16c2 .8 4 1.2 6 1.2s4-.4 6-1.2" /><ellipse cx="9.5" cy="10.2" rx="2.2" ry="2.8" /><ellipse cx="14.3" cy="10.4" rx="2" ry="2.6" /></>,
  montana: <><path d="M2.5 20l6.5-11 4 6.5 2.5-3.5 6 8z" /><path d="M7.4 11.8l1.6 1.4 1.7-1.6" /></>,
  pin: <><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0113 0c0 4.9-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  ola: <><path d="M3 18c2.2-4 3.8-4 6 0s3.8 4 6 0 3.8-4 6 0" /><path d="M3 12c2.2-4 3.8-4 6 0s3.8 4 6 0 3.8-4 6 0" opacity=".55" /><path d="M3 6c2.2-3 3.8-3 6 0s3.8 3 6 0 3.8-3 6 0" opacity=".3" /></>,
  barras: <><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="9" rx=".6" /><rect x="10.5" y="6" width="3" height="14" rx=".6" /><rect x="15.5" y="13.5" width="3" height="6.5" rx=".6" /></>,
  dispersion: <><path d="M4 4v16h16" /><circle cx="8.5" cy="14.5" r="1.3" /><circle cx="12" cy="10.5" r="1.3" /><circle cx="16.5" cy="8" r="1.3" /><circle cx="15" cy="14" r="1.3" /></>,
  escudo: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  canto: <><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></>,
  libro: <><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5c-.8 0-1.5.7-1.5 1.5z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5z" /></>,
  flecha: <path d="M19 12H5M11 6l-6 6 6 6" />,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  rueda: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5" /></>,
  red: <><circle cx="6" cy="7" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="13" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="17" r="2" /><path d="M7.6 8.2l2.9 3.4M16.5 7.3l-3 4.2M10.4 14.2l-2.8 2.6M13.6 14.1l2.9 2" /></>,
  rasgos: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17" opacity=".5" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="10" r="1.2" fill="currentColor" /><circle cx="14" cy="15" r="1.2" fill="currentColor" /></>,
  enjambre: <><circle cx="6" cy="12" r="1.4" /><circle cx="9.5" cy="10" r="1.4" /><circle cx="9.5" cy="14" r="1.4" /><circle cx="13" cy="12" r="1.4" /><circle cx="16.5" cy="11" r="1.4" /><circle cx="19" cy="13.5" r="1.4" /><path d="M3 19h18" /></>,
  alerta: <><path d="M12 4l9 16H3z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  oido: <><path d="M8 9a4.5 4.5 0 119 0c0 3-3 3.6-3 6.5a2.5 2.5 0 01-5 0" /><path d="M10.5 9.5a2 2 0 013.5 1.2" /></>,
  mapa: <><path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2z" /><path d="M8.5 4.5v13M15.5 7v13" /></>,
  marea: <><path d="M3 17c3-1 4-5 9-5s6 4 9 5" /><path d="M3 12c3-1 4-4 9-4s6 3 9 4" opacity=".55" /><path d="M3 20h18" /></>,
  compartir: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></>,
  descargar: <><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M4.5 19.5h15" /></>,
  enlace: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2" /></>,
  copiar: <><rect x="8.5" y="8.5" width="11" height="12" rx="2" /><path d="M15.5 8.5V5.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v9a2 2 0 002 2h2" /><path d="M11.5 12.5h5M11.5 16h3.5" /></>,
  ruta: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18h7.5a3.5 3.5 0 000-7h-7a3.5 3.5 0 010-7H16" /></>,
  whatsapp: <><path d="M4 20l1.2-4.1A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4-1z" /><path d="M9 8.8c0 3.3 2.9 6.2 6.2 6.2l1.3-1.5-2-1-1 .9c-1.1-.5-2-1.4-2.5-2.5l.9-1-1-2z" fill="currentColor" strokeWidth={0.8} /></>,
  x: <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" strokeWidth={2.2} />,
  facebook: <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H8v3h2.5V21" />,
  binoculares: <><circle cx="7" cy="15" r="3.5" /><circle cx="17" cy="15" r="3.5" /><path d="M10.5 15h3M5 12l1.5-6h3l1 6M19 12l-1.5-6h-3l-1 6" /></>,
  ojo: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.6" /></>,
};
export type NombreIcono = keyof typeof P;

export function Icono({ nombre, tam = 20, className }: { nombre: string; tam?: number; className?: string }) {
  return (
    <svg className={`icono ${className ?? ""}`} width={tam} height={tam} style={{ width: tam, height: tam, flex: "none" }} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[nombre] ?? P.ave}
    </svg>
  );
}

/** Título de sección con ícono en una pastilla: <h2 className="titulo-icono"><Icono/>…</h2>. */
export function TituloIcono({ icono, nivel = 2, id, className = "", children }: {
  icono: string; nivel?: 2 | 3; id?: string; className?: string; children: React.ReactNode;
}) {
  const H = nivel === 2 ? "h2" : "h3";
  return (
    <H id={id} className={`titulo-icono ${className}`}>
      <span className="titulo-icono__marca" aria-hidden="true"><Icono nombre={icono} tam={nivel === 2 ? 22 : 18} /></span>
      <span>{children}</span>
    </H>
  );
}

/** Ícono por tipo de lámina (se elige por palabras del tipo). */
export function iconoDeTipo(tipo: string) {
  const t = tipo.toLowerCase();
  const reglas: [RegExp, string][] = [[/mapa/, "mapa"], [/stream|marea/, "marea"], [/rueda/, "rueda"], [/reloj/, "reloj"],
    [/enjambre/, "enjambre"], [/riesgo/, "alerta"], [/red /, "red"], [/rasgos/, "rasgos"], [/oído|oido/, "oido"],
    [/ridgeline|ola/, "ola"], [/nidific/, "nido"], [/altitud/, "montana"], [/protecci/, "escudo"], [/dispersi/, "dispersion"],
    [/calculadora/, "binoculares"], [/barras/, "barras"]];
  return reglas.find(([r]) => r.test(t))?.[1] ?? "ave";
}
