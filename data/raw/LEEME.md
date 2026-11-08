# data/raw — archivos que NO se versionan

Esta carpeta está en `.gitignore` (salvo este archivo). Cada integrante pone aquí sus copias locales:

| Archivo | De dónde sale | Peso aprox. |
|---|---|---|
| `chile_ebd_relSep-2026.txt` | eBird Basic Dataset, filtro Chile — https://ebird.org/data/download (requiere cuenta y aceptar términos) | 4 GB |
| `AVONET Supplementary dataset 1.xlsx` | Tobias et al. 2022, figshare (CC BY 4.0) | 21 MB |
| `_atlas_2019_2025/` (`base`, `salidas`, `avist.parquet`) | Los crea `pipeline/build_atlas_data.py` | 290 MB |

**Por qué no se suben:** peso, términos de uso de eBird (no redistribuir datos crudos) y privacidad
(`salidas.parquet` trae fecha, hora y coordenadas de cada salida).

Las claves de API van en `.env` en la raíz del repo (también ignorado):

```
EBIRD_API_KEY=...
IUCN_TOKEN=...
XC_KEY=...
```
