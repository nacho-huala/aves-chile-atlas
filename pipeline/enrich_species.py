"""
enrich_species.py — Atlas de campo · cruces externos por especie y por localidad
==============================================================================
Toma la lista depurada de especies (05_especies.csv, de build_atlas_data.py) y la cruza con
fuentes abiertas mediante sus APIs oficiales (sin scraping de páginas de eBird):

  fuente            qué aporta                                         clave
  ───────────────── ────────────────────────────────────────────────── ─────────────────────
  eBird API 2.0     nombre en español (es_CL), código, familia, orden   EBIRD_API_KEY (gratis)
  Wikidata (SPARQL) endémica de Chile (P183), UICN (P141), imagen      sin clave
  iNaturalist       foto CC + autor + licencia, estatus en Chile        sin clave (≤ 60 req/min)
                    (nativa / endémica / introducida), Wikipedia
  UICN Red List v4  categoría, año, tendencia poblacional              IUCN_TOKEN (gratis, uso no comercial)
  AVONET (xlsx)     masa, pico, ala, hábitat, dieta, migración 1/2/3   descarga manual (CC BY 4.0)
  xeno-canto v3     n.º de grabaciones en Chile + mejor grabación CC   XC_KEY (gratis con cuenta)
  Open-Meteo        altitud (Copernicus DEM 90 m) de cada localidad    sin clave (uso no comercial)

Después combina todo en:
  05b_especies_enriquecidas.csv  ficha maestra con estatus final y de qué fuente salió cada dato
  09_altitud.csv                 especie × banda de 250 m: % de salidas  → lámina "De la costa al altiplano"
  10_riesgo.csv                  UICN × % de salidas × tendencia          → lámina "Riesgo vs. visibilidad"
  11_rasgos.csv                  rasgos AVONET × % de salidas             → lámina "La forma de la avifauna"
  12_sonidos.csv                 grabaciones xeno-canto por especie       → lámina / fichas con canto
  pendientes_estatus.csv         especies sin estatus resuelto (para ROC/RCE o revisión asistida)

Uso
---
    pip install polars requests openpyxl fastexcel
    export EBIRD_API_KEY=...   IUCN_TOKEN=...   XC_KEY=...        # las que tengan
    python enrich_species.py --data data --tmp _atlas_2019_2025 --avonet "AVONET Supplementary dataset 1.xlsx"

    # solo algunas fuentes:
    python enrich_species.py --data data --solo wikidata inat elevacion

Cada fuente guarda su caché en data/extra/cache/, así que se puede cortar y retomar.
Overrides manuales (p. ej. lista de la ROC, RCE del MMA o revisión asistida) en
data/extra/overrides_estatus.csv con columnas: sci_name,campo,valor,fuente
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import polars as pl
import requests

try:  # carga las claves del archivo .env si python-dotenv está instalado
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

UA = {"User-Agent": "AtlasAvesChile/1.0 (proyecto academico UDD; contacto: [tu-email])"}
CHILE_QID = "Q298"


# ─────────────────────────────────────────────────────────── caché simple por fuente
class Cache:
    def __init__(self, path: Path):
        self.path = path
        self.d = {}
        if path.exists():
            try:
                self.d = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                dañado = path.with_suffix(".danado.json")
                path.replace(dañado)
                print(f"  · caché dañada, se movió a {dañado.name} y se empieza de cero")

    def get(self, k):
        return self.d.get(k)

    def set(self, k, v):
        self.d[k] = v

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")  # escritura atómica: un corte no deja el archivo a medias
        tmp.write_text(json.dumps(self.d, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)


def get_json(url, params=None, headers=None, tries=4, pause=1.0):
    tries = max(tries, 6)
    for t in range(tries):
        try:
            r = requests.get(url, params=params, headers={**UA, **(headers or {})}, timeout=(20, 180))
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            espera = min(120, 5 * (2 ** t))
            print(f"    · {type(e).__name__}, reintento {t + 1}/{tries} en {espera}s")
            time.sleep(espera); continue
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(pause * (2 ** t)); continue
        if r.status_code == 404:
            return None
        r.raise_for_status()
    return None


# ─────────────────────────────────────────────────────────── 1 · eBird taxonomía (es_CL)
def ebird_taxonomia(especies: pl.DataFrame, extra: Path):
    key = os.environ.get("EBIRD_API_KEY")
    if not key:
        print("  · sin EBIRD_API_KEY: se omite (pídela gratis en ebird.org/api/keygen)"); return None
    r = requests.get("https://api.ebird.org/v2/ref/taxonomy/ebird",
                     params={"fmt": "csv", "locale": "es_CL", "cat": "species"},
                     headers={**UA, "X-eBirdApiToken": key}, timeout=120)
    r.raise_for_status()
    (extra / "cache").mkdir(parents=True, exist_ok=True)
    raw = extra / "cache" / "ebird_taxonomy_es_CL.csv"
    raw.write_bytes(r.content)
    tax = pl.read_csv(raw, infer_schema_length=0)
    cols = {c.upper(): c for c in tax.columns}
    tax = tax.select(
        pl.col(cols["SCIENTIFIC_NAME"]).alias("sci_name"),
        pl.col(cols["COMMON_NAME"]).alias("nombre_es"),
        pl.col(cols["SPECIES_CODE"]).alias("species_code"),
        pl.col(cols.get("ORDER", cols.get("ORDER1", "ORDER"))).alias("orden"),
        pl.col(cols["FAMILY_COM_NAME"]).alias("familia"),
        pl.col(cols["FAMILY_SCI_NAME"]).alias("familia_cientifica"),
    )
    df = especies.select("sci_name").join(tax, on="sci_name", how="left").with_columns(
        pl.format("https://ebird.org/species/{}/CL", "species_code").alias("url_ebird"))
    df.write_csv(extra / "e01_ebird_taxonomia.csv"); print(f"  ✓ e01_ebird_taxonomia.csv ({df.drop_nulls('species_code').height} con código)")
    return df


# ─────────────────────────────────────────────────────────── 2 · Wikidata
SPARQL = """
SELECT ?sci ?item ?nombre_es ?iucnLabel ?endemicoLabel ?imagen WHERE {{
  VALUES ?sci {{ {values} }}
  ?item wdt:P225 ?sci ; wdt:P105 wd:Q7432 .
  OPTIONAL {{ ?item wdt:P1843 ?nombre_es FILTER(LANG(?nombre_es) = "es") }}
  OPTIONAL {{ ?item wdt:P141 ?iucn }}
  OPTIONAL {{ ?item wdt:P183 ?endemico }}
  OPTIONAL {{ ?item wdt:P18 ?imagen }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "es,en". }}
}}"""


def wikidata(especies: pl.DataFrame, extra: Path, lote=150):
    names = especies["sci_name"].to_list(); rows = []
    for i in range(0, len(names), lote):
        values = " ".join('"' + n.replace('"', "") + '"' for n in names[i:i + lote])
        r = requests.post("https://query.wikidata.org/sparql", data={"query": SPARQL.format(values=values)},
                          headers={**UA, "Accept": "application/sparql-results+json"}, timeout=120)
        r.raise_for_status()
        for b in r.json()["results"]["bindings"]:
            rows.append({k: b[k]["value"] for k in b})
        time.sleep(1)
    if not rows:
        print("  · Wikidata sin resultados"); return None
    df = (pl.DataFrame(rows).rename({"sci": "sci_name", "iucnLabel": "wd_iucn", "endemicoLabel": "wd_endemico_de", "item": "wd_item"})
          .group_by("sci_name").agg(
              pl.col("wd_item").first(), pl.col("nombre_es").drop_nulls().first().alias("wd_nombre_es"),
              pl.col("wd_iucn").drop_nulls().first(),
              pl.col("wd_endemico_de").drop_nulls().unique().str.join("; ").alias("wd_endemico_de"),
              pl.col("imagen").drop_nulls().first().alias("wd_imagen_commons"))
          .with_columns(pl.col("wd_endemico_de").str.contains("Chile").fill_null(False).alias("wd_endemica_chile")))
    df.write_csv(extra / "e02_wikidata.csv"); print(f"  ✓ e02_wikidata.csv ({df.height} especies)")
    return df


# ─────────────────────────────────────────────────────────── 3 · iNaturalist
def inat_place_chile(cache: Cache):
    if cache.get("__place_chile"):
        return cache.get("__place_chile")
    j = get_json("https://api.inaturalist.org/v1/places/autocomplete", {"q": "Chile"})
    pid = next((p["id"] for p in j["results"] if p.get("name") == "Chile" and p.get("admin_level") == 0), None) if j else None
    cache.set("__place_chile", pid); return pid


def inaturalist(especies: pl.DataFrame, extra: Path):
    cache = Cache(extra / "cache" / "inat.json")
    place = inat_place_chile(cache)
    print(f"  · place_id de Chile en iNaturalist: {place}")
    rows = []
    for k, sci in enumerate(especies["sci_name"].to_list()):
        j = cache.get(sci)
        if j is None:
            j = get_json("https://api.inaturalist.org/v1/taxa",
                         {"q": sci, "rank": "species", "is_active": "true", "preferred_place_id": place, "locale": "es", "per_page": 5})
            if j is None:  # falló tras reintentos: no se guarda en caché, se reintenta en la próxima corrida
                print(f"    · sin respuesta para {sci}, se omite por ahora"); continue
            j = next((t for t in j.get("results", []) if t.get("name") == sci), None) or {}
            cache.set(sci, j); time.sleep(1.1)
            if k % 25 == 0: cache.save(); print(f"    {k}/{especies.height}")
        ph = j.get("default_photo") or {}
        em = j.get("establishment_means") or {}
        cs = j.get("conservation_status") or {}
        rows.append({
            "sci_name": sci, "inat_id": j.get("id"), "inat_nombre_es": j.get("preferred_common_name"),
            "inat_establecimiento_chile": em.get("establishment_means"),
            "inat_conservacion": cs.get("status"), "inat_conservacion_autoridad": cs.get("authority"),
            "foto_url": (ph.get("medium_url") or ph.get("url")), "foto_cuadrada": ph.get("square_url"),
            "foto_credito": ph.get("attribution"), "foto_licencia": ph.get("license_code"),
            "wikipedia_url": j.get("wikipedia_url"), "inat_observaciones": j.get("observations_count"),
        })
    cache.save()
    df = pl.DataFrame(rows, infer_schema_length=None)
    df.write_csv(extra / "e03_inaturalist.csv"); print(f"  ✓ e03_inaturalist.csv ({df.drop_nulls('inat_id').height} con taxón)")
    return df


# ─────────────────────────────────────────────────────────── 4 · UICN Red List v4
def iucn(especies: pl.DataFrame, extra: Path):
    tok = os.environ.get("IUCN_TOKEN")
    if not tok:
        print("  · sin IUCN_TOKEN: se omite (pídelo en api.iucnredlist.org; Wikidata cubre la categoría)"); return None
    H = {"Authorization": f"Bearer {tok}"}; cache = Cache(extra / "cache" / "iucn.json"); rows = []
    for k, sci in enumerate(especies["sci_name"].to_list()):
        j = cache.get(sci)
        if j is None:
            g, s = sci.split(" ", 1)
            t = get_json("https://api.iucnredlist.org/api/v4/taxa/scientific_name", {"genus_name": g, "species_name": s}, H) or {}
            ass = [a for a in t.get("assessments", []) if a.get("latest")] or t.get("assessments", [])
            j = {"cat": None}
            if ass:
                a = sorted(ass, key=lambda a: a.get("year_published") or "")[-1]
                det = get_json(f"https://api.iucnredlist.org/api/v4/assessment/{a['assessment_id']}", None, H) or {}
                pt = det.get("population_trend") or {}
                j = {"cat": a.get("red_list_category_code"), "anio": a.get("year_published"), "id": a.get("assessment_id"),
                     "tendencia": (pt.get("description") or {}).get("en") if isinstance(pt, dict) else pt,
                     "url": a.get("url")}
            cache.set(sci, j); time.sleep(0.6)
            print(f"    {k + 1}/{especies.height} {sci}: {j.get('cat') or 'sin evaluación'}", flush=True)
            if k % 10 == 0: cache.save()
        rows.append({"sci_name": sci, "iucn_categoria": j.get("cat"), "iucn_anio": j.get("anio"),
                     "iucn_tendencia": j.get("tendencia"), "iucn_url": j.get("url")})
    cache.save()
    df = pl.DataFrame(rows, infer_schema_length=None)
    df.write_csv(extra / "e04_iucn.csv"); print(f"  ✓ e04_iucn.csv ({df.drop_nulls('iucn_categoria').height} evaluadas)")
    return df


# ─────────────────────────────────────────────────────────── 5 · AVONET (archivo local)
def avonet(especies: pl.DataFrame, extra: Path, xlsx: Path | None):
    if not xlsx or not Path(xlsx).exists():
        print("  · sin --avonet: se omite (descarga 'AVONET Supplementary dataset 1.xlsx' en figshare, CC BY 4.0)"); return None
    sheets = pl.read_excel(xlsx, sheet_id=0)
    name = next((n for n in sheets if "ebird" in n.lower()), None)
    if not name:
        print(f"  · no encontré la hoja eBird en {list(sheets)}"); return None
    av = sheets[name]
    sp_col = next(c for c in av.columns if c.lower().startswith("species"))
    want = {"Mass": "masa_g", "Beak.Length_Culmen": "pico_culmen_mm", "Beak.Depth": "pico_alto_mm", "Wing.Length": "ala_mm",
            "Tail.Length": "cola_mm", "Tarsus.Length": "tarso_mm", "Hand-Wing.Index": "indice_ala_mano", "Habitat": "habitat",
            "Habitat.Density": "densidad_habitat", "Migration": "migracion_avonet", "Trophic.Level": "nivel_trofico",
            "Trophic.Niche": "nicho_trofico", "Primary.Lifestyle": "estilo_vida", "Range.Size": "rango_km2"}
    df = av.select([pl.col(sp_col).alias("sci_name")] + [pl.col(c).alias(n) for c, n in want.items() if c in av.columns])
    df = especies.select("sci_name").join(df, on="sci_name", how="left")
    df.write_csv(extra / "e05_avonet.csv"); print(f"  ✓ e05_avonet.csv ({df.drop_nulls('masa_g').height} con rasgos)")
    return df


# ─────────────────────────────────────────────────────────── 6 · xeno-canto v3
def xenocanto(especies: pl.DataFrame, extra: Path):
    key = os.environ.get("XC_KEY")
    if not key:
        print("  · sin XC_KEY: se omite (clave gratis en tu cuenta de xeno-canto.org)"); return None
    cache = Cache(extra / "cache" / "xenocanto.json"); rows = []
    rank_q = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
    for k, sci in enumerate(especies["sci_name"].to_list()):
        j = cache.get(sci)
        if j is None:
            res = get_json("https://xeno-canto.org/api/3/recordings", {"query": f'sp:"{sci}" cnt:chile', "key": key}) or {}
            recs = res.get("recordings", [])
            best = sorted(recs, key=lambda r: (rank_q.get(r.get("q"), 9), "song" not in (r.get("type") or "")))[:1]
            j = {"n": int(res.get("numRecordings") or 0), "best": best[0] if best else None,
                 "meses": [r.get("date", "")[5:7] for r in recs]}
            cache.set(sci, j); time.sleep(1)
            print(f"    {k + 1}/{especies.height} {sci}: {j['n']} grabaciones", flush=True)
            if k % 10 == 0: cache.save()
        b = j.get("best") or {}
        rows.append({"sci_name": sci, "xc_grabaciones_chile": j["n"], "xc_id": b.get("id"), "xc_tipo": b.get("type"),
                     "xc_calidad": b.get("q"), "xc_audio": b.get("file"), "xc_sonograma": (b.get("sono") or {}).get("med"),
                     "xc_autor": b.get("rec"), "xc_licencia": b.get("lic"), "xc_lugar": b.get("loc"),
                     "xc_url": f"https://xeno-canto.org/{b['id']}" if b.get("id") else None,
                     **{f"xc_mes_{m:02d}": sum(1 for x in j.get("meses", []) if x == f"{m:02d}") for m in range(1, 13)}})
    cache.save()
    df = pl.DataFrame(rows, infer_schema_length=None)
    df.write_csv(extra / "12_sonidos.csv"); print(f"  ✓ 12_sonidos.csv ({df.filter(pl.col('xc_grabaciones_chile') > 0).height} con audio)")
    return df


# ─────────────────────────────────────────────────────────── 7 · altitud de localidades (Open-Meteo)
def elevacion(tmp: Path, extra: Path, data: Path, redondeo=3, banda=250):
    sal = tmp / "salidas.parquet"
    if not sal.exists():
        print(f"  · no encuentro {sal}: corre antes build_atlas_data.py"); return None
    S = pl.read_parquet(sal).with_columns(pl.col("lat").round(redondeo).alias("la"), pl.col("lon").round(redondeo).alias("lo"))
    pts = S.select("la", "lo").unique().drop_nulls()
    cache = Cache(extra / "cache" / "elevacion.json")
    key = lambda a, b: f"{a:.{redondeo}f},{b:.{redondeo}f}"
    falta = [(a, b) for a, b in pts.iter_rows() if key(a, b) not in cache.d]
    print(f"  · {pts.height:,} puntos únicos, faltan {len(falta):,} ({-(-len(falta) // 100)} llamadas)")
    for i in range(0, len(falta), 100):
        lote = falta[i:i + 100]
        j = get_json("https://api.open-meteo.com/v1/elevation",
                     {"latitude": ",".join(str(a) for a, _ in lote), "longitude": ",".join(str(b) for _, b in lote)}, pause=5)
        if not j: continue
        for (a, b), e in zip(lote, j["elevation"]):
            cache.set(key(a, b), e)
        time.sleep(0.4)
        if (i // 100) % 20 == 0: cache.save(); print(f"    {i + len(lote):,}/{len(falta):,}")
    cache.save()
    E = pl.DataFrame([{"k": k, "elev_m": v} for k, v in cache.d.items()], schema={"k": pl.String, "elev_m": pl.Float64})
    S = S.with_columns(pl.struct("la", "lo").map_elements(lambda r: key(r["la"], r["lo"]), return_dtype=pl.String).alias("k"))
    S = S.join(E, on="k", how="left")
    S.select("salida_id", "locality_id", "lat", "lon", "elev_m").write_parquet(tmp / "salidas_elevacion.parquet")

    A = pl.read_parquet(tmp / "avist.parquet")
    SC = S.filter(pl.col("complete") & pl.col("elev_m").is_not_null()).with_columns(
        ((pl.col("elev_m").clip(0, None) / banda).floor() * banda).cast(pl.Int32).alias("banda_m"))
    den = SC.group_by("banda_m").agg(pl.len().alias("salidas_total"))
    df = (A.join(SC.select("salida_id", "banda_m"), on="salida_id")
          .group_by("sci_name", "common_name", "banda_m").agg(pl.len().alias("salidas_con"))
          .join(den, on="banda_m").filter(pl.col("salidas_total") >= 30)
          .with_columns((pl.col("salidas_con") / pl.col("salidas_total") * 100).round(4).alias("pct_salidas"))
          .sort("sci_name", "banda_m"))
    df.write_csv(data / "09_altitud.csv"); print(f"  ✓ 09_altitud.csv ({df.height:,} filas)")
    # resumen por especie: altitud mediana y rango (p10–p90) de sus salidas
    res = (A.join(SC.select("salida_id", "elev_m"), on="salida_id").group_by("sci_name").agg(
        pl.col("elev_m").median().round(0).alias("altitud_mediana_m"),
        pl.col("elev_m").quantile(0.1).round(0).alias("altitud_p10_m"),
        pl.col("elev_m").quantile(0.9).round(0).alias("altitud_p90_m")))
    res.write_csv(extra / "e07_altitud_especie.csv")
    return res


# ─────────────────────────────────────────────────────────── combinar
IUCN_ORDEN = {"LC": 0, "NT": 1, "VU": 2, "EN": 3, "CR": 4, "EW": 5, "EX": 6, "DD": -1}
WD_IUCN = {"Least Concern": "LC", "Near Threatened": "NT", "Vulnerable": "VU", "Endangered": "EN",
           "Critically Endangered": "CR", "Data Deficient": "DD", "Extinct in the Wild": "EW",
           "Preocupación menor": "LC", "Casi amenazado": "NT", "Vulnerable ": "VU", "En peligro": "EN",
           "En peligro crítico": "CR", "Datos insuficientes": "DD",
           # Wikidata entrega las etiquetas en español con esta forma (servicio de etiquetas "es,en")
           "especie bajo preocupación menor": "LC", "especie casi amenazada": "NT", "especie vulnerable": "VU",
           "especies en peligro de extinción": "EN", "especie en peligro de extinción": "EN",
           "especie en peligro crítico de extinción": "CR", "especie con datos insuficientes": "DD",
           "extinta en estado silvestre": "EW"}


def leer(extra, name):
    p = extra / name
    return pl.read_csv(p, infer_schema_length=10000) if p.exists() else None


def combinar(data: Path, extra: Path):
    E = pl.read_csv(data / "05_especies.csv", infer_schema_length=10000)
    for name in ["e01_ebird_taxonomia.csv", "e02_wikidata.csv", "e03_inaturalist.csv", "e04_iucn.csv",
                 "e05_avonet.csv", "12_sonidos.csv", "e07_altitud_especie.csv"]:
        d = leer(extra, name)
        if d is not None:
            E = E.join(d.unique("sci_name"), on="sci_name", how="left")
    col = lambda c: pl.col(c) if c in E.columns else pl.lit(None)

    # UICN: API oficial > Wikidata
    E = E.with_columns(
        pl.coalesce(col("iucn_categoria"), col("wd_iucn").replace_strict(WD_IUCN, default=None, return_dtype=pl.String)).alias("uicn"),
        pl.when(col("iucn_categoria").is_not_null()).then(pl.lit("IUCN API")).when(col("wd_iucn").is_not_null()).then(pl.lit("Wikidata")).alias("uicn_fuente"),
        pl.coalesce(col("nombre_es"), col("inat_nombre_es"), col("wd_nombre_es"), col("common_name")).alias("nombre"),
    )
    # endémica / introducida / migración, con trazabilidad
    E = E.with_columns(
        (col("wd_endemica_chile").fill_null(False) | (col("inat_establecimiento_chile") == "endemic").fill_null(False)
         | (pl.col("estatus") == "endemica")).alias("endemica"),
        pl.concat_str([pl.when(col("wd_endemica_chile").fill_null(False)).then(pl.lit("Wikidata")),
                       pl.when(col("inat_establecimiento_chile") == "endemic").then(pl.lit("iNaturalist")),
                       pl.when(pl.col("estatus") == "endemica").then(pl.lit("lista manual"))], separator=" + ", ignore_nulls=True).alias("endemica_fuente"),
        # introducida = código exótico del EBD Y iNaturalist no la considera nativa ni endémica en Chile
        # (antes era un O lógico: Tiuque, Diuca, Cachaña y otras nativas quedaban como introducidas)
        (col("exotic").is_in(["N", "P", "X"]).fill_null(False)
         & ~col("inat_establecimiento_chile").is_in(["native", "endemic"]).fill_null(False)).alias("introducida"),
        pl.when(col("migracion_avonet") == 3).then(pl.lit("migratoria"))
          .when(col("migracion_avonet") == 2).then(pl.lit("parcialmente migratoria"))
          .when(col("migracion_avonet") == 1).then(pl.lit("sedentaria")).alias("migracion_global"),
        (pl.col("estatus") == "estacional").alias("estacional_en_chile"),
    )
    ov = leer(extra, "overrides_estatus.csv")
    if ov is not None:
        for campo in ov["campo"].unique().to_list():
            m = ov.filter(pl.col("campo") == campo).select("sci_name", pl.col("valor").alias(f"_ov_{campo}"), pl.col("fuente").alias(f"_ovf_{campo}"))
            E = E.join(m, on="sci_name", how="left")
            if campo in E.columns:
                E = E.with_columns(pl.coalesce(f"_ov_{campo}", pl.col(campo).cast(pl.String)).alias(campo))
            else:
                E = E.rename({f"_ov_{campo}": campo})
            E = E.with_columns(pl.col(f"_ovf_{campo}").alias(f"{campo}_override_fuente")).drop([c for c in E.columns if c.startswith(("_ov_", "_ovf_"))])
            if f"{campo}_fuente" in E.columns:
                E = E.with_columns(pl.coalesce(f"{campo}_override_fuente", f"{campo}_fuente").alias(f"{campo}_fuente"))
    E = E.with_columns(
        pl.when(pl.col("endemica").cast(pl.String) == "true").then(pl.lit("endémica"))
          .when(pl.col("introducida").cast(pl.String) == "true").then(pl.lit("introducida"))
          .when((col("migracion_global") == "migratoria") | pl.col("estacional_en_chile")).then(pl.lit("migratoria / estacional"))
          .otherwise(pl.lit("nativa residente")).alias("estatus_final"))
    E.write_csv(data / "05b_especies_enriquecidas.csv"); print(f"  ✓ 05b_especies_enriquecidas.csv ({E.height} especies, {len(E.columns)} columnas)")

    keep = [c for c in ["sci_name", "nombre", "pct_salidas", "salidas_con", "uicn", "uicn_fuente", "iucn_tendencia", "iucn_anio",
                        "estatus_final", "endemica", "macrozona_principal", "foto_cuadrada", "foto_credito", "foto_licencia"] if c in E.columns]
    R = E.select(keep).with_columns(pl.col("uicn").replace_strict(IUCN_ORDEN, default=None, return_dtype=pl.Int8).alias("uicn_orden"))
    R.write_csv(data / "10_riesgo.csv"); print(f"  ✓ 10_riesgo.csv ({R.drop_nulls('uicn').height} con categoría)")
    if "masa_g" in E.columns:
        T = E.select([c for c in ["sci_name", "nombre", "pct_salidas", "estatus_final", "uicn", "masa_g", "pico_culmen_mm", "pico_alto_mm",
                                  "ala_mm", "tarso_mm", "indice_ala_mano", "habitat", "nicho_trofico", "nivel_trofico", "estilo_vida",
                                  "migracion_global", "altitud_mediana_m"] if c in E.columns])
        T.write_csv(data / "11_rasgos.csv"); print(f"  ✓ 11_rasgos.csv ({T.drop_nulls('masa_g').height} con rasgos)")
    P = E.filter(pl.col("migracion_global").is_null() & ~pl.col("estacional_en_chile")
                 & (pl.col("endemica").cast(pl.String) != "true")).select("sci_name", "nombre", "salidas_con", "estatus")
    P.write_csv(extra / "pendientes_estatus.csv"); print(f"  ✓ pendientes_estatus.csv ({P.height} por revisar)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=Path("data"), help="carpeta con 05_especies.csv")
    ap.add_argument("--tmp", type=Path, default=None, help="carpeta _atlas_AAAA_AAAA con los parquet (para altitud)")
    ap.add_argument("--avonet", type=Path, default=None, help="ruta al xlsx de AVONET")
    ap.add_argument("--solo", nargs="*", default=None,
                    help="ebird wikidata inat iucn avonet xenocanto elevacion (por defecto todas)")
    a = ap.parse_args()
    extra = a.data / "extra"; extra.mkdir(parents=True, exist_ok=True)
    E = pl.read_csv(a.data / "05_especies.csv", infer_schema_length=10000).select("sci_name", "common_name")
    print(f"{E.height} especies a cruzar")
    run = set(a.solo) if a.solo is not None else {"ebird", "wikidata", "inat", "iucn", "avonet", "xenocanto", "elevacion"}
    if "ebird" in run: print("→ eBird taxonomía"); ebird_taxonomia(E, extra)
    if "wikidata" in run: print("→ Wikidata"); wikidata(E, extra)
    if "inat" in run: print("→ iNaturalist (~10 min)"); inaturalist(E, extra)
    if "iucn" in run: print("→ UICN"); iucn(E, extra)
    if "avonet" in run: print("→ AVONET"); avonet(E, extra, a.avonet)
    if "xenocanto" in run: print("→ xeno-canto (~10 min)"); xenocanto(E, extra)
    if "elevacion" in run and a.tmp: print("→ Altitud (Open-Meteo)"); elevacion(a.tmp, extra, a.data)
    print("→ Combinar"); combinar(a.data, extra)


if __name__ == "__main__":
    main()