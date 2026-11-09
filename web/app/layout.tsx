import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";
import { Cabecera } from "@/components/Cabecera";
import { PieSitio } from "@/components/PieSitio";

export const metadata: Metadata = {
  title: "Atlas de aves en Chile · guía de campo con datos de eBird",
  description:
    "Guía de campo con 7,3 millones de registros de eBird en Chile (2019–2025): busca una especie, elige un lugar o explora los datos.",
  openGraph: {
    title: "Atlas de aves en Chile",
    description: "566 especies y 524.381 salidas de observación, ordenadas para que sepas qué mirar y dónde.",
    locale: "es_CL",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e7dc" },
    { media: "(prefers-color-scheme: dark)", color: "#161913" },
  ],
};

// Tema antes del primer pintado: preferencia guardada → sistema → Día.
const temaInicial = `(function(){try{var t=localStorage.getItem('atlas-tema');if(t!=='dia'&&t!=='noche'){t=matchMedia('(prefers-color-scheme: dark)').matches?'noche':'dia'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dia'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" data-theme="dia" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body>
        <a className="skip" href="#contenido">Saltar al contenido</a>
        <Cabecera />
        {children}
        <PieSitio />
      </body>
    </html>
  );
}
