#!/usr/bin/env python3
"""
fuera_de_rango.py — ¿qué parte de los registros de eBird de cada especie cae fuera de su rango BirdLife?
=======================================================================================================
Entradas (no versionadas): rangos recortados (extraer_rangos_chile.py), equivalencias de nombres
(build_rangos.py), avist.parquet y salidas.parquet de data/raw/_atlas_2019_2025/.

Salidas:
    data/extra/e07_fuera_rango.csv                 por especie: % de salidas fuera del rango y a >10, >25, >50 km
    data/species_data/derived/fuera_rango_loc.csv  (privado) localidad × especie a >50 km del rango, para revisar

Cómo leerlo: un registro fuera de rango NO es un error. Puede ser expansión real, divagante, escape de
cautiverio, especie introducida, rango incompleto o identificación dudosa. Los rangos de BirdLife son gruesos
(p. ej. el del Zorzal patagónico termina ~30 km tierra adentro en Chile central), por eso se reportan varias
tolerancias; la de 50 km es la más fiable para hablar de "claramente fuera". Distancias aproximadas
(grados → km, sin corregir por latitud). Se publica solo el indicador agregado por especie.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np, pandas as pd, geopandas as gpd, shapely
from shapely import STRtree

TOLERANCIAS = {10: 0.09, 25: 0.225, 50: 0.45}   # km → grados (~111 km/grado)
MIN_SALIDAS = 30

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rangos", default="data/species_data/derived/botw_chile.parquet")
    ap.add_argument("--equiv", default="data/species_data/derived/equivalencias.csv")
    ap.add_argument("--raw", default="data/raw/_atlas_2019_2025")
    ap.add_argument("--extra", default="data/extra")
    ap.add_argument("--privado", default="data/species_data/derived")
    a = ap.parse_args()
    raw = Path(a.raw)

    rg = gpd.read_parquet(a.rangos)
    rg = rg[rg.presence.isin([1, 2, 3])]
    eq = pd.read_csv(a.equiv).dropna(subset=["sci_name_birdlife"]).set_index("sci_name_ebird").sci_name_birdlife.to_dict()
    sal = pd.read_parquet(raw / "salidas.parquet", columns=["salida_id", "locality_id", "lat", "lon"])
    av = pd.read_parquet(raw / "avist.parquet", columns=["salida_id", "sci_name"]).merge(sal[["salida_id", "locality_id"]], on="salida_id")
    par = av.groupby(["sci_name", "locality_id"]).size().rename("n").reset_index()
    par = par.join(sal.groupby("locality_id")[["lat", "lon"]].first(), on="locality_id")
    print(f"pares especie×localidad: {len(par):,} · especies: {par.sci_name.nunique()}")

    filas, fuera_loc = [], []
    for sp, d in par.groupby("sci_name"):
        bl = eq.get(sp, sp)
        g = rg[rg.sci_name == bl]
        tot = int(d.n.sum())
        if g.empty or tot < MIN_SALIDAS:
            continue
        geoms = shapely.make_valid(g.geometry.values)
        u = shapely.union_all(geoms)
        fuera = ~shapely.contains_xy(u, d.lon.values, d.lat.values)
        fila = dict(sci_name=sp, sci_name_birdlife=bl, salidas_con=tot, salidas_fuera=int(d.n[fuera].sum()),
                    pct_fuera=round(100 * d.n[fuera].sum() / tot, 2))
        dist = np.full(int(fuera.sum()), np.inf)
        if fuera.any():
            pts = shapely.points(d.lon.values[fuera], d.lat.values[fuera])
            tree = STRtree(shapely.get_parts(geoms))
            idx, dd = tree.query_nearest(pts, return_distance=True, all_matches=False)
            dist[idx[0]] = dd
        nf = d.n.values[fuera]
        for km, gr in TOLERANCIAS.items():
            m = dist > gr
            fila[f"salidas_fuera_{km}km"] = int(nf[m].sum())
            fila[f"pct_fuera_{km}km"] = round(100 * nf[m].sum() / tot, 2)
            fila[f"localidades_fuera_{km}km"] = int(m.sum())
        filas.append(fila)
        m50 = dist > TOLERANCIAS[50]
        if m50.any():
            x = d[fuera][m50].assign(sci_name_ebird=sp, dist_km=(dist[m50] * 111).round(0))
            fuera_loc.append(x[["sci_name_ebird", "locality_id", "lat", "lon", "n", "dist_km"]])
    out = pd.DataFrame(filas).sort_values("pct_fuera_50km", ascending=False)
    out.to_csv(Path(a.extra) / "e07_fuera_rango.csv", index=False)
    if fuera_loc: pd.concat(fuera_loc).to_csv(Path(a.privado) / "fuera_rango_loc.csv", index=False)

    print(f"\nespecies analizadas: {len(out)} (con rango y >= {MIN_SALIDAS} salidas)")
    for km in TOLERANCIAS: print(f"  >5 % de salidas a >{km} km del rango: {(out[f'pct_fuera_{km}km'] > 5).sum()} especies")
    print("\nTop 20 a >50 km (salidas >= 100):")
    print(out[out.salidas_con >= 100].head(20)[["sci_name", "salidas_con", "pct_fuera", "pct_fuera_10km", "pct_fuera_50km", "localidades_fuera_50km"]].to_string(index=False))
    print("\nMás salidas a >50 km:")
    print(out.sort_values("salidas_fuera_50km", ascending=False).head(8)[["sci_name", "salidas_con", "salidas_fuera_50km", "pct_fuera_50km"]].to_string(index=False))

if __name__ == "__main__":
    main()
