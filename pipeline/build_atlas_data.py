"""
build_atlas_data.py — Atlas de campo · Aves en Chile
====================================================
Lee el EBD de Chile (TSV separado por tabulaciones) con polars y genera los CSV
que consumen las 8 láminas del sitio Next.js (y el PPT con datos reales).

Unidades (glosario del proyecto)
--------------------------------
* fila del EBD        = avistamiento crudo (una especie dentro de una lista de un observador)
* SALIDA              = GROUP IDENTIFIER si la lista fue compartida, si no SAMPLING EVENT IDENTIFIER.
                        Una salida compartida por 4 personas aparece 4 veces en el EBD; aquí cuenta 1.
* AVISTAMIENTO        = una especie dentro de una salida (se deduplica por salida_id + especie).
* INDIVIDUOS          = OBSERVATION COUNT (las "X" quedan como nulo + bandera x_presencia).
* % de salidas        = salidas con avistamiento ÷ salidas (solo salidas completas cuando importa
                        el denominador: fenología, ridgeline, calculadora, red).

Uso
---
    pip install polars pyarrow numpy scipy          # obligatorio
    pip install h3 networkx                         # opcional: hexágonos H3 y comunidades
    python build_atlas_data.py --tsv chile_ebd_relSep-2026.txt --out data

    # opciones
    --desde 2019 --hasta 2025        período (por defecto 2019–2025)
    --rehacer                        vuelve a construir los parquet intermedios

Salidas (carpeta --out)
-----------------------
    00_kpis.csv            cifras generales (crudo vs deduplicado)
    00_anual.csv           salidas, % completas, avistamientos y especies por año
    00_regiones.csv        por región (código ISO CL-XX) y macrozona
    01_hex.csv             lámina 1 · celdas H3 (o grilla 0,25°): salidas, especies, avistamientos
    02_ridge.csv           lámina 2 · especie × mes × franja de 0,5°: % de salidas
    03_fenologia.csv       lámina 3 · especie × mes: % de salidas completas
    04_reloj.csv           lámina 4 · mes × hora (local y solar): salidas iniciadas
    04_sol.csv             lámina 4 · amanecer/atardecer (hora local) por mes y macrozona
    05_especies.csv        lámina 5 · ficha por especie: % de salidas, observadores, estatus
    06_acumulacion.csv     lámina 6 · macrozona × duración: especies por salida (mediana, Q1, Q3)
    06_probabilidad.csv    lámina 6 · macrozona × duración × especie: probabilidad de verla
    07_marea.csv           lámina 7 · año × mes × macrozona: salidas y avistamientos
    08_nodos.csv           lámina 8 · top especies (nodos)
    08_aristas.csv         lámina 8 · pares con lift ≥ umbral (aristas)
"""
from __future__ import annotations

import argparse
import math
import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

import polars as pl

# ─────────────────────────────────────────────────────────── configuración
COLS = {
    "GLOBAL UNIQUE IDENTIFIER": "obs_id",
    "CATEGORY": "category",
    "COMMON NAME": "common_raw",
    "SCIENTIFIC NAME": "sci_raw",
    "EXOTIC CODE": "exotic",
    "OBSERVATION COUNT": "count_raw",
    "STATE": "region",
    "STATE CODE": "region_code",
    "LOCALITY ID": "locality_id",
    "LATITUDE": "lat",
    "LONGITUDE": "lon",
    "OBSERVATION DATE": "date",
    "TIME OBSERVATIONS STARTED": "time",
    "OBSERVER ID": "observer_id",
    "SAMPLING EVENT IDENTIFIER": "checklist_id",
    "GROUP IDENTIFIER": "group_id",
    "PROTOCOL NAME": "protocol",
    "DURATION MINUTES": "duration_min",
    "EFFORT DISTANCE KM": "distance_km",
    "NUMBER OBSERVERS": "n_observers",
    "ALL SPECIES REPORTED": "complete",
    "HAS MEDIA": "has_media",
    "APPROVED": "approved",
}

# Categorías que se pueden llevar a especie (subespecies, formas, intergrados, domésticas).
# Se excluyen spuh ("Larus sp."), slash ("A/B") e híbridos: no identifican una especie.
CATS_ESPECIE = ["species", "issf", "form", "intergrade", "domestic"]

# Macrozonas por código de región ISO 3166-2 (columna STATE CODE)
MACRO = {
    "CL-AP": "Norte Grande", "CL-TA": "Norte Grande", "CL-AN": "Norte Grande",
    "CL-AT": "Norte Chico", "CL-CO": "Norte Chico",
    "CL-VS": "Centro", "CL-RM": "Centro", "CL-LI": "Centro",
    "CL-ML": "Sur", "CL-NB": "Sur", "CL-BI": "Sur", "CL-AR": "Sur", "CL-LR": "Sur",
    "CL-LL": "Austral", "CL-AI": "Austral", "CL-MA": "Austral",
}
MACRO_ORDEN = ["Norte Grande", "Norte Chico", "Centro", "Sur", "Austral"]
# Punto de referencia de cada macrozona para amanecer/atardecer
MACRO_PUNTO = {"Norte Grande": (-20.2, -70.1), "Norte Chico": (-29.9, -71.25), "Centro": (-33.45, -70.65),
               "Sur": (-38.7, -72.6), "Austral": (-45.6, -72.1)}

# Endémicas de Chile (continentales e insulares). Revisar con la lista de la ROC/RACH.
ENDEMICAS = {
    "Nothoprocta perdicaria", "Mimus thenca", "Pteroptochos megapodius", "Scelorchilus albicollis",
    "Scytalopus fuscus", "Ochetorhynchus melanurus", "Pseudasthenes humicola", "Cinclodes nigrofumosus",
    "Enicognathus leptorhynchus", "Eulidia yarrellii", "Sephanoides fernandensis", "Aphrastura masafuerae",
    "Anairetes fernandezianus", "Asthenes anthoides",
}

TZ = "America/Santiago"


# ─────────────────────────────────────────────────────────── utilidades
def out_csv(df: pl.DataFrame, out: Path, name: str):
    out.mkdir(parents=True, exist_ok=True)
    df.write_csv(out / name)
    print(f"  ✓ {name:24s} {df.height:>9,} filas")


def macro_expr(col="region_code") -> pl.Expr:
    return pl.col(col).replace_strict(MACRO, default=None).alias("macrozona")


# ─────────────────────────────────────────────────────────── paso 1: parquet base
def construir_base(tsv: Path, tmp: Path, y0: int, y1: int, rehacer: bool):
    """TSV → base.parquet (avistamientos crudos válidos) → salidas.parquet + avist.parquet."""
    tmp.mkdir(parents=True, exist_ok=True)
    base, sal, avi = tmp / "base.parquet", tmp / "salidas.parquet", tmp / "avist.parquet"

    if rehacer or not base.exists():
        print("→ Leyendo TSV y escribiendo base.parquet (streaming, solo una vez)…")
        (
            pl.scan_csv(tsv, separator="\t", quote_char=None, infer_schema=False, low_memory=True)
            .select(list(COLS)).rename(COLS)
            .with_columns(
                pl.col("date").str.to_date("%Y-%m-%d", strict=False),
                pl.col("time").str.to_time("%H:%M:%S", strict=False),
                pl.col("lat", "lon", "distance_km").cast(pl.Float64, strict=False),
                pl.col("duration_min", "n_observers").cast(pl.Int32, strict=False),
                pl.col("complete", "has_media", "approved").cast(pl.Int8, strict=False).cast(pl.Boolean),
                pl.col("count_raw").cast(pl.Int64, strict=False).alias("count"),
                (pl.col("count_raw") == "X").alias("x_presencia"),
                pl.col("group_id").replace("", None),
                pl.col("exotic").replace("", None),
            )
            .filter(
                pl.col("date").dt.year().is_between(y0, y1)
                & pl.col("approved")
                & pl.col("category").is_in(CATS_ESPECIE)
            )
            .with_columns(
                # especie: primeras dos palabras del nombre científico ("Columba livia (Feral Pigeon)" → "Columba livia")
                pl.col("sci_raw").str.extract(r"^(\S+ \S+)").alias("sci_name"),
                pl.col("common_raw").str.replace(r"\s*\(.*\)$", "").alias("common_name"),
                pl.coalesce("group_id", "checklist_id").alias("salida_id"),
                pl.col("date").dt.year().alias("year"),
                pl.col("date").dt.month().alias("month"),
                macro_expr(),
            )
            .drop("count_raw", "sci_raw", "common_raw")
            .sink_parquet(base, compression="zstd")
        )

    if rehacer or not sal.exists():
        print("→ Salidas (agrupando listas compartidas)…")
        (
            pl.scan_parquet(base)
            .group_by("salida_id")
            .agg(
                pl.col("date").first(), pl.col("time").first(), pl.col("year").first(), pl.col("month").first(),
                pl.col("lat").first(), pl.col("lon").first(), pl.col("locality_id").first(),
                pl.col("region").first(), pl.col("region_code").first(), pl.col("macrozona").first(),
                pl.col("protocol").first(),
                pl.col("duration_min").max(), pl.col("distance_km").max(),
                pl.col("n_observers").max(), pl.col("complete").any(),
                pl.col("checklist_id").n_unique().alias("n_listas_ebird"),
                pl.col("observer_id").n_unique().alias("n_observadores_ebird"),
                pl.col("sci_name").n_unique().alias("riqueza"),
            )
            .sink_parquet(sal, compression="zstd")
        )

    if rehacer or not avi.exists():
        print("→ Avistamientos deduplicados (salida × especie)…")
        (
            pl.scan_parquet(base)
            .group_by("salida_id", "sci_name")
            .agg(
                pl.col("common_name").first(),
                pl.col("count").max().alias("individuos"),
                pl.col("x_presencia").all(),
                pl.col("exotic").drop_nulls().first(),
                pl.col("has_media").any(),
                pl.len().alias("filas_ebd"),
            )
            .sink_parquet(avi, compression="zstd")
        )
    return base, sal, avi


# ─────────────────────────────────────────────────────────── 00 · cifras generales
def kpis(base, S, A, out):
    b = pl.scan_parquet(base)
    raw = b.select(
        pl.len().alias("avistamientos_crudos"),
        pl.col("checklist_id").n_unique().alias("listas_ebird"),
        pl.col("observer_id").n_unique().alias("observadores"),
        pl.col("locality_id").n_unique().alias("localidades"),
        pl.col("region_code").drop_nulls().n_unique().alias("regiones"),
        pl.col("date").min().alias("desde"), pl.col("date").max().alias("hasta"),
    ).collect()
    ded = pl.DataFrame({
        "salidas": [S.height],
        "salidas_completas": [S.filter(pl.col("complete")).height],
        "avistamientos": [A.height],
        "especies": [A["sci_name"].n_unique()],
        "avistamientos_por_salida": [round(A.height / S.height, 2)],
    })
    out_csv(pl.concat([raw, ded], how="horizontal"), out, "00_kpis.csv")

    anual = (
        S.group_by("year").agg(
            pl.len().alias("salidas"),
            pl.col("complete").mean().round(4).alias("pct_completas"),
            pl.col("riqueza").mean().round(2).alias("especies_por_salida"),
        )
        .join(A.join(S.select("salida_id", "year"), on="salida_id")
              .group_by("year").agg(pl.len().alias("avistamientos"), pl.col("sci_name").n_unique().alias("especies")),
              on="year")
        .join(b.group_by("year").agg(pl.len().alias("avistamientos_crudos"),
                                     pl.col("observer_id").n_unique().alias("observadores")).collect(), on="year")
        .sort("year")
    )
    out_csv(anual, out, "00_anual.csv")

    reg = (
        S.group_by("region_code", "region", "macrozona").agg(
            pl.len().alias("salidas"), pl.col("complete").sum().alias("salidas_completas"),
            pl.col("riqueza").mean().round(2).alias("especies_por_salida"))
        .join(A.join(S.select("salida_id", "region_code"), on="salida_id")
              .group_by("region_code").agg(pl.len().alias("avistamientos"), pl.col("sci_name").n_unique().alias("especies")),
              on="region_code", how="left")
        .join(b.group_by("region_code").agg(pl.col("observer_id").n_unique().alias("observadores")).collect(),
              on="region_code", how="left")
        .filter(pl.col("region_code").is_not_null())
        .sort("salidas", descending=True)
    )
    out_csv(reg, out, "00_regiones.csv")


# ─────────────────────────────────────────────────────────── 01 · hexágonos
def lamina1(S, A, out, res=5):
    loc = S.group_by("locality_id").agg(pl.col("lat").first(), pl.col("lon").first())
    try:
        import h3
        cells = [h3.latlng_to_cell(a, o, res) for a, o in zip(loc["lat"], loc["lon"])]
        loc = loc.with_columns(pl.Series("celda", cells))
        centro = {c: h3.cell_to_latlng(c) for c in set(cells)}
        tipo = f"h3_res{res}"
    except ImportError:
        print("  · h3 no instalado: se usa grilla de 0,25° (pip install h3 para hexágonos)")
        loc = loc.with_columns(
            pl.format("{}_{}", (pl.col("lat") / 0.25).floor() * 0.25, (pl.col("lon") / 0.25).floor() * 0.25).alias("celda"))
        centro, tipo = None, "grilla_0.25"
    sc = S.join(loc.select("locality_id", "celda"), on="locality_id")
    df = (
        sc.group_by("celda").agg(pl.len().alias("salidas"), pl.col("riqueza").mean().round(2).alias("especies_por_salida"))
        .join(A.join(sc.select("salida_id", "celda"), on="salida_id")
              .group_by("celda").agg(pl.len().alias("avistamientos"), pl.col("sci_name").n_unique().alias("especies")),
              on="celda")
    )
    if centro:
        df = df.with_columns(
            pl.col("celda").map_elements(lambda c: centro[c][0], return_dtype=pl.Float64).alias("lat"),
            pl.col("celda").map_elements(lambda c: centro[c][1], return_dtype=pl.Float64).alias("lon"))
    else:
        df = df.with_columns(pl.col("celda").str.split("_").list.get(0).cast(pl.Float64).add(0.125).alias("lat"),
                             pl.col("celda").str.split("_").list.get(1).cast(pl.Float64).add(0.125).alias("lon"))
    # terciles para la bivariada (el front puede recalcularlos)
    q = lambda c: [df[c].quantile(1 / 3), df[c].quantile(2 / 3)]
    ts, te = q("salidas"), q("especies")
    df = df.with_columns(
        pl.when(pl.col("salidas") <= ts[0]).then(0).when(pl.col("salidas") <= ts[1]).then(1).otherwise(2).alias("clase_esfuerzo"),
        pl.when(pl.col("especies") <= te[0]).then(0).when(pl.col("especies") <= te[1]).then(1).otherwise(2).alias("clase_riqueza"),
        pl.lit(tipo).alias("tipo_celda"),
    )
    out_csv(df.sort("salidas", descending=True), out, "01_hex.csv")


# ─────────────────────────────────────────────────────────── 02 · ridgeline
def lamina2(S, A, out, banda=0.5, min_salidas_especie=1000, min_salidas_franja=30):
    SC = S.filter(pl.col("complete")).with_columns(((pl.col("lat") / banda).floor() * banda).alias("lat_banda"))
    den = SC.group_by("lat_banda", "month").agg(pl.len().alias("salidas_total"))
    AC = A.join(SC.select("salida_id", "lat_banda", "month"), on="salida_id")
    top = AC.group_by("sci_name").len().filter(pl.col("len") >= min_salidas_especie).select("sci_name")
    df = (
        AC.join(top, on="sci_name")
        .group_by("sci_name", "common_name", "month", "lat_banda").agg(pl.len().alias("salidas_con"))
        .join(den, on=["lat_banda", "month"])
        .filter(pl.col("salidas_total") >= min_salidas_franja)
        .with_columns((pl.col("salidas_con") / pl.col("salidas_total") * 100).round(3).alias("pct_salidas"))
        .sort("sci_name", "month", "lat_banda")
    )
    out_csv(df, out, "02_ridge.csv")


# ─────────────────────────────────────────────────────────── 03 · fenología
def lamina3(S, A, out):
    SC = S.filter(pl.col("complete"))
    den = SC.group_by("month").agg(pl.len().alias("salidas_total"))
    df = (
        A.join(SC.select("salida_id", "month"), on="salida_id")
        .group_by("sci_name", "common_name", "month").agg(pl.len().alias("salidas_con"))
        .join(den, on="month")
        .with_columns((pl.col("salidas_con") / pl.col("salidas_total") * 100).round(4).alias("pct_salidas"))
    )
    # completar meses sin avistamiento con 0
    grid = df.select("sci_name", "common_name").unique().join(den, how="cross")
    df = (grid.join(df.select("sci_name", "month", "salidas_con", "pct_salidas"), on=["sci_name", "month"], how="left")
          .with_columns(pl.col("salidas_con", "pct_salidas").fill_null(0)).sort("sci_name", "month"))
    out_csv(df, out, "03_fenologia.csv")
    return df


# ─────────────────────────────────────────────────────────── 04 · reloj
def _sol_local(fecha: dt.date, lat: float, lon: float):
    """Amanecer y atardecer (hora local decimal) con la aproximación NOAA."""
    n = fecha.timetuple().tm_yday
    g = 2 * math.pi / 365 * (n - 1)
    eq = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    dec = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
           + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    la = math.radians(lat)
    ha = math.degrees(math.acos(math.cos(math.radians(90.833)) / (math.cos(la) * math.cos(dec)) - math.tan(la) * math.tan(dec)))
    res = []
    for m in (720 - 4 * (lon + ha) - eq, 720 - 4 * (lon - ha) - eq):  # minutos UTC
        t = dt.datetime.combine(fecha, dt.time(0), tzinfo=dt.timezone.utc) + dt.timedelta(minutes=m)
        loc = t.astimezone(ZoneInfo(TZ))
        res.append(round(loc.hour + loc.minute / 60, 3))
    return res


def lamina4(S, out, anio_ref=2024):
    sc = (
        S.filter(pl.col("time").is_not_null() & ~pl.col("protocol").is_in(["Historical"])
                 & ~((pl.col("time") == dt.time(0)) & pl.col("duration_min").is_null()))
        .with_columns(
            pl.col("time").dt.hour().alias("hora_local"),
            # hora solar = UTC + longitud/15
            pl.col("date").dt.combine(pl.col("time")).dt.replace_time_zone(TZ, ambiguous="earliest", non_existent="null")
            .dt.convert_time_zone("UTC").alias("utc"),
        )
        .with_columns(((pl.col("utc").dt.hour() + pl.col("utc").dt.minute() / 60 + pl.col("lon") / 15) % 24)
                      .floor().cast(pl.Int8).alias("hora_solar"))
    )
    loc = sc.group_by("month", "hora_local").agg(pl.len().alias("salidas")).rename({"hora_local": "hora"}).with_columns(pl.lit("local").alias("reloj"))
    sol = sc.drop_nulls("hora_solar").group_by("month", "hora_solar").agg(pl.len().alias("salidas")).rename({"hora_solar": "hora"}).with_columns(pl.lit("solar").alias("reloj"))
    mac = (sc.group_by("macrozona", "month", "hora_local").agg(pl.len().alias("salidas"))
           .rename({"hora_local": "hora"}).with_columns(pl.lit("local").alias("reloj")))
    df = pl.concat([loc.with_columns(pl.lit("Chile").alias("macrozona")).select(mac.columns),
                    sol.with_columns(pl.lit("Chile").alias("macrozona"), pl.col("hora").cast(pl.Int8)).select(mac.columns),
                    mac.select(mac.columns)], how="vertical_relaxed").sort("reloj", "macrozona", "month", "hora")
    out_csv(df, out, "04_reloj.csv")

    rows = []
    for mz, (la, lo) in {"Chile": MACRO_PUNTO["Centro"], **MACRO_PUNTO}.items():
        for m in range(1, 13):
            a, b = _sol_local(dt.date(anio_ref, m, 15), la, lo)
            rows.append({"macrozona": mz, "month": m, "amanecer": a, "atardecer": b})
    out_csv(pl.DataFrame(rows), out, "04_sol.csv")


# ─────────────────────────────────────────────────────────── 05 · especies
def lamina5(base, S, A, fen, out):
    n_sal = S.height
    obs = (pl.scan_parquet(base).group_by("sci_name")
           .agg(pl.col("observer_id").n_unique().alias("observadores"),
                pl.len().alias("avistamientos_crudos")).collect())
    est = fen.group_by("sci_name").agg(
        pl.col("pct_salidas").max().alias("pct_mes_max"), pl.col("pct_salidas").min().alias("pct_mes_min"),
        pl.col("pct_salidas").mean().round(4).alias("pct_mes_media"),
        pl.col("month").sort_by("pct_salidas", descending=True).first().alias("mejor_mes"),
        pl.col("month").sort_by("pct_salidas").first().alias("peor_mes"))
    top_mz = (A.join(S.select("salida_id", "macrozona"), on="salida_id").drop_nulls("macrozona")
              .group_by("sci_name", "macrozona").len().sort("len", descending=True)
              .group_by("sci_name").agg(pl.col("macrozona").first().alias("macrozona_principal")))
    df = (
        A.join(S.select("salida_id", "date"), on="salida_id")
        .group_by("sci_name").agg(
            pl.col("common_name").first(),
            pl.len().alias("salidas_con"),
            pl.col("individuos").sum().alias("individuos_contados"),
            pl.col("individuos").median().alias("mediana_individuos"),
            pl.col("x_presencia").mean().round(4).alias("pct_conteo_x"),
            pl.col("has_media").sum().alias("salidas_con_media"),
            pl.col("exotic").drop_nulls().mode().first().alias("exotic"),
            pl.col("date").min().alias("primer_avistamiento"), pl.col("date").max().alias("ultimo_avistamiento"),
        )
        .with_columns((pl.col("salidas_con") / n_sal * 100).round(5).alias("pct_salidas"))
        .join(obs, on="sci_name", how="left").join(est, on="sci_name", how="left").join(top_mz, on="sci_name", how="left")
        .with_columns(
            (pl.col("pct_mes_max") / pl.col("pct_mes_media")).round(3).alias("indice_estacional"),
            pl.when(pl.col("sci_name").is_in(list(ENDEMICAS))).then(pl.lit("endemica"))
            .when(pl.col("exotic").is_in(["N", "P", "X"])).then(pl.lit("introducida"))
            # estacional: el mejor mes duplica con creces el promedio y el peor casi desaparece
            .when((pl.col("pct_mes_max") >= 0.2) & (pl.col("pct_mes_min") < 0.15 * pl.col("pct_mes_max"))).then(pl.lit("estacional"))
            .otherwise(pl.lit("residente")).alias("estatus"),
        )
        .sort("salidas_con", descending=True)
        .with_row_index("rango", offset=1)
    )
    out_csv(df, out, "05_especies.csv")


# ─────────────────────────────────────────────────────────── 06 · calculadora
def lamina6(S, A, out, top_k=25):
    SC = (S.filter(pl.col("complete") & pl.col("protocol").is_in(["Traveling", "Stationary"])
                   & pl.col("duration_min").is_between(5, 240) & pl.col("macrozona").is_not_null())
          .with_columns(((pl.col("duration_min") / 15).ceil() * 15).cast(pl.Int16).alias("minutos")))
    acc = (pl.concat([SC, SC.with_columns(pl.lit("Chile").alias("macrozona"))])
           .group_by("macrozona", "minutos").agg(
               pl.len().alias("salidas"),
               pl.col("riqueza").median().alias("mediana"),
               pl.col("riqueza").quantile(0.25).alias("q1"),
               pl.col("riqueza").quantile(0.75).alias("q3"),
               pl.col("riqueza").mean().round(2).alias("media"))
           .sort("macrozona", "minutos"))
    out_csv(acc, out, "06_acumulacion.csv")

    den = acc.select("macrozona", "minutos", "salidas")
    pr = (A.join(SC.select("salida_id", "macrozona", "minutos"), on="salida_id")
          .group_by("macrozona", "minutos", "sci_name", "common_name").agg(pl.len().alias("salidas_con"))
          .join(den, on=["macrozona", "minutos"])
          .with_columns((pl.col("salidas_con") / pl.col("salidas")).round(4).alias("probabilidad"))
          .filter(pl.col("probabilidad").rank("ordinal", descending=True).over("macrozona", "minutos") <= top_k)
          .sort(["macrozona", "minutos", "probabilidad"], descending=[False, False, True]))
    out_csv(pr, out, "06_probabilidad.csv")


# ─────────────────────────────────────────────────────────── 07 · marea
def lamina7(S, A, out):
    av = A.join(S.select("salida_id", "year", "month", "macrozona"), on="salida_id") \
          .group_by("year", "month", "macrozona").agg(pl.len().alias("avistamientos"))
    df = (S.group_by("year", "month", "macrozona").agg(pl.len().alias("salidas"),
                                                       pl.col("complete").sum().alias("salidas_completas"))
          .join(av, on=["year", "month", "macrozona"], how="left")
          .filter(pl.col("macrozona").is_not_null()).sort("year", "month", "macrozona"))
    out_csv(df, out, "07_marea.csv")


# ─────────────────────────────────────────────────────────── 08 · red
def lamina8(S, A, out, top_n=40, min_lift=1.3, min_juntas=50):
    import numpy as np
    from scipy import sparse
    SC = S.filter(pl.col("complete")).select("salida_id").with_row_index("i")
    AC = A.join(SC, on="salida_id")
    nodes = (AC.group_by("sci_name", "common_name").agg(pl.len().alias("salidas_con"))
             .sort("salidas_con", descending=True).head(top_n).with_row_index("j"))
    inc = AC.join(nodes.select("sci_name", "j"), on="sci_name").select("i", "j")
    n = SC.height
    M = sparse.csr_matrix((np.ones(inc.height, dtype=np.float32), (inc["i"].to_numpy(), inc["j"].to_numpy())), shape=(n, top_n))
    C = (M.T @ M).toarray()
    p = np.diag(C) / n
    rows = []
    for a in range(top_n):
        for b in range(a + 1, top_n):
            if C[a, b] < min_juntas:
                continue
            lift = (C[a, b] / n) / (p[a] * p[b])
            if lift >= min_lift:
                rows.append({"source": nodes["sci_name"][a], "target": nodes["sci_name"][b],
                             "juntas": int(C[a, b]), "lift": round(float(lift), 3)})
    edges = pl.DataFrame(rows, schema={"source": pl.String, "target": pl.String, "juntas": pl.Int64, "lift": pl.Float64})
    nodes = nodes.with_columns((pl.col("salidas_con") / n * 100).round(3).alias("pct_salidas"))
    try:
        import networkx as nx
        G = nx.Graph()
        G.add_weighted_edges_from((r["source"], r["target"], r["lift"]) for r in rows)
        com = {s: k for k, grp in enumerate(nx.community.louvain_communities(G, weight="weight", seed=1)) for s in grp}
        nodes = nodes.with_columns(pl.col("sci_name").replace_strict(com, default=None, return_dtype=pl.Int32).alias("comunidad"))
    except ImportError:
        print("  · networkx no instalado: sin columna 'comunidad'")
    out_csv(nodes.drop("j"), out, "08_nodos.csv")
    out_csv(edges.sort("lift", descending=True), out, "08_aristas.csv")


# ─────────────────────────────────────────────────────────── main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tsv", type=Path, required=True, help="archivo EBD .txt (TSV)")
    ap.add_argument("--out", type=Path, default=Path("data"))
    ap.add_argument("--tmp", type=Path, default=None, help="carpeta para parquet intermedios (por defecto junto al TSV)")
    ap.add_argument("--desde", type=int, default=2019)
    ap.add_argument("--hasta", type=int, default=2025)
    ap.add_argument("--rehacer", action="store_true")
    a = ap.parse_args()

    tmp = a.tmp or a.tsv.parent / f"_atlas_{a.desde}_{a.hasta}"
    base, sal, avi = construir_base(a.tsv, tmp, a.desde, a.hasta, a.rehacer)
    S = pl.read_parquet(sal)
    A = pl.read_parquet(avi)
    print(f"Salidas: {S.height:,} · avistamientos: {A.height:,} · especies: {A['sci_name'].n_unique():,}")

    print("→ 00 cifras generales"); kpis(base, S, A, a.out)
    print("→ 01 hexágonos"); lamina1(S, A, a.out)
    print("→ 02 ridgeline"); lamina2(S, A, a.out)
    print("→ 03 fenología"); fen = lamina3(S, A, a.out)
    print("→ 04 reloj"); lamina4(S, a.out)
    print("→ 05 especies"); lamina5(base, S, A, fen, a.out)
    print("→ 06 calculadora"); lamina6(S, A, a.out)
    print("→ 07 marea"); lamina7(S, A, a.out)
    print("→ 08 red"); lamina8(S, A, a.out)
    print(f"Listo. CSV en {a.out.resolve()}")


if __name__ == "__main__":
    main()