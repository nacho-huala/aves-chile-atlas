// Láminas de la entrega L2 (imágenes exportadas del deck). Se reemplazarán por versiones interactivas.
export interface Lamina {
  id: string; href: string; img: string; w: number; h: number; tipo: string; titulo: string; alt: string;
  leer: string; hallazgo: string; limitacion: string;
}
export const LAMINAS: Lamina[] = [
  { id: "riqueza", href: "/estadisticas/#mapa", img: "/laminas/mapa-bivariado.webp", w: 2045, h: 933, tipo: "Mapa bivariado",
    titulo: "La riqueza no siempre está donde más se observa",
    alt: "Mapa bivariado de Chile con salidas y especies por celda de 0,25 grados",
    leer: "Verde: muchas salidas. Rosado: muchas especies con pocas salidas. Café oscuro: ambos altos.",
    hallazgo: "Arica: 229 especies en 5.785 salidas. Santiago: 164 especies en 57.677 salidas.",
    limitacion: "Las celdas de 0,25° no tienen igual área; 58 celdas de islas quedan fuera del encuadre." },
  { id: "rareza", href: "/especies/#rareza", img: "/laminas/enjambre-rareza.webp", w: 2045, h: 1113, tipo: "Enjambre de rareza",
    titulo: "La mayoría de las especies se ve muy pocas veces",
    alt: "Enjambre de especies según el porcentaje de salidas en que aparecen, en escala logarítmica",
    leer: "Cada punto es una especie: a la derecha las comunes, a la izquierda las raras (% de salidas, escala log).",
    hallazgo: "107 especies se vieron en menos de 10 salidas; Zorzal patagónico, Tiuque y Chincol, en 1 de cada 3.",
    limitacion: "El origen y la residencia combinan fuentes globales y estacionalidad en Chile: es un aproximado." },
  { id: "marea", href: "/estadisticas/#marea", img: "/laminas/streamgraph.webp", w: 2046, h: 1001, tipo: "Streamgraph",
    titulo: "Las salidas casi se triplicaron entre 2019 y 2025",
    alt: "Streamgraph de salidas por mes y macrozona entre 2019 y 2025",
    leer: "El grosor de cada banda son las salidas de una macrozona; su posición vertical no tiene significado.",
    hallazgo: "Las salidas pasaron de 41.968 a 111.926 (×2,7): más observación, no necesariamente más aves.",
    limitacion: "Permite ver patrones, pero dificulta comparar valores exactos por macrozona." },
  { id: "red", href: "/estadisticas/#red", img: "/laminas/red-coocurrencia.webp", w: 2046, h: 1474, tipo: "Red de co-ocurrencia",
    titulo: "Las especies se agrupan en dos mundos: agua y tierra",
    alt: "Red de co-ocurrencia de las 40 especies más avistadas, separadas en un grupo acuático y uno terrestre",
    leer: "Nodo = especie (tamaño = salidas); línea = se ven juntas; grosor = lift. Color = hábitat principal.",
    hallazgo: "El par más fuerte: Zarapito común y Pilpilén común (×7,4). Louvain separa agua y tierra.",
    limitacion: "La posición en el plano no tiene escala: solo importan las conexiones." },
  { id: "rasgos", href: "/estadisticas/#rasgos", img: "/laminas/espacio-rasgos.webp", w: 2046, h: 1269, tipo: "Espacio de rasgos",
    titulo: "La masa y el pico delatan la dieta",
    alt: "Dispersión de masa corporal contra largo relativo del pico, coloreada por dieta, de 537 especies",
    leer: "Arriba: pico largo para su tamaño. Derecha: aves más pesadas.",
    hallazgo: "Picaflores arriba a la izquierda; rapaces, pingüinos y pelícanos a la derecha. 220 especies son carnívoras o pescadoras.",
    limitacion: "Rasgos promedio por especie (AVONET), no medidos en aves de Chile; faltan 29 especies." },
];
