# Cambios a partir del feedback del profesor

Rama `feedback-profesor`. Cada punto indica qué se cambió y dónde.

## Lámina 7 · Crecimiento de las salidas

- **Pregunta:** ¿el aumento de salidas viene de más personas usando eBird o de que quienes ya participaban registran más?
- **Respuesta con los datos (`00_anual.csv`):** entre 2019 y 2025 las salidas se multiplican por 2,67 y los observadores por 2,50. Las salidas por observador pasan de 18,8 a 20,1. En escala logarítmica, cerca del 93 % del crecimiento viene de que hay más observadores.

| Año | Salidas | Observadores | Salidas por observador |
|---|---|---|---|
| 2019 | 41.968 | 2.231 | 18,8 |
| 2020 | 45.085 | 2.258 | 20,0 |
| 2021 | 53.017 | 2.303 | 23,0 |
| 2022 | 69.902 | 3.368 | 20,8 |
| 2023 | 96.747 | 4.538 | 21,3 |
| 2024 | 105.736 | 5.017 | 21,1 |
| 2025 | 111.926 | 5.579 | 20,1 |

- **Cambios:** nuevo título («Las salidas registradas en eBird casi se triplicaron, sobre todo porque se sumaron observadores»). La bajada aclara que es crecimiento dentro de eBird y no prueba que más gente observe aves en Chile. Se agregó un gráfico de índice (2019 = 100) con salidas, observadores y salidas por observador.
- **Limitación agregada:** un observador es una cuenta con al menos una salida en el año; no distingue personas nuevas en la observación de personas que antes no usaban eBird.

## Lámina 1 · Mapa bivariado

- «Terciles» se cambió por niveles **bajo, medio y alto**, con los rangos visibles en la leyenda (especies: 1–13, 14–47, 48–229; salidas: 1–5, 6–38, 39–57.677).
- **Zoom:** botones +, − y «ver todo Chile», pellizco con dos dedos y Ctrl + rueda. Con un dedo, la página sigue desplazándose.
- **Ficha fija al tocar una celda.** Al tocarla, el mapa se acerca y la ficha muestra:
  - especies y salidas, con su nivel;
  - la localidad más cercana y la distancia;
  - las coordenadas del centro, que se pueden copiar;
  - un enlace a Google Maps.
  La ficha aclara que el punto es el centro aproximado de una celda de unos 28 km de alto y 17 a 27 km de ancho según la latitud, y no un acceso.
- **Filtro «Por explorar»:** se renombró «Especies en un nivel más alto que las salidas». Ahora explica que no demuestra que el sitio tenga más especies de lo esperable. También se cambió el hallazgo.

## Lámina 8 · Red de co-ocurrencia

- La explicación del lift está **sobre la lista** de especies vinculadas y usa el par seleccionado como ejemplo. Por ejemplo: «Pilpilén común y Gaviota garuma se registran juntas 7,9 veces lo esperado si sus registros fueran independientes».
- La explicación aclara que el lift es del par, no implica causa y no es una probabilidad de verla en cualquier salida.
- Hay claves de lectura de tamaño, línea, color y posición, tanto en el panel como en «Cómo leer». El control se llama «Lift mínimo».

## Lámina 6 · Calculadora

- Nuevo título: «Las diez especies más registradas en salidas de esta zona y duración».
- Se muestra la base de la lista: número de salidas, tramo de minutos, zona, años y tipo de salida. Se verificó que es la misma base de la mediana en todas las combinaciones de zona y duración.
- La nota aclara que es frecuencia de reporte y no una probabilidad garantizada.

## Sección de especies

- **Estatus** pasa a «Origen y presencia», con opciones descriptivas.
- **Categoría UICN** pasa a «Estado de conservación (UICN)».
- **Más raras primero** pasa a «Menos registradas primero». La misma lógica se aplicó al planificador y a la lámina 5.
- **Nidificación:** la opción ahora es «Sin registro en el atlas», en vez de «No registrada».
- Se agregó una ayuda desplegable que explica cada filtro.

## Fichas de especie

- «Cuándo buscarla» y «Nidificación» ahora son una sola sección con el calendario: barras para el registro en eBird y franja dorada para la nidificación según el atlas. Cada lectura tiene su propia fuente.
- Ya no se repite la fila de meses.
- Se distinguen tres casos: meses de nidificación conocidos; nidifica sin meses precisos; y sin registro en el atlas, lo que no equivale a «no nidifica».
- El resumen reproductivo y la altitud quedan como información complementaria.

## Lugares · Registro de prueba del mapa

- **Recorrido probado:** entrar, elegir una macrozona, seleccionar sitios desde el mapa y desde la lista, y volver a la vista general. Se probó en Chrome (Playwright) en computador (1366 × 768) y en teléfono (390 × 844, táctil).
- **Paso en que fallaba:** después de elegir una macrozona. El mapa se encuadraba en la zona, pero el SVG tenía `overflow: visible` (regla general de las láminas). Por eso el resto de Chile y el recuadro de Juan Fernández se dibujaban fuera del marco y tapaban el botón «Usar mi ubicación» y el selector de macrozona. No se podía volver a «Todo Chile», y el mapa parecía pegado.
- **Corrección:**
  - El mapa de sitios recorta su contenido (`overflow: hidden`).
  - Los recuadros de islas se ocultan con zoom.
  - Los sitios fuera de la zona elegida no responden a toques.
  - Se agregó el botón «Volver a todo Chile».
  - En el teléfono, al elegir un sitio la página baja hasta su detalle.
- **Comprobación posterior:** en Sur, Austral y Norte Grande el selector quedó libre, los sitios respondieron desde el mapa y desde la lista, y el botón restituyó la vista completa (127 sitios) en ambos dispositivos. No hubo errores de JavaScript.
- **Pendiente:** probar en Safari de iPhone y en Firefox. La prueba automática solo cubre Chrome.

## Otros arreglos de navegación

- **Barra inferior en el celular:** se movió fuera de la cabecera, para que Safari la fije respecto de la pantalla.
- **Desplazamiento:** el margen ahora considera la cabecera y la barra inferior, para que lo que se desplaza a la vista no quede tapado.
- **Inicio:** tiene una cuarta tarjeta para «Lugares».
