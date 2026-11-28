'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icono } from './Icono';
import { useEffect, useState } from 'react';
import { TemaToggle } from './TemaToggle';

const SECCIONES = [
  { href: '/', t: 'Inicio', icono: 'casa' },
  { href: '/estadisticas/', t: 'Estadísticas', icono: 'barras' },
  { href: '/especies/', t: 'Especies', icono: 'ave' },
  { href: '/lugares/', t: 'Lugares', icono: 'pin' },
  { href: '/planificar/', t: 'Planifica', icono: 'binoculares' },
];

export function Cabecera() {
  const ruta = usePathname() ?? '/';
  const activa = (href: string) => (href === '/' ? ruta === '/' : ruta.startsWith(href.replace(/\/$/, '')));
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <>
    <header className="cabecera" data-scrolled={scrolled}>
      <div className="wrap cabecera__fila">
        <Link href="/" className="cabecera__logo" aria-label="Atlas de aves en Chile, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-dia" src="/brand/logo-dia.svg" alt="" width={316} height={96} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-noche" src="/brand/logo-noche.svg" alt="" width={316} height={96} />
        </Link>
        <nav className="cabecera__nav" aria-label="Principal">
          {SECCIONES.slice(1).map((x) => (
            <Link key={x.href} href={x.href} className={x.href === '/planificar/' ? 'nav-cta' : undefined} aria-current={activa(x.href) ? 'page' : undefined}>{x.t}</Link>
          ))}
          <TemaToggle />
        </nav>
      </div>
    </header>
      {/* En celulares la navegación va abajo, al alcance del pulgar. Va fuera de <header>: su backdrop-filter
          haría que algunos navegadores (Safari) ubiquen la barra fija respecto de la cabecera y no de la pantalla. */}
      <nav className="nav-movil" aria-label="Secciones">
        {SECCIONES.map((x) => (
          <Link key={x.href} href={x.href} aria-current={activa(x.href) ? 'page' : undefined}>
            <Icono nombre={x.icono} tam={22} /><span>{x.t}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
