#!/usr/bin/env python3
"""
build_kba.py — cruza las salidas de eBird con los sitios KBA de Chile
=====================================================================
Entradas (ninguna se versiona; ver .gitignore):
    data/KBA_Data/KBAsGlobal_*_POL.shp, *_PNT.shp   capa KBA (BirdLife, términos de uso propios)
    data/raw/_atlas_2019_2025/salidas.parquet       una fila por salida (build_atlas_data.py)

    data/raw/_atlas_2019_2025/avist.parquet         salida × especie (opcional: habilita las tablas de especies)
    data/KBA_Data/September_2026_Trigger_*.xlsx     especies que califican cada KBA (solo uso interno)
    data/species_data/derived/equivalencias.csv     nombres eBird ↔ BirdLife (build_rangos.py), para cruzar nombres

Salidas:
    data/13_kba_sitios.csv          PÚBLICO: indicadores derivados por sitio (van al sitio web)
    data/13_kba_especies.csv        PÚBLICO: sitio × especie, % de salidas completas, mes pico (derivado de eBird)
    data/13_kba_proteccion.csv      PÚBLICO: sitios y salidas por tramo de cobertura de áreas protegidas (agregado)
    data/kba_privado/*.csv          PRIVADO (gitignored): relación localidad↔KBA y atributos KBA

Reglas de publicación (términos de uso de KBA, cláusulas 4 y 5):
    * No se publican polígonos ni coordenadas de la capa KBA.
    * El punto de cada sitio sale de eBird: celda de 0,01° (~1 km) con más salidas dentro del sitio,
      solo si la celda reúne >= MIN_LOC_CELDA localidades y >= MIN_SALIDAS_CELDA salidas
      (evita revelar localidades privadas de un solo observador).
    * Se publica solo el nombre del sitio y su identificador; clase, IBA, AZE y área van a la tabla privada.

Uso:  python pipeline/build_kba.py            (desde la raíz del repositorio)
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

CERCA_GRADOS = 0.02          # ~2 km: localidades fuera del polígono pero muy cerca (imprecisión de eBird)
MIN_LOC_CELDA = 2
MIN_SALIDAS_CELDA = 20
ANIOS = list(range(2019, 2026))


def cargar_kba(kba_dir: Path) -> gpd.GeoDataFrame:
    pol = next(kba_dir.glob("*_POL.shp"))
    pnt = next(kba_dir.glob("*_PNT.shp"))
    g = gpd.read_file(pol, where="ISO3='CHL'", engine="pyogrio")
    g["area_km2"] = g["SitAreaKM2"]
    p = gpd.read_file(pnt, where="ISO3='CHL'", engine="pyogrio")
    if len(p):  # sitios reportados como punto: se aproximan con un círculo del área reportada
        rad_deg = np.sqrt(p["RepAreaKM2"].fillna(1.0) / math.pi) / 111.0
        p["area_km2"] = p["RepAreaKM2"]
        p["geometry"] = [pt.buffer(r) for pt, r in zip(p.geometry, rad_deg)]
        p["tipo_origen"] = "punto"
    g["tipo_origen"] = "poligono"
    cols = ["SitRecID", "NatName", "IntName", "KbaClass", "IbaStatus", "AzeStatus",
            "area_km2", "tipo_origen", "geometry"]
    return gpd.GeoDataFrame(pd.concat([g[cols], p[cols]], ignore_index=True), crs="EPSG:4326")


def relacionar(salidas: pd.DataFrame, sitios: gpd.GeoDataFrame) -> pd.DataFrame:
    """Une cada localidad con los KBA que la contienen ('dentro') o la rodean a <= 2 km ('cerca')."""
    loc = salidas.groupby("locality_id", as_index=False).agg(lat=("lat", "first"), lon=("lon", "first"))
    pts = gpd.GeoDataFrame(loc, geometry=gpd.points_from_xy(loc.lon, loc.lat), crs="EPSG:4326")
    base = sitios[["SitRecID", "geometry"]]
    dentro = gpd.sjoin(pts, base, predicate="within", how="inner")[["locality_id", "SitRecID"]]
    dentro["rel"] = "dentro"
    amplios = base.copy()
    amplios["geometry"] = amplios.geometry.buffer(CERCA_GRADOS)
    cerca = gpd.sjoin(pts, amplios, predicate="within", how="inner")[["locality_id", "SitRecID"]]
    cerca = cerca.merge(dentro[["locality_id", "SitRecID"]], how="left", indicator=True, on=["locality_id", "SitRecID"])
    cerca = cerca[cerca["_merge"] == "left_only"].drop(columns="_merge")
    cerca["rel"] = "cerca"
    return pd.concat([dentro, cerca], ignore_index=True)


def punto_ebird(d: pd.DataFrame) -> pd.Series:
    """Celda de 0,01° con más salidas del sitio; publicable solo si tiene suficientes localidades y salidas."""
    c = d.assign(clat=d.lat.round(2), clon=d.lon.round(2)) \
         .groupby(["clat", "clon"]).agg(salidas=("salida_id", "nunique"), locs=("locality_id", "nunique")) \
         .reset_index().sort_values("salidas", ascending=False)
    top = c.iloc[0]
    ok = top.locs >= MIN_LOC_CELDA and top.salidas >= MIN_SALIDAS_CELDA
    return pd.Series({"punto_lat": top.clat if ok else np.nan, "punto_lon": top.clon if ok else np.nan,
                      "punto_salidas": int(top.salidas) if ok else np.nan,
                      "punto_publicable": bool(ok)})


def norm(s):
    return " ".join(str(s).split())


def cargar_gatillos(a, priv: Path, ids) -> pd.DataFrame:
    cache = priv / "kba_gatillo_chile.csv"
    if cache.exists():
        return pd.read_csv(cache)
    t = pd.read_excel(a.triggers, sheet_name="kba_triggers_species")
    t = t[t.SitRecID.isin(ids)]
    t.to_csv(cache, index=False)
    return t


def mapa_nombres(a, nombres_ebird: set) -> dict:
    """Nombre científico KBA (BirdLife/IUCN, a veces antiguo) → nombre eBird."""
    m = {n: n for n in nombres_ebird}
    man = Path("data/extra/kba_equivalencias_manual.csv")   # correcciones a mano: sci_name_kba,sci_name_ebird
    if man.exists():
        m.update(dict(pd.read_csv(man)[["sci_name_kba", "sci_name_ebird"]].values))
    eq = Path(a.equiv)
    if eq.exists():
        e = pd.read_csv(eq).dropna(subset=["sci_name_birdlife"])
        for bl, g in e.groupby("sci_name_birdlife"):
            m.setdefault(bl, g.sci_name_ebird.iloc[0])
    lista = Path(a.lista)
    if lista.exists():
        c = pd.read_excel(lista, header=3)
        c.columns = [norm(k) for k in c.columns]
        for _, r in c[c.Synonyms.notna() & c["Scientific name"].notna()].iterrows():
            destino = m.get(norm(r["Scientific name"]))
            if destino:
                for s in str(r.Synonyms).split(";"):
                    s = " ".join(s.split("(")[0].split()[:2])
                    if len(s.split()) == 2:
                        m.setdefault(s, destino)
    return m


def especies_por_sitio(pub, dentro, a, priv, ids):
    """Tabla sitio × especie (derivada de eBird) y resumen de especies 'gatillo' vistas por sitio."""
    av = pd.read_parquet(Path(a.raw) / "avist.parquet", columns=["salida_id", "sci_name"])
    av = av[~av.sci_name.str.endswith(" sp.")]
    d = dentro[["salida_id", "SitRecID", "complete", "month"]].drop_duplicates(["salida_id", "SitRecID"])
    x = av.merge(d, on="salida_id")
    den_sitio = d[d.complete].groupby("SitRecID").salida_id.nunique().rename("den_sitio").reset_index()
    den_mes = d[d.complete].groupby(["SitRecID", "month"]).salida_id.nunique().rename("den_mes").reset_index()

    g = x.groupby(["SitRecID", "sci_name"]).salida_id.nunique().rename("salidas_con").reset_index()
    gc = x[x.complete].groupby(["SitRecID", "sci_name"]).salida_id.nunique().rename("completas_con").reset_index()
    g = g.merge(gc, how="left", on=["SitRecID", "sci_name"]).merge(den_sitio, how="left", on="SitRecID")
    g["completas_con"] = g.completas_con.fillna(0).astype(int)
    g["pct_completas"] = np.where(g.den_sitio >= 20, (100 * g.completas_con / g.den_sitio).round(1), np.nan)

    mm = x[x.complete].groupby(["SitRecID", "sci_name", "month"]).salida_id.nunique().rename("n").reset_index()
    mm = mm.merge(den_mes, on=["SitRecID", "month"])
    mm = mm[mm.den_mes >= 5]
    mm["pct"] = (100 * mm.n / mm.den_mes).round(1)
    pico = mm.sort_values("pct", ascending=False).drop_duplicates(["SitRecID", "sci_name"]) \
             .rename(columns={"month": "mes_pico", "pct": "pct_mes_pico"})[["SitRecID", "sci_name", "mes_pico", "pct_mes_pico"]]
    g_all = g.merge(pico, how="left", on=["SitRecID", "sci_name"])

    # especies 'gatillo' (KBA) vistas en cada sitio: la lista de origen NO se publica, solo el porcentaje
    tr = cargar_gatillos(a, priv, ids)
    tr = tr[tr.Kingdom == "AVES"].copy()
    mapa = mapa_nombres(a, set(av.sci_name))
    tr["sci_ebird"] = tr["Scientific Name"].map(lambda n: mapa.get(norm(n)))
    sin = sorted(tr[tr.sci_ebird.isna()]["Scientific Name"].unique())
    print(f"\nGatillos aves: {tr['Scientific Name'].nunique()} especies · sin nombre eBird: {len(sin)} {sin[:12]}")
    vistos = set(zip(g_all.SitRecID, g_all.sci_name))
    tr["visto"] = [(s, e) in vistos for s, e in zip(tr.SitRecID, tr.sci_ebird)]
    tr[["SitRecID", "Scientific Name", "Common Name", "sci_ebird", "season", "kba_criteria", "RedListCategoryCode", "visto"]] \
        .to_csv(priv / "kba_gatillo_vistas.csv", index=False)
    r = tr.dropna(subset=["sci_ebird"]).drop_duplicates(["SitRecID", "sci_ebird"]) \
          .groupby("SitRecID").agg(n_gatillo_aves=("sci_ebird", "size"), gatillo_vistas=("visto", "sum")).reset_index()
    r["pct_gatillo_vistas"] = (100 * r.gatillo_vistas / r.n_gatillo_aves).round(1)

    espe = g_all.groupby("SitRecID").sci_name.nunique().rename("especies").reset_index()
    pub = pub.merge(espe.rename(columns={"SitRecID": "kba_id"}), on="kba_id", how="left") \
             .merge(r.rename(columns={"SitRecID": "kba_id"}), on="kba_id", how="left")
    pub["especies"] = pub.especies.fillna(0).astype(int)

    pubesp = g_all[g_all.salidas_con >= 3].rename(columns={"SitRecID": "kba_id"})[
        ["kba_id", "sci_name", "salidas_con", "completas_con", "pct_completas", "mes_pico", "pct_mes_pico"]]
    return pub, pubesp.sort_values(["kba_id", "salidas_con"], ascending=[True, False]), tr


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kba-dir", default="data/KBA_Data")
    ap.add_argument("--salidas", default="data/raw/_atlas_2019_2025/salidas.parquet")
    ap.add_argument("--out", default="data")
    ap.add_argument("--privado", default="data/kba_privado")
    ap.add_argument("--raw", default="data/raw/_atlas_2019_2025")
    ap.add_argument("--triggers", default="data/KBA_Data/September_2026_Trigger_Species_Ecosystems_Irreplacability_Ecological_Integrity.xlsx")
    ap.add_argument("--equiv", default="data/species_data/derived/equivalencias.csv")
    ap.add_argument("--lista", default="data/species_data/Handbook of the Birds of the World and BirdLife International Digital Checklist of the Birds of the World_Version_10.xlsx")
    a = ap.parse_args()
    out, priv = Path(a.out), Path(a.privado)
    priv.mkdir(parents=True, exist_ok=True)

    sitios = cargar_kba(Path(a.kba_dir))
    s = pd.read_parquet(a.salidas)
    print(f"KBA Chile: {len(sitios)} sitios · salidas: {len(s):,}")

    rel = relacionar(s, sitios)
    rel.to_csv(priv / "kba_localidades.csv", index=False)
    j = s.merge(rel, on="locality_id")
    dentro = j[j.rel == "dentro"]

    g = dentro.groupby("SitRecID")
    res = g.agg(salidas_dentro=("salida_id", "nunique"), localidades=("locality_id", "nunique"),
                region=("region", lambda x: x.mode().iat[0]), macrozona=("macrozona", lambda x: x.mode().iat[0]),
                primera=("date", "min"), ultima=("date", "max")).reset_index()
    comp = dentro[dentro.complete].groupby("SitRecID").agg(
        salidas_completas=("salida_id", "nunique"), riqueza_mediana=("riqueza", "median"),
        riqueza_p90=("riqueza", lambda x: x.quantile(0.9))).reset_index()
    cerca = j[j.rel == "cerca"].groupby("SitRecID").salida_id.nunique().rename("salidas_cerca").reset_index()
    porano = dentro.groupby(["SitRecID", "year"]).salida_id.nunique().unstack(fill_value=0) \
        .reindex(columns=ANIOS, fill_value=0).add_prefix("salidas_").reset_index()
    pormes = dentro.groupby(["SitRecID", "month"]).salida_id.nunique().unstack(fill_value=0) \
        .reindex(columns=range(1, 13), fill_value=0)
    pormes.columns = [f"mes_{m:02d}" for m in pormes.columns]
    pormes = pormes.reset_index()
    pto = dentro.groupby("SitRecID")[["salida_id", "locality_id", "lat", "lon"]].apply(punto_ebird).reset_index()

    pub = sitios.drop(columns="geometry")[["SitRecID", "NatName"]].rename(columns={"SitRecID": "kba_id", "NatName": "nombre"})
    for t in (res, comp, cerca, porano, pormes, pto):
        t = t.rename(columns={"SitRecID": "kba_id"})
        pub = pub.merge(t, on="kba_id", how="left")
    cnt = ["salidas_dentro", "salidas_cerca", "localidades", "salidas_completas"] + [f"salidas_{y}" for y in ANIOS] \
        + [f"mes_{m:02d}" for m in range(1, 13)]
    pub[cnt] = pub[cnt].fillna(0).astype(int)
    pub["punto_publicable"] = pub["punto_publicable"].fillna(False).astype(bool)
    pub["riqueza_mediana"] = pub["riqueza_mediana"].round(1)
    pub["riqueza_p90"] = pub["riqueza_p90"].round(1)
    tr = None
    if (Path(a.raw) / "avist.parquet").exists():
        ids = set(sitios.SitRecID)
        pub, pubesp, tr = especies_por_sitio(pub, dentro, a, priv, ids)
        pubesp.to_csv(out / "13_kba_especies.csv", index=False)
        print(f"13_kba_especies.csv: {len(pubesp):,} filas · {pubesp.kba_id.nunique()} sitios")
    pub = pub.sort_values("salidas_dentro", ascending=False)
    pub.to_csv(out / "13_kba_sitios.csv", index=False)

    # Cobertura de áreas protegidas (PA/OECM) de los KBA: solo se publica el agregado por tramo
    attr = sitios.drop(columns="geometry")
    tabla_sitios = Path(a.kba_dir) / "KBA-Sites.csv"
    if tabla_sitios.exists():
        ks = pd.read_csv(tabla_sitios).rename(columns={"SiteCode": "kba_id", "PA/OECM coverage (%)": "pa"})
        pa = pub[["kba_id", "salidas_dentro"]].merge(ks[["kba_id", "pa"]], on="kba_id").dropna(subset=["pa"])
        pa["tramo"] = pd.cut(pa.pa, [-1, 0, 50, 99.99, 100], labels=["0 %", "1–50 %", "51–99 %", "100 %"])
        r = pa.groupby("tramo", observed=True).agg(sitios=("kba_id", "count"), salidas_dentro=("salidas_dentro", "sum")).reset_index()
        r["pct_salidas_en_kba"] = (100 * r.salidas_dentro / r.salidas_dentro.sum()).round(1)
        r.to_csv(out / "13_kba_proteccion.csv", index=False)
        print("13_kba_proteccion.csv:", r.to_dict("records"))

    attr = sitios.drop(columns="geometry")
    tabla = Path(a.kba_dir) / "KBA-Sites.csv"   # descarga de la tabla de sitios del KBA Explorer (opcional)
    if tabla.exists():
        ks = pd.read_csv(tabla).rename(columns={"SiteCode": "SitRecID"})
        ks = ks[ks.Country == "Chile"].drop(columns=["Country", "Regions", "Latitude", "Longitude"])
        attr = attr.merge(ks, on="SitRecID", how="left")
    attr.to_csv(priv / "kba_atributos.csv", index=False)

    tot = s.salida_id.nunique()
    n_dentro = dentro.salida_id.nunique()
    n_cerca = j[(j.rel == "cerca") & ~j.salida_id.isin(dentro.salida_id)].salida_id.nunique()
    print(f"\nSalidas dentro de algún KBA: {n_dentro:,} ({n_dentro / tot:.1%}) · solo cerca (<=2 km): {n_cerca:,} ({n_cerca / tot:.1%})")
    print(f"Sitios con >=1 salida dentro: {(pub.salidas_dentro > 0).sum()} de {len(pub)} · sin salidas: {(pub.salidas_dentro == 0).sum()}")
    print(f"Sitios con >=20 salidas: {(pub.salidas_dentro >= 20).sum()} · con punto publicable: {pub.punto_publicable.sum()}")
    print("\nTop 12 por salidas:")
    print(pub[["nombre", "region", "salidas_dentro", "localidades", "riqueza_mediana", "punto_publicable"]].head(12).to_string(index=False))
    print("\nSitios sin salidas (muestra):", ", ".join(pub[pub.salidas_dentro == 0].nombre.head(8)))
    print("\nescrito:", out / "13_kba_sitios.csv", "y", priv)


if __name__ == "__main__":
    main()
