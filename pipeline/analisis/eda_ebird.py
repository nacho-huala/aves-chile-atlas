# /// script
# requires-python = ">=3.10"
# dependencies = ["marimo", "polars", "altair", "pyarrow"]
# ///

import marimo

__generated_with = "0.25.2"
app = marimo.App(width="medium", app_title="EDA eBird Chile")


@app.cell
def _():
    import os
    from pathlib import Path

    import altair as alt
    import marimo as mo
    import polars as pl

    alt.data_transformers.disable_max_rows()
    return Path, alt, mo, os, pl


@app.cell
def _(mo):
    mo.md("""
    # 🐦 EDA · eBird Basic Dataset — Chile

    Notebook en **marimo + polars + altair**. El `.txt` original (~4 GB, TSV) se
    convierte **una sola vez** a Parquet (streaming, sin cargar todo en RAM) y
    luego todo el análisis se hace en modo *lazy* con agregaciones pequeñas.
    """)
    return


@app.cell
def _(Path, os):
    # Ruta del EBD: variable de entorno EBD_PATH o, por defecto, junto a este script.
    AQUI = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()
    EBD_TXT = Path(os.environ.get("EBD_PATH", AQUI / "chile_ebd_relSep-2026.txt"))
    PARQUET = EBD_TXT.with_suffix(".parquet")
    return EBD_TXT, PARQUET


@app.cell
def _(EBD_TXT, PARQUET, mo, pl):
    # Columnas útiles -> nombres cortos. (Se descartan comentarios, ORCID, etc.)
    COLS = {
        "GLOBAL UNIQUE IDENTIFIER": "obs_id",
        "TAXONOMIC ORDER": "tax_order",
        "CATEGORY": "category",
        "COMMON NAME": "common_name",
        "SCIENTIFIC NAME": "sci_name",
        "EXOTIC CODE": "exotic",
        "OBSERVATION COUNT": "count_raw",
        "BREEDING CODE": "breeding_code",
        "STATE": "region",
        "COUNTY": "county",
        "LOCALITY": "locality",
        "LOCALITY ID": "locality_id",
        "LOCALITY TYPE": "locality_type",
        "LATITUDE": "lat",
        "LONGITUDE": "lon",
        "OBSERVATION DATE": "date",
        "TIME OBSERVATIONS STARTED": "time",
        "OBSERVER ID": "observer_id",
        "SAMPLING EVENT IDENTIFIER": "checklist_id",
        "PROTOCOL NAME": "protocol",
        "DURATION MINUTES": "duration_min",
        "EFFORT DISTANCE KM": "distance_km",
        "NUMBER OBSERVERS": "n_observers",
        "ALL SPECIES REPORTED": "complete",
        "HAS MEDIA": "has_media",
        "APPROVED": "approved",
        "REVIEWED": "reviewed",
    }

    def build_parquet():
        (
            pl.scan_csv(
                EBD_TXT,
                separator="\t",
                quote_char=None,  # el EBD no usa comillas
                infer_schema=False,  # todo string; casteamos nosotros
                low_memory=True,
            )
            .select(list(COLS))
            .rename(COLS)
            .with_columns(
                pl.col("count_raw").cast(pl.Int64, strict=False).alias("count"),
                (pl.col("count_raw") == "X").alias("presence_only"),
                pl.col("date").str.to_date("%Y-%m-%d", strict=False),
                pl.col("time").str.to_time("%H:%M:%S", strict=False),
                pl.col("lat", "lon", "distance_km").cast(pl.Float64, strict=False),
                pl.col("tax_order").cast(pl.Float64, strict=False),
                pl.col("duration_min", "n_observers").cast(pl.Int64, strict=False),
                pl.col("complete", "has_media", "approved", "reviewed")
                .cast(pl.Int8, strict=False)
                .cast(pl.Boolean),
            )
            .drop("count_raw")
            .sink_parquet(PARQUET, compression="zstd")
        )

    if not PARQUET.exists() or PARQUET.stat().st_mtime < EBD_TXT.stat().st_mtime:
        with mo.status.spinner(title="Convirtiendo TXT → Parquet (solo la 1ª vez)…"):
            build_parquet()

    lf_all = pl.scan_parquet(PARQUET).with_columns(
        pl.col("date").dt.year().alias("year"),
        pl.col("date").dt.month().alias("month"),
    )
    return (lf_all,)


@app.cell
def _(lf_all, pl):
    # Opciones de los filtros (consultas pequeñas sobre el Parquet)
    _y = lf_all.select(
        pl.col("year").min().alias("min"), pl.col("year").max().alias("max")
    ).collect().row(0)
    YEAR_MIN, YEAR_MAX = int(_y[0]), int(_y[1])
    REGIONS = (
        lf_all.select(pl.col("region").drop_nulls().unique().sort())
        .collect()
        .to_series()
        .to_list()
    )
    return REGIONS, YEAR_MAX, YEAR_MIN


@app.cell
def _(REGIONS, YEAR_MAX, YEAR_MIN, mo):
    f_years = mo.ui.range_slider(
        start=YEAR_MIN, stop=YEAR_MAX, step=1,
        value=[max(YEAR_MIN, 2019), YEAR_MAX],
        label="Años", show_value=True, full_width=True,
    )
    f_months = mo.ui.multiselect(
        options={"Ene": 1, "Feb": 2, "Mar": 3, "Abr": 4, "May": 5, "Jun": 6,
                 "Jul": 7, "Ago": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dic": 12},
        label="Meses (vacío = todos)",
    )
    f_regions = mo.ui.multiselect(options=REGIONS, label="Regiones (vacío = todas)")
    f_complete = mo.ui.checkbox(label="Solo listas completas (ALL SPECIES REPORTED = 1)")
    mo.vstack(
        [
            mo.md("## 🎛️ Filtros globales\nAfectan a **todas** las secciones de abajo."),
            f_years,
            mo.hstack([f_months, f_regions, f_complete], justify="start", wrap=True),
        ]
    )
    return f_complete, f_months, f_regions, f_years


@app.cell
def _(f_complete, f_months, f_regions, f_years, lf_all, mo, pl):
    _y0, _y1 = f_years.value
    lf = lf_all.filter(pl.col("year").is_between(_y0, _y1))  # excluye fechas nulas
    if f_months.value:
        lf = lf.filter(pl.col("month").is_in(f_months.value))
    if f_regions.value:
        lf = lf.filter(pl.col("region").is_in(f_regions.value))
    if f_complete.value:
        lf = lf.filter(pl.col("complete"))

    _n = lf.select(pl.len()).collect().item()
    _msg = mo.callout(
        mo.md(
            f"**Filtro activo:** {_y0}–{_y1} · "
            f"meses: {', '.join(map(str, f_months.value)) or 'todos'} · "
            f"regiones: {', '.join(f_regions.value) or 'todas'} · "
            f"{'solo listas completas' if f_complete.value else 'todas las listas'} "
            f"→ **{_n:,} registros**"
        ),
        kind="info" if _n else "danger",
    )
    mo.stop(_n == 0, _msg)  # sin datos: no se calculan las secciones siguientes
    _msg
    return (lf,)


@app.cell
def _(lf, mo, pl):
    # ---------- 1. Panorama general ----------
    _s = lf.select(
        pl.len().alias("Registros"),
        pl.col("sci_name").n_unique().alias("Taxones"),
        pl.col("checklist_id").n_unique().alias("Listas (checklists)"),
        pl.col("observer_id").n_unique().alias("Observadores"),
        pl.col("locality_id").n_unique().alias("Localidades"),
        pl.col("date").min().alias("Primera fecha"),
        pl.col("date").max().alias("Última fecha"),
    ).collect(engine="streaming")

    kpis = mo.hstack(
        [mo.stat(value=f"{v:,}" if isinstance(v, int) else str(v), label=k)
         for k, v in _s.row(0, named=True).items()],
        wrap=True,
        justify="start",
    )
    mo.vstack([mo.md("## 1. Panorama general"), kpis])
    return


@app.cell
def _(lf, mo, pl):
    # ---------- 2. Calidad de datos ----------
    _n = lf.select(pl.len()).collect().item()
    nulls = (
        lf.select(pl.all().null_count())
        .collect(engine="streaming")
        .unpivot(variable_name="columna", value_name="nulos")
        .with_columns((pl.col("nulos") / _n * 100).round(2).alias("% nulos"))
        .sort("% nulos", descending=True)
    )
    mo.vstack(
        [
            mo.md("## 2. Calidad de datos\n**Valores nulos por columna**"),
            mo.ui.table(nulls, page_size=15, selection=None),
        ]
    )
    return


@app.cell
def _(alt, lf, mo, pl):
    # Composición: categoría taxonómica, protocolo, estado de revisión
    def _bar(col, title, top=12):
        d = (
            lf.group_by(col).len().sort("len", descending=True).head(top).collect(engine="streaming")
            .with_columns(pl.col(col).fill_null("(vacío)"))
        )
        return (
            alt.Chart(d, title=title)
            .mark_bar()
            .encode(
                x=alt.X("len:Q", title="Registros"),
                y=alt.Y(f"{col}:N", sort="-x", title=None),
                tooltip=[col, alt.Tooltip("len:Q", format=",")],
            )
            .properties(width=330, height=220)
        )

    comp = alt.vconcat(
        alt.hconcat(_bar("category", "Categoría"), _bar("protocol", "Protocolo")),
        alt.hconcat(_bar("locality_type", "Tipo de localidad"), _bar("exotic", "Código exótico")),
    )
    mo.vstack([mo.md("### Composición del dataset"), comp])
    return


@app.cell
def _(alt, lf, pl):
    # Revisión / aprobación y presencia-solo ("X")
    q = (
        lf.select(
            pl.col("approved").mean().alias("Aprobados"),
            pl.col("reviewed").mean().alias("Revisados"),
            pl.col("complete").mean().alias("Lista completa"),
            pl.col("has_media").mean().alias("Con foto/audio"),
            pl.col("presence_only").mean().alias("Conteo = X"),
        )
        .collect(engine="streaming")
        .unpivot(variable_name="indicador", value_name="proporción")
    )
    ch = (
        alt.Chart(q, title="Indicadores de calidad (proporción de registros)")
        .mark_bar()
        .encode(
            x=alt.X("proporción:Q", axis=alt.Axis(format="%"), scale=alt.Scale(domain=[0, 1])),
            y=alt.Y("indicador:N", sort="-x", title=None),
            tooltip=["indicador", alt.Tooltip("proporción:Q", format=".1%")],
        )
        .properties(width=500, height=160)
    )
    ch
    return


@app.cell
def _(alt, lf, mo, pl):
    # ---------- 3. Temporal ----------
    by_year = (
        lf.filter(pl.col("year").is_not_null())
        .group_by("year")
        .agg(
            pl.len().alias("registros"),
            pl.col("checklist_id").n_unique().alias("listas"),
            pl.col("sci_name").n_unique().alias("especies"),
            pl.col("observer_id").n_unique().alias("observadores"),
        )
        .sort("year")
        .collect(engine="streaming")
    )
    _long = by_year.unpivot(index="year", variable_name="métrica", value_name="valor")
    ch_year = (
        alt.Chart(_long)
        .mark_line(point=True)
        .encode(
            x=alt.X("year:O", title="Año"),
            y=alt.Y("valor:Q", title=None, axis=alt.Axis(format="~s")),
            tooltip=["year", "métrica", alt.Tooltip("valor:Q", format=",")],
        )
        .properties(width=330, height=180)
        .facet(facet=alt.Facet("métrica:N", title=None), columns=2)
        .resolve_scale(y="independent")
    )
    mo.vstack([mo.md("## 3. Evolución temporal"), ch_year])
    return


@app.cell
def _(alt, lf, mo, pl):
    month_es = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    ym = (
        lf.filter(pl.col("year") >= 2000)
        .group_by("year", "month")
        .agg(pl.col("checklist_id").n_unique().alias("listas"))
        .collect(engine="streaming")
        .with_columns(pl.col("month").map_elements(lambda m: month_es[m - 1], return_dtype=pl.String).alias("mes"))
    )
    heat = (
        alt.Chart(ym, title="Listas por mes y año (desde 2000)")
        .mark_rect()
        .encode(
            x=alt.X("year:O", title="Año"),
            y=alt.Y("mes:N", sort=month_es, title=None),
            color=alt.Color("listas:Q", scale=alt.Scale(type="log", scheme="viridis"), title="Listas"),
            tooltip=["year", "mes", alt.Tooltip("listas:Q", format=",")],
        )
        .properties(width=560, height=260)
    )

    hour = (
        lf.filter(pl.col("time").is_not_null())
        .group_by(pl.col("time").dt.hour().alias("hora"))
        .agg(pl.col("checklist_id").n_unique().alias("listas"))
        .sort("hora")
        .collect(engine="streaming")
    )
    ch_hour = (
        alt.Chart(hour, title="Hora de inicio de las listas")
        .mark_bar()
        .encode(x=alt.X("hora:O", title="Hora"), y=alt.Y("listas:Q", title="Listas"),
                tooltip=["hora", alt.Tooltip("listas:Q", format=",")])
        .properties(width=560, height=200)
    )
    mo.vstack([heat, ch_hour])
    return (month_es,)


@app.cell
def _(alt, lf, mo, pl):
    # ---------- 4. Especies ----------
    sp = (
        lf.filter(pl.col("category") == "species")
        .group_by("common_name", "sci_name")
        .agg(
            pl.len().alias("registros"),
            pl.col("checklist_id").n_unique().alias("listas"),
            pl.col("observer_id").n_unique().alias("observadores"),
            pl.col("locality_id").n_unique().alias("localidades"),
            pl.col("count").sum().alias("individuos"),
            pl.col("date").min().alias("primer_registro"),
            pl.col("date").max().alias("último_registro"),
        )
        .sort("registros", descending=True)
        .collect(engine="streaming")
    )
    top = sp.head(25)
    ch_top = (
        alt.Chart(top, title="Top 25 especies por número de registros")
        .mark_bar()
        .encode(
            x=alt.X("registros:Q", title="Registros", axis=alt.Axis(format="~s")),
            y=alt.Y("common_name:N", sort="-x", title=None),
            tooltip=["common_name", "sci_name", alt.Tooltip("registros:Q", format=","),
                     alt.Tooltip("listas:Q", format=","), alt.Tooltip("individuos:Q", format=",")],
        )
        .properties(width=520, height=480)
    )
    # Curva rango-abundancia (log-log): evidencia la cola larga
    rank = sp.with_row_index("rango", offset=1)
    ch_rank = (
        alt.Chart(rank, title="Rango–abundancia (escala log)")
        .mark_line()
        .encode(
            x=alt.X("rango:Q", scale=alt.Scale(type="log"), title="Rango de la especie"),
            y=alt.Y("registros:Q", scale=alt.Scale(type="log"), title="Registros"),
            tooltip=["rango", "common_name", alt.Tooltip("registros:Q", format=",")],
        )
        .properties(width=420, height=300)
    )
    _raras = int((sp["registros"] < 10).sum())
    mo.vstack(
        [
            mo.md(f"## 4. Especies\n**{sp.height:,}** especies; **{_raras:,}** con < 10 registros (cola larga)."),
            mo.hstack([ch_top, ch_rank], wrap=True),
            mo.md("**Tabla completa de especies** (ordenable / filtrable)"),
            mo.ui.table(sp, page_size=10, selection=None),
        ]
    )
    return (sp,)


@app.cell
def _(alt, lf, mo, pl):
    # ---------- 5. Geografía ----------
    reg = (
        lf.group_by("region")
        .agg(
            pl.len().alias("registros"),
            pl.col("checklist_id").n_unique().alias("listas"),
            pl.col("sci_name").n_unique().alias("especies"),
        )
        .sort("registros", descending=True)
        .collect(engine="streaming")
        .with_columns(pl.col("region").fill_null("(sin región)"))
    )
    _l = reg.unpivot(index="region", on=["listas", "especies"], variable_name="métrica", value_name="valor")
    ch_reg = (
        alt.Chart(_l, title="Listas y riqueza de especies por región")
        .mark_bar()
        .encode(
            x=alt.X("valor:Q", title=None, axis=alt.Axis(format="~s")),
            y=alt.Y("region:N", sort=alt.EncodingSortField("valor", op="max", order="descending"), title=None),
            color="métrica:N",
            yOffset="métrica:N",
            tooltip=["region", "métrica", alt.Tooltip("valor:Q", format=",")],
        )
        .properties(width=520, height=420)
    )

    # Mapa: grilla de 0.25° (≈25 km); tamaño = listas, color = riqueza
    grid = (
        lf.filter(pl.col("lat").is_between(-56, -17) & pl.col("lon").is_between(-110, -66))
        .group_by(
            (pl.col("lat") / 0.25).floor().mul(0.25).alias("lat_c"),
            (pl.col("lon") / 0.25).floor().mul(0.25).alias("lon_c"),
        )
        .agg(pl.col("checklist_id").n_unique().alias("listas"), pl.col("sci_name").n_unique().alias("especies"))
        .collect(engine="streaming")
    )
    ch_map = (
        alt.Chart(grid, title="Esfuerzo (tamaño) y riqueza (color) por celda de 0.25°")
        .mark_circle(opacity=0.8)
        .encode(
            x=alt.X("lon_c:Q", scale=alt.Scale(domain=[-77, -66]), title="Longitud"),
            y=alt.Y("lat_c:Q", scale=alt.Scale(domain=[-56, -17]), title="Latitud"),
            size=alt.Size("listas:Q", scale=alt.Scale(type="sqrt", range=[8, 400]), title="Listas"),
            color=alt.Color("especies:Q", scale=alt.Scale(scheme="viridis"), title="Especies"),
            tooltip=["lat_c", "lon_c", alt.Tooltip("listas:Q", format=","), "especies"],
        )
        .properties(width=240, height=620)
    )
    mo.vstack(
        [mo.md("## 5. Geografía"), mo.hstack([ch_reg, ch_map], wrap=True, align="start")]
    )
    return


@app.cell
def _(alt, lf, mo, pl):
    # ---------- 6. Esfuerzo y observadores ----------
    # Una fila por lista (checklist): riqueza, duración, distancia
    cl = (
        lf.group_by("checklist_id")
        .agg(
            pl.col("sci_name").n_unique().alias("riqueza"),
            pl.col("duration_min").first(),
            pl.col("distance_km").first(),
            pl.col("complete").first(),
            pl.col("protocol").first(),
            pl.col("observer_id").first(),
        )
        .collect(engine="streaming")
    )

    def _hist2(col, title, maxbin, step):
        d = (
            cl.filter(pl.col(col).is_not_null() & (pl.col(col) > 0) & (pl.col(col) <= maxbin))
            .group_by((pl.col(col) / step).floor().mul(step).alias("inicio"))
            .len()
            .sort("inicio")
            .with_columns((pl.col("inicio") + step).alias("fin"))
        )
        return (
            alt.Chart(d, title=title)
            .mark_bar()
            .encode(
                x=alt.X("inicio:Q", title=col),
                x2="fin:Q",
                y=alt.Y("len:Q", title="Listas"),
                tooltip=["inicio", "fin", alt.Tooltip("len:Q", format=",")],
            )
            .properties(width=330, height=200)
        )

    h_rich = _hist2("riqueza", "Riqueza por lista (nº especies)", 100, 2)
    h_dur = _hist2("duration_min", "Duración (min, ≤ 360)", 360, 10)
    h_dist = _hist2("distance_km", "Distancia (km, ≤ 20)", 20, 0.5)

    # Riqueza vs duración (solo listas completas con duración)
    rd = (
        cl.filter(pl.col("complete") & pl.col("duration_min").is_between(1, 300))
        .group_by((pl.col("duration_min") / 10).floor().mul(10).alias("duración"))
        .agg(
            pl.col("riqueza").median().alias("mediana"),
            pl.col("riqueza").quantile(0.25).alias("q1"),
            pl.col("riqueza").quantile(0.75).alias("q3"),
        )
        .sort("duración")
    )
    _base = alt.Chart(rd).encode(x=alt.X("duración:Q", title="Duración (min)"))
    ch_rd = (
        _base.mark_area(opacity=0.25).encode(y=alt.Y("q1:Q", title="Riqueza"), y2="q3:Q")
        + _base.mark_line(point=True).encode(y="mediana:Q", tooltip=["duración", "mediana", "q1", "q3"])
    ).properties(width=330, height=200, title="Riqueza vs duración (mediana y IQR, listas completas)")

    obs = (
        cl.group_by("observer_id").agg(pl.len().alias("listas")).sort("listas", descending=True)
    )
    ch_obs = (
        alt.Chart(obs.head(20), title="Top 20 observadores (nº de listas)")
        .mark_bar()
        .encode(x=alt.X("listas:Q", title="Listas"), y=alt.Y("observer_id:N", sort="-x", title=None),
                tooltip=["observer_id", alt.Tooltip("listas:Q", format=",")])
        .properties(width=330, height=320)
    )
    _top1 = obs.head(max(1, int(obs.height * 0.01)))["listas"].sum() / obs["listas"].sum()
    mo.vstack(
        [
            mo.md(
                f"## 6. Esfuerzo y observadores\n{obs.height:,} observadores; "
                f"el 1 % más activo aporta **{_top1:.0%}** de las listas."
            ),
            mo.hstack([h_rich, h_dur, h_dist, ch_rd, ch_obs], wrap=True, align="start"),
        ]
    )
    return


@app.cell
def _(alt, lf, mo, pl):
    # ---------- 7. Abundancias ----------
    ab = (
        lf.filter(pl.col("count").is_not_null() & (pl.col("count") > 0))
        .group_by(pl.col("count").log10().floor().cast(pl.Int32).alias("log10"))
        .len()
        .sort("log10")
        .collect(engine="streaming")
        .with_columns(("10^" + pl.col("log10").cast(pl.String)).alias("orden"))
    )
    ch_ab = (
        alt.Chart(ab, title="Distribución del conteo por registro (órdenes de magnitud)")
        .mark_bar()
        .encode(
            x=alt.X("orden:N", sort=alt.EncodingSortField("log10"), title="Individuos por registro"),
            y=alt.Y("len:Q", title="Registros", axis=alt.Axis(format="~s")),
            tooltip=["orden", alt.Tooltip("len:Q", format=",")],
        )
        .properties(width=500, height=240)
    )
    mo.vstack([mo.md("## 7. Abundancias"), ch_ab])
    return


@app.cell
def _(mo, sp):
    # ---------- 8. Explorador por especie (interactivo) ----------
    sp_pick = mo.ui.dropdown(
        options=sp.head(300)["common_name"].to_list(),
        value=sp["common_name"][0],
        label="Especie (top 300)",
        searchable=True,
    )
    mo.vstack([mo.md("## 8. Explorador por especie"), sp_pick])
    return (sp_pick,)


@app.cell
def _(alt, lf, mo, month_es, pl, sp_pick):
    _sel = sp_pick.value
    # Frecuencia de reporte mensual = listas con la especie / listas totales del mes
    _tot = lf.group_by("month").agg(pl.col("checklist_id").n_unique().alias("total"))
    freq = (
        lf.filter(pl.col("common_name") == _sel)
        .group_by("month")
        .agg(pl.col("checklist_id").n_unique().alias("con_especie"))
        .join(_tot, on="month")
        .with_columns((pl.col("con_especie") / pl.col("total")).alias("frecuencia"))
        .sort("month")
        .collect(engine="streaming")
        .with_columns(pl.col("month").map_elements(lambda m: month_es[m - 1], return_dtype=pl.String).alias("mes"))
    )
    pts = (
        lf.filter(pl.col("common_name") == _sel)
        .group_by(
            (pl.col("lat") / 0.25).floor().mul(0.25).alias("lat_c"),
            (pl.col("lon") / 0.25).floor().mul(0.25).alias("lon_c"),
        )
        .agg(pl.len().alias("registros"))
        .collect(engine="streaming")
    )
    c1 = (
        alt.Chart(freq, title=f"Estacionalidad · {_sel}")
        .mark_bar()
        .encode(
            x=alt.X("mes:N", sort=month_es, title=None),
            y=alt.Y("frecuencia:Q", axis=alt.Axis(format="%"), title="% de listas con la especie"),
            tooltip=["mes", alt.Tooltip("frecuencia:Q", format=".1%"), "con_especie"],
        )
        .properties(width=380, height=280)
    )
    c2 = (
        alt.Chart(pts, title=f"Distribución · {_sel}")
        .mark_circle(opacity=0.7)
        .encode(
            x=alt.X("lon_c:Q", scale=alt.Scale(domain=[-77, -66]), title="Longitud"),
            y=alt.Y("lat_c:Q", scale=alt.Scale(domain=[-56, -17]), title="Latitud"),
            size=alt.Size("registros:Q", scale=alt.Scale(type="sqrt", range=[10, 300])),
            color=alt.value("#2a7f62"),
            tooltip=["lat_c", "lon_c", alt.Tooltip("registros:Q", format=",")],
        )
        .properties(width=200, height=420)
    )
    mo.hstack([c1, c2], wrap=True, align="start")
    return


@app.cell
def _(mo):
    mo.md("""
    ---
    **Notas**
    - Para otra ruta: `EBD_PATH=/ruta/al/archivo.txt marimo edit eda_ebird.py`.
    - Si cambia el `.txt` (nueva release), el Parquet se regenera automáticamente.
    - Sesgos típicos del EBD a tener presentes: esfuerzo concentrado en la zona central
      y en pocos observadores, crecimiento fuerte de listas en los últimos años y
      registros `X` (presencia sin conteo).
    """)
    return


if __name__ == "__main__":
    app.run()
