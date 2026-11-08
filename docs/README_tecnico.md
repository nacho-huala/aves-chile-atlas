# README técnico · reglas y diccionario de datos

Detalle de las reglas del pipeline y de cada archivo CSV. La visión general, la estructura del repo y los comandos están en el [README principal](../README.md).

> La numeración de secciones se conserva de la versión anterior de este documento (el brief E2 cita «§8»).

---

## 5. Paso 1 · `pipeline/build_atlas_data.py`: limpieza y agregación

### 5.1 Filtros y transformaciones

| Regla | Detalle |
|---|---|
| Período | `OBSERVATION DATE` entre 2019-01-01 y 2025-12-31 |
| Aprobados | `APPROVED = 1` |
| Categorías válidas | `species`, `issf`, `form`, `intergrade`, `domestic`. Se excluyen `spuh` («Larus sp.»), `slash` («A/B») e híbridos porque no identifican una especie |
| Especie | Primeras dos palabras del nombre científico: «Columba livia (Feral Pigeon)» → «Columba livia». Las subespecies se suman a su especie |
| Conteo | `OBSERVATION COUNT` a entero; `X` queda nulo con la bandera `x_presencia` |
| Salida | `salida_id = coalesce(GROUP IDENTIFIER, SAMPLING EVENT IDENTIFIER)` |
| Macrozona | Por `STATE CODE` (ISO 3166-2): **Norte Grande** (AP, TA, AN), **Norte Chico** (AT, CO), **Centro** (VS, RM, LI), **Sur** (ML, NB, BI, AR, LR), **Austral** (LL, AI, MA) |

### 5.2 Tablas intermedias (`data/raw/_atlas_2019_2025/`, no versionadas)

**`salidas.parquet`** — una fila por salida. Para las salidas compartidas toma fecha, hora, lugar y protocolo de la primera lista; duración, distancia y número de observadores se toman como el máximo; `complete = any()` (completa si alguna copia lo es); `riqueza` = especies distintas.

**`avist.parquet`** — una fila por `salida_id × especie`. Individuos = máximo entre las copias; `x_presencia` = todas las copias en X; `has_media` = alguna copia con foto o audio.

### 5.3 Código exótico

`05_especies.exotic` es el código exótico más frecuente de la especie (`N` naturalizada, `P` provisional, `X` escape). Por sí solo **no** convierte a una especie en introducida: ver la regla de `introducida` en 6.1.

---

## 6. Paso 2 · `pipeline/enrich_species.py`: cruces con fuentes externas

El cruce se hace por nombre científico (taxonomía eBird). Cada fuente guarda su caché en `data/extra/cache/` (no versionada) con escritura atómica: si el proceso se corta, retoma desde la última especie guardada.

| Fuente | Acceso | Qué aporta | Archivo |
|---|---|---|---|
| eBird API 2.0 | Clave gratis | Nombre en español (`locale=es_CL`), código, orden, familia | `extra/e01_ebird_taxonomia.csv` |
| Wikidata (SPARQL) | Abierta | Categoría UICN global (P141), endémica de (P183), imagen Commons (P18) | `extra/e02_wikidata.csv` |
| iNaturalist | Abierta | Foto con autor y licencia, establecimiento en Chile (`native`, `endemic`, `introduced`), Wikipedia | `extra/e03_inaturalist.csv` |
| UICN Red List v4 | Token no comercial | Categoría, año y tendencia poblacional | `extra/e04_iucn.csv` (aún no generado) |
| AVONET | Descarga CC BY 4.0 | Masa, pico, ala, tarso, hábitat, dieta, migración (1/2/3), estilo de vida | `extra/e05_avonet.csv` |
| xeno-canto v3 | Clave gratis | Grabaciones en Chile, mejor grabación (calidad A, canto), conteo por mes | `extra/12_sonidos.csv` |
| Open-Meteo | Abierta | Altitud de cada localidad (Copernicus DEM 90 m); **opcional, no usada** | `09_altitud.csv` |

### 6.1 Reglas de estatus (con trazabilidad)

| Campo | Regla | Columna de fuente |
|---|---|---|
| `uicn` | API UICN si existe; si no, Wikidata (etiquetas en español mapeadas a LC, NT, VU, EN, CR, DD en `WD_IUCN`) | `uicn_fuente` |
| `endemica` | Wikidata «endémica de Chile» **o** iNaturalist `endemic` **o** lista manual | `endemica_fuente` |
| `introducida` | Código exótico del EBD **y** iNaturalist no la considera nativa ni endémica (corregido en nov-2026; antes era «o») | — |
| `migracion_global` | AVONET: 1 sedentaria, 2 parcialmente migratoria, 3 migratoria | — |
| `estacional_en_chile` | En su peor mes cae bajo el 15 % de su mejor mes (con mejor mes ≥ 0,2 % de las salidas) | — |
| `estatus_final` | endémica → introducida → migratoria/estacional → nativa residente (en ese orden de prioridad) | — |

**Ajustes manuales:** `data/extra/overrides_estatus.csv` con columnas `sci_name,campo,valor,fuente` (por ejemplo, desde la lista de la ROC o el RCE del MMA). Sobrescriben el valor automático y quedan registrados en `<campo>_override_fuente`. Las especies sin estatus resuelto se listan en `extra/pendientes_estatus.csv`.

---

## 7. Paso 3 · `pipeline/export_web.py`: datos para la web

Lee los CSV y escribe los JSON de `web/public/data/` (contrato en `web/lib/data.ts`). Reemplaza al antiguo `prep_web_data.py`. Reglas:

- Excluye nombres que terminan en « sp.» → **566 especies**.
- Calculadora: excluye Norte Grande ≥ 180 min.
- Una ficha por especie en `especies/<slug>.json`; `slug` = nombre científico en minúsculas con guiones.

---

## 8. Diccionario de archivos CSV

Todos los porcentajes `pct_*` están en escala 0–100, salvo indicación. «Salidas» siempre son salidas unificadas.

### 00 · Cifras generales

**`00_kpis.csv`** (1 fila)

| Columna | Descripción |
|---|---|
| `avistamientos_crudos` | Filas válidas del EBD (antes de deduplicar) |
| `listas_ebird` | `SAMPLING EVENT IDENTIFIER` distintos |
| `observadores`, `localidades`, `regiones` | Conteos distintos (`regiones` = 17: 16 regiones + código vacío) |
| `desde`, `hasta` | Rango de fechas |
| `salidas`, `salidas_completas` | Salidas unificadas y cuántas son completas |
| `avistamientos` | Filas de `avist.parquet` (salida × especie) |
| `especies` | Especies distintas (567, incluye un nombre «sp.») |
| `avistamientos_por_salida` | `avistamientos ÷ salidas` |

**`00_anual.csv`** — por `year`: `salidas`, `pct_completas` (proporción 0–1), `especies_por_salida` (media), `avistamientos`, `especies`, `avistamientos_crudos`, `observadores`.

**`00_regiones.csv`** — por `region_code`, `region`, `macrozona`: `salidas`, `salidas_completas`, `especies_por_salida`, `avistamientos`, `especies`, `observadores`.

### 01 · Mapa

**`01_hex.csv`** — una fila por celda.

| Columna | Descripción |
|---|---|
| `celda` | Índice H3 resolución 5 (~250 km²) o `lat_lon` de la grilla de 0,25° si `h3` no está instalado (situación actual) |
| `salidas` | Salidas en la celda |
| `especies_por_salida` | Media de especies por salida |
| `avistamientos`, `especies` | Avistamientos y especies distintas en la celda |
| `lat`, `lon` | Centro de la celda |
| `clase_esfuerzo`, `clase_riqueza` | Tercil (0, 1, 2) de salidas y de especies, para la paleta bivariada |
| `tipo_celda` | `h3_res5` o `grilla_0.25` |

### 02 · Ridgeline

**`02_ridge.csv`** — especie × mes × franja de latitud; solo salidas completas y especies con ≥ 1.000 salidas.

| Columna | Descripción |
|---|---|
| `sci_name`, `common_name`, `month` | Especie y mes (1–12) |
| `lat_banda` | Límite sur de la franja de 0,5° (ej. −33,5 = entre −33,5 y −33,0) |
| `salidas_con` | Salidas completas con avistamiento en la franja-mes |
| `salidas_total` | Salidas completas en la franja-mes (igual para todas las especies) |
| `pct_salidas` | `salidas_con ÷ salidas_total × 100`; solo franjas con ≥ 30 salidas |

Solo contiene filas donde la especie fue avistada. Para los ceros, tomar `salidas_total` de cualquier otra especie en la misma franja-mes.

### 03 · Fenología

**`03_fenologia.csv`** — especies × 12 meses, completado con ceros (550 especies: las que aparecen en salidas completas).

| Columna | Descripción |
|---|---|
| `salidas_total` | Salidas completas del mes en todo Chile |
| `salidas_con` | Salidas completas del mes con la especie |
| `pct_salidas` | `salidas_con ÷ salidas_total × 100` |

### 04 · Reloj

**`04_reloj.csv`** — `reloj` (`local` u hora `solar` = UTC + longitud/15), `macrozona` (`Chile` o una macrozona; estas últimas solo en hora local), `month`, `hora` (0–23) y `salidas`. Excluye el protocolo *Historical* y las salidas a las 00:00 sin duración.

**`04_sol.csv`** — `macrozona`, `month`, `amanecer`, `atardecer` en hora local decimal (día 15 de cada mes, fórmula NOAA, punto representativo de cada macrozona; «Chile» = Santiago).

### 05 · Especies

**`05_especies.csv`** — una fila por especie.

| Columna | Descripción |
|---|---|
| `rango` | Posición por salidas con avistamiento |
| `salidas_con`, `pct_salidas` | Salidas con avistamiento y % sobre **todas** las salidas |
| `individuos_contados`, `mediana_individuos` | Suma y mediana de los conteos numéricos |
| `pct_conteo_x` | Proporción de avistamientos con «X» |
| `salidas_con_media` | Salidas con foto o audio |
| `exotic` | Código exótico más frecuente |
| `primer_avistamiento`, `ultimo_avistamiento` | Fechas extremas |
| `observadores`, `avistamientos_crudos` | Calculados desde las filas crudas |
| `pct_mes_max`, `pct_mes_min`, `pct_mes_media`, `mejor_mes`, `peor_mes` | Desde `03_fenologia` |
| `indice_estacional` | `pct_mes_max ÷ pct_mes_media` |
| `macrozona_principal` | Macrozona con más avistamientos |
| `estatus` | Estatus preliminar (endémica / introducida / estacional / residente) |

**`05b_especies_enriquecidas.csv`** — `05_especies` + todas las columnas de `extra/e0X` + el estatus resuelto (`uicn`, `uicn_fuente`, `nombre`, `endemica`, `endemica_fuente`, `introducida`, `migracion_global`, `estacional_en_chile`, `estatus_final`). Es la **ficha maestra** de cada especie (89 columnas).

### 06 · Calculadora

**`06_acumulacion.csv`** — `macrozona` (incluye «Chile») × `minutos` (tramos de 15 min, de 15 a 240): `salidas`, `mediana`, `q1`, `q3` y `media` de especies por salida. Solo salidas completas *Traveling* o *Stationary* de 5–240 min.

**`06_probabilidad.csv`** — `macrozona` × `minutos` × especie, con las 25 especies más probables por tramo: `salidas_con`, `salidas`, `probabilidad` (0–1).

### 07 · Marea

**`07_marea.csv`** — `year` × `month` × `macrozona`: `salidas`, `salidas_completas`, `avistamientos`.

### 08 · Red

**`08_nodos.csv`** — las 40 especies con más salidas completas: `salidas_con`, `pct_salidas` (% de salidas **completas**), `comunidad` (Louvain).

**`08_aristas.csv`** — pares con `lift ≥ 1,3` y `juntas ≥ 50`: `source`, `target`, `juntas`, `lift` = `P(A∩B) ÷ (P(A)·P(B))`.

### 10–12 · Cruces

| Archivo | Contenido |
|---|---|
| `10_riesgo.csv` | `nombre`, `pct_salidas`, `salidas_con`, `uicn`, `uicn_fuente`, `uicn_orden` (LC = 0 … CR = 4), `estatus_final`, `endemica`, `macrozona_principal`, foto y crédito |
| `11_rasgos.csv` | Rasgos AVONET (`masa_g`, `pico_culmen_mm`, `pico_alto_mm`, `ala_mm`, `tarso_mm`, `indice_ala_mano`, `habitat`, `nicho_trofico`, `nivel_trofico`, `estilo_vida`, `migracion_global`) + `pct_salidas`, `estatus_final`, `uicn` |
| `extra/12_sonidos.csv` | `xc_grabaciones_chile`, mejor grabación (`xc_id`, `xc_tipo`, `xc_calidad`, `xc_audio`, `xc_sonograma`, `xc_autor`, `xc_licencia`, `xc_lugar`, `xc_url`) y `xc_mes_01` … `xc_mes_12` (primera página de resultados por mes) |

---

## 9. Cálculo de cada lámina

| # | Lámina | Datos | Cálculo |
|---|---|---|---|
| 1 | Mapa bivariado | `01_hex` | Por celda: salidas × especies distintas; color bivariado 3×3 por terciles. Chile rotado 90° (norte a la izquierda); 58 celdas de islas oceánicas fuera del encuadre |
| 2 | Ridgeline latitudinal | `02_ridge` | % de salidas completas por franja de 0,5° y mes. Suavizado: suma de `salidas_con` y `salidas_total` en ±1° antes de dividir; franjas con < 40 salidas en blanco |
| 3 | Rueda fenológica | `03_fenologia` | Anillo = especie, cuña = mes. Modo relativo `pct ÷ máx.`; modo absoluto `√pct` |
| 4 | Reloj polar | `04_reloj`, `04_sol` | Salidas iniciadas por hora × mes; color en `√salidas` |
| 5 | Enjambre de rareza | `05b` | Eje x log: % de salidas; tamaño ∝ √observadores; simulación de fuerzas |
| 6 | Calculadora | `06_*` | Mediana y Q1–Q3 por tramo de duración; probabilidad = salidas con la especie ÷ salidas del tramo |
| 7 | Marea | `07_marea`, `00_anual` | Salidas por mes y macrozona; streamgraph (`stackOffsetWiggle`) |
| 8 | Red | `08_*` | Matriz de incidencia salidas × 40 especies (`scipy.sparse`), `C = Mᵀ·M`, lift; comunidades Louvain |
| 9 | Riesgo vs. visibilidad | `10_riesgo` | Fila = categoría UICN; x log = % de salidas |
| 10 | Oído vs. vista | `12_sonidos`, `05b` | Regresión de `log10(grabaciones + 1)` sobre `log10(% salidas)` (≥ 20 salidas); residuo > 0 = se graba más de lo esperado |
| 11 | Espacio de rasgos | `11_rasgos` | x = masa (log); y = pico relativo `culmen ÷ masa^(1/3)` (log); color = dieta |

| Hábitat (AVONET → atlas) | Dieta (AVONET → atlas) |
|---|---|
| Forest, Woodland → Bosque | Invertivore → Invertívoro |
| Marine, Coastal → Costa / mar | Omnivore → Omnívoro |
| Human Modified → Ciudad | Granivore, Herbivore terrestrial/aquatic → Granívoro / herbívoro |
| Shrubland, Grassland, Rock, Desert → Matorral / pradera | Nectarivore, Frugivore → Nectarívoro / frugívoro |
| Wetland, Riverine → Humedal | Vertivore, Aquatic predator, Scavenger → Carnívoro / pescador / carroñero |

---

## 14. Mejoras pendientes

| Prioridad | Mejora |
|---|---|
| Alta | Contrastar los denominadores con el **SED** (Sampling Event Data), que incluye salidas sin especies reportadas |
| Alta | Revisar `pendientes_estatus.csv` con la lista de aves de Chile de la ROC; cargar el RCE del MMA |
| Alta | Renombrar `pct_salidas` → `pct_salidas_completas` en 02, 03, 06 y 08 (control C07) |
| Alta | Instalar `h3` y regenerar `01_hex.csv` (mapa hexagonal de igual área) |
| Media | Token UICN para la tendencia poblacional; modelo de detección ajustado por esfuerzo; tendencia por especie 2019–2025 |
| Baja | Altitud (Open-Meteo); cruce con áreas protegidas (SNASPE/WDPA); tests automáticos en CI |
