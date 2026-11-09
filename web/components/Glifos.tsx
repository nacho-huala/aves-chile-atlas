// Glifos de las tres vías, dibujados con el mismo lenguaje de celdas del logo.
const C = 5;
const cel = (pts: [number, number][], fill: string) =>
  pts.map(([x, y], i) => <rect key={fill + i} x={x * 6 + 1} y={y * 6 + 1} width={C} height={C} rx={1} fill={fill} />);

export function GlifoEspecie() {
  // silueta de ave posada, en celdas
  const cuerpo: [number, number][] = [[2,1],[3,1],[1,2],[2,2],[3,2],[0,2],[2,3],[3,3],[4,3],[2,4],[3,4],[4,4],[5,4],[3,5],[4,5],[5,5]];
  const ala: [number, number][] = [[4,2],[5,3],[6,4],[6,5]];
  return <svg viewBox="0 0 42 42" aria-hidden="true">{cel(cuerpo, 'var(--musgo-5)')}{cel(ala, 'var(--foco)')}<rect x="19" y="37" width="2" height="4" fill="var(--texto)" /><rect x="10" y="40" width="24" height="1.5" fill="var(--texto)" /></svg>;
}
export function GlifoLugar() {
  // franja de Chile en celdas con un punto elegido
  const tira: [number, number][] = [[3,0],[3,1],[3,2],[2,3],[3,3],[2,4],[2,5],[1,6]];
  return <svg viewBox="0 0 42 42" aria-hidden="true">{cel(tira, 'var(--musgo-4)')}<rect x="13" y="25" width="5" height="5" rx="1" fill="var(--foco)" /><circle cx="15.5" cy="27.5" r="8" fill="none" stroke="var(--foco)" strokeWidth="1.5" /></svg>;
}
export function GlifoDatos() {
  const alturas = [2, 3, 3, 4, 5, 6, 6];
  const out: React.ReactNode[] = [];
  alturas.forEach((h, x) => { for (let y = 0; y < h; y++) out.push(<rect key={`${x}-${y}`} x={x * 6 + 0.5} y={41 - (y + 1) * 6 + 1} width={C} height={C} rx={1} fill={y === h - 1 ? 'var(--foco)' : 'var(--musgo-' + Math.min(6, 2 + y) + ')'} />); });
  return <svg viewBox="0 0 42 42" aria-hidden="true">{out}</svg>;
}
