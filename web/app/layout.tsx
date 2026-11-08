import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aves en Chile · un atlas de campo",
  description: "eBird Chile 2019–2025: dónde, cuándo y qué tan probable es ver cada especie.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Tipografías del sistema visual (se cargan en el navegador; el build no las necesita) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;600&family=Young+Serif&display=swap"
        />
      </head>
      <body>
        <header className="cabecera">
          <Link href="/" className="marca">Aves en Chile</Link>
          <nav>
            <Link href="/calculadora/">Tu salida</Link>
            <Link href="/especies/">Especies</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
