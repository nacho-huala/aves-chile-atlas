'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';

/** Cuenta desde 0 hasta `valor` una sola vez, cuando entra en pantalla. */
export function Contador({ valor, prefijo = '', decimales = 0 }: { valor: number; prefijo?: string; decimales?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visto = useInView(ref, { once: true, margin: '-15% 0px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(valor);
  useEffect(() => {
    if (!visto || reduce) return;
    const c = animate(0, valor, { duration: 1.4, ease: [0.2, 0.7, 0.2, 1], onUpdate: setN });
    return () => c.stop();
  }, [visto, reduce, valor]);
  return <span ref={ref} aria-label={prefijo + valor.toLocaleString('es-CL', { maximumFractionDigits: decimales })}>{prefijo}{n.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}</span>;
}
