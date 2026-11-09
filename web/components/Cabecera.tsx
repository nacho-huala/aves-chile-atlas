'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TemaToggle } from './TemaToggle';

export function Cabecera() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className="cabecera" data-scrolled={scrolled}>
      <div className="wrap cabecera__fila">
        <Link href="/" className="cabecera__logo" aria-label="Atlas de aves en Chile, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-dia" src="/brand/logo-dia.svg" alt="" width={316} height={96} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-noche" src="/brand/logo-noche.svg" alt="" width={316} height={96} />
        </Link>
        <nav className="cabecera__nav" aria-label="Principal">
          <Link href="/especies/">Especies</Link>
          <Link href="/calculadora/">Tu salida</Link>
          <Link href="/datos/">Datos</Link>
          <TemaToggle />
        </nav>
      </div>
    </header>
  );
}
