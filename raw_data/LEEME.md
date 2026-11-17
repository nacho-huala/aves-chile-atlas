# raw_data — insumos para reproducir todo el proyecto (NO se versiona)

Esta carpeta está en `.gitignore`. Se comprime y se comparte por Google Drive **solo entre integrantes del Grupo 05**
(ver «Términos» abajo). Para usarla en otro computador: descomprimir en la raíz del repo, de modo que quede `aves-chile-atlas/raw_data/`.

| Carpeta | Contenido | Fuente | Lo usa |
|---|---|---|---|
| `01_ebird/chile_ebd_relSep-2026.txt` | EBD Chile, relSep-2026 (3,8 GB) | eBird Basic Dataset | `build_atlas_data.py` |
| `01_ebird/_atlas_2019_2025/` | `base`, `avist`, `salidas.parquet` ya generados | `build_atlas_data.py` | `build_kba.py`, `fuera_de_rango.py`, `analisis_e2.py` |
| `02_avonet/` | AVONET Supplementary dataset 1 (CC BY 4.0) | Tobias et al. 2022 | `enrich_species.py` |
| `03_kba/` | KBA World Database sept-2026: shapefiles POL/PNT, `KBA-Sites.csv`, especies gatillo | keybiodiversityareas.org | `build_kba.py` |
| `04_birdlife/` | Checklist HBW/BirdLife v10, metadatos y derivados de rangos para Chile (`botw_chile.parquet`, equivalencias) | BirdLife DataZone | `build_rangos.py`, `fuera_de_rango.py` |
| `05_uicn/` | Descarga UICN Red List (CSV) + términos y metadatos | iucnredlist.org | `build_uicn.py` |
| `06_cache_apis/` | Cachés de iNaturalist y xeno-canto | APIs | `enrich_species.py` (evita reconsultar) |
| `07_referencias/` | Atlas de aves nidificantes de Chile (Medrano et al. 2018), PDF y texto | referencia | consulta |

## Cómo dejarlo funcionando
Los scripts leen desde `data/raw/` y `data/`. Después de descomprimir:
```bash
mkdir -p data/raw data/KBA_Data data/UICN data/species_data/derived data/extra/cache
cp raw_data/01_ebird/chile_ebd_relSep-2026.txt data/raw/
cp -r raw_data/01_ebird/_atlas_2019_2025 data/raw/
cp "raw_data/02_avonet/AVONET Supplementary dataset 1.xlsx" data/raw/
cp -r raw_data/03_kba/. data/KBA_Data/
cp -r raw_data/05_uicn/. data/UICN/
cp raw_data/04_birdlife/*.xlsx raw_data/04_birdlife/*.docx data/species_data/
cp raw_data/04_birdlife/derived/* data/species_data/derived/
cp raw_data/06_cache_apis/*.json data/extra/cache/
```
(En Windows PowerShell usa `Copy-Item -Recurse`.)

## Qué NO está aquí
- **`BOTW_2025.gpkg`** (8,8 GB, rangos BirdLife del mundo): solo hace falta para volver a ejecutar `extraer_rangos_chile.py`; el recorte a Chile ya viene en `04_birdlife/derived/botw_chile.parquet`. Se vuelve a pedir en datazone.birdlife.org.
- **Claves de API** (`.env`: eBird, IUCN, xeno-canto): son personales; cada integrante crea las suyas.
- Los otros sets de BirdLife/UICN pedidos, cuando lleguen, van en `04_birdlife/` y `05_uicn/`.

## Términos
- **eBird:** no redistribuir el EBD fuera de quienes lo solicitaron; `salidas.parquet` trae fecha, hora y coordenadas.
- **KBA, BirdLife y UICN:** licencias personales e intransferibles; prohíben redistribuir a terceros. Comparte el enlace de Drive **solo con el equipo** (acceso restringido por correo, nunca «cualquiera con el enlace») y no lo adjuntes al informe ni al repositorio.
