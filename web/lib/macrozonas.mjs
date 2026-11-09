// Macrozonas del atlas: MISMA asignación región → macrozona que pipeline/build_atlas_data.py (MACRO).
// Si cambia allá, cambia aquí y corre `npm run geo`.
export const MACROZONAS = [
  { id: 'norte-grande', nombre: 'Norte Grande', color: 'cat-musgo', regiones: ['CL-AP', 'CL-TA', 'CL-AN'] },
  { id: 'norte-chico', nombre: 'Norte Chico', color: 'cat-mar', regiones: ['CL-AT', 'CL-CO'] },
  { id: 'centro', nombre: 'Centro', color: 'cat-vino', regiones: ['CL-VS', 'CL-RM', 'CL-LI'] },
  { id: 'sur', nombre: 'Sur', color: 'cat-ocre', regiones: ['CL-ML', 'CL-NB', 'CL-BI', 'CL-AR', 'CL-LR'] },
  { id: 'austral', nombre: 'Austral', color: 'cat-ciruela', regiones: ['CL-LL', 'CL-AI', 'CL-MA'] },
];
export const REGIONES = {
  'CL-AP': 'Arica y Parinacota', 'CL-TA': 'Tarapacá', 'CL-AN': 'Antofagasta', 'CL-AT': 'Atacama', 'CL-CO': 'Coquimbo',
  'CL-VS': 'Valparaíso', 'CL-RM': 'Metropolitana', 'CL-LI': 'O’Higgins', 'CL-ML': 'Maule', 'CL-NB': 'Ñuble',
  'CL-BI': 'Biobío', 'CL-AR': 'Araucanía', 'CL-LR': 'Los Ríos', 'CL-LL': 'Los Lagos', 'CL-AI': 'Aysén', 'CL-MA': 'Magallanes',
};
