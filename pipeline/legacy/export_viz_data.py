"""
export_viz_data.py — genera los JSON de las 8 láminas del "Atlas de campo" a partir
del Parquet que crea eda_ebird.py (mismas columnas cortas: obs_id, sci_name, checklist_id, ...).

Uso:
    EBD_PATH=/ruta/chile_ebd_relSep-2026.txt python export_viz_data.py
    # o bien: python export_viz_data.py --parquet chile_ebd_relSep-2026.parquet --out public/data

Dependencias: polars, numpy, scipy (lámina 8). Opcionales: h3 (lámina 1), astral (lámina 4).
Todo se calcula en modo lazy/streaming; las salidas son JSON pequeños para Next.js (/public/data).
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import polars as pl

YEAR_MIN, YEAR_MAX = 2019, 2025
N_LISTS_TOTAL = 744_371  # control: debe coincidir con E1

# Regiones del EBD (columna STATE) -> macrozona. Se compara en minúsculas y por subcadena
MACRO = [
    ("ng", "Norte Grande", ["arica", "tarapac", "antofagasta"]),
    ("nc", "Norte Chico", ["atacama", "coquimbo"]),
    ("ce", "Centro", ["valpara", "metropolitana", "higgins"]),
    ("su", "Sur", ["maule", "ñuble", "nuble", "biob", "araucan", "los ríos", "los rios"]),
    ("au", "Austral", ["los lagos", "aysén", "aysen", "magallanes"]),
]

# Endémicas de Chile continental e insular (ajustar con la lista de la RACH/ROC)
ENDEMICAS = {
    "Mimus thenca", "Pteroptochos megapodius", "Scelorchilus albicollis",
    "Ochetorhynchus melanurus", "Nothoprocta perdicaria", "Pseudasthenes humicola",
    "Sephanoides fernandensis", "Aphrastura masafuerae", "Eulidia yarrellii",
    "Scytalopus fuscus", "Asthenes anthoides", "Leptasthenura aegithaloides",  # revisar
}

# Especies sugeridas para ridgeline y rueda (nombres científicos del EBD)
RIDGE_SPECIES = ["Elaenia albiceps", "Colorhamphus parvirostris", "Numenius hudsonicus",
                 "Sephanoides sephaniodes", "Tachycineta leucopyga", "Milvago chimango"]
PHENO_SPECIES = RIDGE_SPECIES + ["Zonotrichia capensis", "Turdus falcklandii",
                                 "Muscisaxicola maclovianus", "Ardenna grisea"]


def macro_expr() -> pl.Expr:
    r = pl.col("region").str.to_lowercase()
    expr = pl.lit(None, dtype=pl.String)
    for key, _, pats in reversed(MACRO):
        cond = pl.any_horizontal([r.str.contains(p, literal=True) for p in pats])
        expr = pl.when(cond).then(pl.lit(key)).otherwise(expr)
    return expr.alias("macro")


def load(parquet: Path) -> pl.LazyFrame:
    return (
        pl.scan_parquet(parquet)
        .with_columns(pl.col("date").dt.year().alias("year"), pl.col("date").dt.month().alias("month"))
        .filter(pl.col("year").is_between(YEAR_MIN, YEAR_MAX))
        .with_columns(macro_expr())
    )


def dump(obj, out: Path, name: str):
    out.mkdir(parents=True, exist_ok=True)
    p = out / name
    if isinstance(obj, pl.DataFrame):
        obj = obj.to_dicts()
    p.write_text(json.dumps(obj, ensure_ascii=False, default=str, separators=(",", ":")))
    print(f"  ✓ {name:24s} {p.stat().st_size/1024:8.1f} KB")


def complete_lists(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Una fila por lista completa con sus atributos de esfuerzo."""
    return (
        lf.filter(pl.col("complete"))
        .group_by("checklist_id")
        .agg(
            pl.col("lat").first(), pl.col("lon").first(), pl.col("month").first(),
            pl.col("year").first(), pl.col("macro").first(), pl.col("protocol").first(),
            pl.col("duration_min").first(), pl.col("time").first(),
            pl.col("sci_name").filter(pl.col("category") == "species").n_unique().alias("riqueza"),
        )
    )


# ---------------------------------------------------------------- Lámina 1 · hexágonos H3
def fig1_h3(lf, out, res=5):
    loc = (
        lf.group_by("locality_id")
        .agg(pl.col("lat").first(), pl.col("lon").first())
        .collect(engine="streaming")
    )
    try:
        import h3
        cells = [h3.latlng_to_cell(a, b, res) for a, b in zip(loc["lat"], loc["lon"])]
        loc = loc.with_columns(pl.Series("cell", cells))
    except ImportError:  # sin h3: grilla de 0.25° como en el EDA
        loc = loc.with_columns(
            (((pl.col("lat") / 0.25).floor() * 0.25).cast(pl.String) + "_" +
             ((pl.col("lon") / 0.25).floor() * 0.25).cast(pl.String)).alias("cell")
        )
    agg = (
        lf.join(loc.lazy().select("locality_id", "cell"), on="locality_id")
        .group_by("cell")
        .agg(
            pl.col("checklist_id").n_unique().alias("listas"),
            pl.col("sci_name").filter(pl.col("category") == "species").n_unique().alias("especies"),
            pl.col("observer_id").n_unique().alias("observadores"),
        )
        .collect(engine="streaming")
    )
    dump(agg, out, "h3_cells.json")


# ---------------------------------------------------------------- Lámina 2 · ridgeline lat × mes
def fig2_ridge(lf, out, band=0.5):
    cl = lf.filter(pl.col("complete"))
    lat_b = ((pl.col("lat") / band).floor() * band).alias("lat_b")
    denom = cl.group_by(lat_b, "month").agg(pl.col("checklist_id").n_unique().alias("total"))
    num = (
        cl.filter(pl.col("sci_name").is_in(RIDGE_SPECIES))
        .group_by("sci_name", lat_b, "month")
        .agg(pl.col("checklist_id").n_unique().alias("con_especie"))
    )
    res = (
        num.join(denom, on=["lat_b", "month"])
        .with_columns((pl.col("con_especie") / pl.col("total") * 100).round(3).alias("pct"))
        .filter(pl.col("total") >= 30)  # evita franjas con pocas listas
        .sort("sci_name", "month", "lat_b")
        .collect(engine="streaming")
    )
    dump(res, out, "lat_month_freq.json")


# ---------------------------------------------------------------- Lámina 3 · rueda fenológica
def fig3_pheno(lf, out):
    cl = lf.filter(pl.col("complete"))
    denom = cl.group_by("month").agg(pl.col("checklist_id").n_unique().alias("total"))
    res = (
        cl.filter(pl.col("sci_name").is_in(PHENO_SPECIES))
        .group_by("sci_name", "common_name", "month")
        .agg(pl.col("checklist_id").n_unique().alias("con_especie"))
        .join(denom, on="month")
        .with_columns((pl.col("con_especie") / pl.col("total") * 100).round(3).alias("pct"))
        .sort("sci_name", "month")
        .collect(engine="streaming")
    )
    dump(res, out, "phenology.json")


# ---------------------------------------------------------------- Lámina 4 · reloj hora × mes
def fig4_clock(lf, out):
    res = (
        lf.filter(pl.col("time").is_not_null())
        .group_by(pl.col("time").dt.hour().alias("hora"), "month")
        .agg(pl.col("checklist_id").n_unique().alias("listas"))
        .sort("month", "hora")
        .collect(engine="streaming")
    )
    dump(res, out, "hour_month.json")
    try:  # amanecer/atardecer en Santiago, hora local, día 15 de cada mes
        import datetime as dt
        from zoneinfo import ZoneInfo
        from astral import LocationInfo
        from astral.sun import sun
        loc = LocationInfo("Santiago", "Chile", "America/Santiago", -33.45, -70.65)
        rows = []
        for m in range(1, 13):
            s = sun(loc.observer, date=dt.date(2024, m, 15), tzinfo=ZoneInfo("America/Santiago"))
            rows.append({"month": m,
                         "sunrise": s["sunrise"].hour + s["sunrise"].minute / 60,
                         "sunset": s["sunset"].hour + s["sunset"].minute / 60})
        dump(rows, out, "sun.json")
    except ImportError:
        print("  · astral no instalado: se omite sun.json")


# ---------------------------------------------------------------- Lámina 5 · enjambre de rareza
def fig5_species(lf, out):
    n_lists = lf.select(pl.col("checklist_id").n_unique()).collect().item()
    res = (
        lf.filter(pl.col("category") == "species")
        .group_by("sci_name", "common_name")
        .agg(
            pl.col("checklist_id").n_unique().alias("listas"),
            pl.len().alias("registros"),
            pl.col("observer_id").n_unique().alias("observadores"),
            pl.col("exotic").drop_nulls().mode().first().alias("exotic"),
        )
        .with_columns(
            (pl.col("listas") / n_lists).alias("p"),
            pl.when(pl.col("sci_name").is_in(list(ENDEMICAS))).then(pl.lit("end"))
            .when(pl.col("exotic").is_in(["N", "P", "X"])).then(pl.lit("exo"))
            .otherwise(pl.lit("nat")).alias("status"),  # "mig": unir con lista de migratorias
        )
        .sort("listas", descending=True)
        .collect(engine="streaming")
    )
    dump(res, out, "species.json")


# ---------------------------------------------------------------- Lámina 6 · calculadora de salida
def fig6_accum(lf, out, top_k=15):
    cl = (
        complete_lists(lf)
        .filter(pl.col("duration_min").is_between(5, 240)
                & pl.col("protocol").is_in(["Traveling", "Stationary"]))
        .with_columns(((pl.col("duration_min") / 15).ceil() * 15).cast(pl.Int32).alias("bin"))
    )
    accum = (
        cl.group_by("macro", "bin")
        .agg(
            pl.len().alias("n"),
            pl.col("riqueza").median().alias("mediana"),
            pl.col("riqueza").quantile(0.25).alias("q1"),
            pl.col("riqueza").quantile(0.75).alias("q3"),
        )
        .sort("macro", "bin")
        .collect(engine="streaming")
    )
    dump(accum, out, "accum.json")

    lists = cl.select("checklist_id", "macro", "bin")
    denom = lists.group_by("macro", "bin").agg(pl.len().alias("total"))
    det = (
        lf.filter(pl.col("category") == "species")
        .select("checklist_id", "sci_name", "common_name")
        .join(lists, on="checklist_id")
        .group_by("macro", "bin", "sci_name", "common_name")
        .agg(pl.len().alias("con_especie"))
        .join(denom, on=["macro", "bin"])
        .with_columns((pl.col("con_especie") / pl.col("total")).alias("p"))
        .filter(pl.col("p").rank("ordinal", descending=True).over("macro", "bin") <= top_k)
        .sort("macro", "bin", "p", descending=[False, False, True])
        .collect(engine="streaming")
    )
    dump(det, out, "detect_prob.json")


# ---------------------------------------------------------------- Lámina 7 · streamgraph
def fig7_stream(lf, out):
    res = (
        lf.filter(pl.col("macro").is_not_null())
        .group_by("year", "month", "macro")
        .agg(pl.col("checklist_id").n_unique().alias("listas"))
        .sort("year", "month", "macro")
        .collect(engine="streaming")
        .pivot(on="macro", index=["year", "month"], values="listas")
        .fill_null(0)
    )
    dump(res, out, "stream.json")


# ---------------------------------------------------------------- Lámina 8 · co-ocurrencia
def fig8_cooc(lf, out, top_n=40, min_lift=1.5):
    import numpy as np
    from scipy import sparse

    sp = lf.filter(pl.col("category") == "species")
    top = (
        sp.group_by("sci_name", "common_name")
        .agg(pl.col("checklist_id").n_unique().alias("listas"))
        .sort("listas", descending=True).head(top_n)
        .collect(engine="streaming")
        .with_row_index("j")
    )
    inc = (
        sp.filter(pl.col("complete"))
        .select("checklist_id", "sci_name").unique()
        .join(top.lazy().select("sci_name", "j"), on="sci_name")
        .with_columns(pl.col("checklist_id").rank("dense").cast(pl.Int64).sub(1).alias("i"))
        .select("i", "j")
        .collect(engine="streaming")
    )
    n_lists = int(inc["i"].max()) + 1
    M = sparse.csr_matrix((np.ones(inc.height, dtype=np.float32), (inc["i"].to_numpy(), inc["j"].to_numpy())),
                          shape=(n_lists, top_n))
    C = (M.T @ M).toarray()
    p = np.diag(C) / n_lists
    edges = []
    for a in range(top_n):
        for b in range(a + 1, top_n):
            lift = (C[a, b] / n_lists) / (p[a] * p[b])
            if lift >= min_lift:
                edges.append({"source": int(a), "target": int(b), "lift": round(float(lift), 3),
                              "juntas": int(C[a, b])})
    dump(top, out, "cooc_nodes.json")
    dump(edges, out, "cooc_edges.json")
    # Comunidades: networkx.community.louvain_communities(G, weight="lift") sobre estos edges


def main():
    ap = argparse.ArgumentParser()
    default_pq = Path(os.environ.get("EBD_PATH", "chile_ebd_relSep-2026.txt")).with_suffix(".parquet")
    ap.add_argument("--parquet", type=Path, default=default_pq)
    ap.add_argument("--out", type=Path, default=Path("public/data"))
    a = ap.parse_args()

    lf = load(a.parquet)
    n = lf.select(pl.col("checklist_id").n_unique()).collect().item()
    print(f"Listas {YEAR_MIN}–{YEAR_MAX}: {n:,} (E1: {N_LISTS_TOTAL:,})")

    for f in (fig1_h3, fig2_ridge, fig3_pheno, fig4_clock, fig5_species, fig6_accum, fig7_stream, fig8_cooc):
        print(f"→ {f.__name__}")
        f(lf, a.out)


if __name__ == "__main__":
    main()