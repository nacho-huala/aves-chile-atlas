'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

type Tema = 'dia' | 'noche';

export function TemaToggle() {
  const [tema, setTema] = useState<Tema>('dia');
  useEffect(() => {
    setTema((document.documentElement.dataset.theme as Tema) ?? 'dia');
  }, []);
  const elegir = (t: Tema) => {
    setTema(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('atlas-tema', t); } catch {}
  };
  const opciones: { id: Tema; txt: string; icono: React.ReactNode }[] = [
    { id: 'dia', txt: 'Día', icono: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg> },
    { id: 'noche', txt: 'Noche', icono: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg> },
  ];
  return (
    <div className="tema" role="group" aria-label="Tema de color">
      {opciones.map((o) => (
        <button key={o.id} type="button" aria-pressed={tema === o.id} onClick={() => elegir(o.id)}>
          {tema === o.id && <motion.span layoutId="tema-pastilla" className="tema__pastilla" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span style={{ display: 'inline-flex' }}>{o.icono}</span>
          <span className="tema__txt">{o.txt}</span>
        </button>
      ))}
    </div>
  );
}
