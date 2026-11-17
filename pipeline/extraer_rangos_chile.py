#!/usr/bin/env python3
"""
extraer_rangos_chile.py — recorta los rangos globales BirdLife/HBW (BOTW 2025, ~9 GB) a la zona de Chile
=======================================================================================================
Lee el GeoPackage por lotes (no cabe en memoria), simplifica (0,005° ~ 500 m) y recorta cada polígono a
la caja de Chile continental, Pascua y Juan Fernández, y guarda partes en data/species_data/derived/.
Es reanudable: si se corta, vuelve a correr y salta los lotes ya hechos.  Los términos de BirdLife prohíben
redistribuir estos datos: la carpeta data/species_data/ está en .gitignore.

Uso:  python pipeline/extraer_rangos_chile.py [--presupuesto 150]   (segundos por corrida)
"""
import argparse, time
from pathlib import Path
import geopandas as gpd, pandas as pd, pyogrio
from shapely.geometry import box

BBOX = (-112.0, -57.0, -64.0, -17.0)      # lon_min, lat_min, lon_max, lat_max
COLS = ["id", "sisid", "sci_name", "presence", "origin", "seasonal", "source", "generalisd", "yrcompiled", "version"]
LOTE = 40

ap = argparse.ArgumentParser()
ap.add_argument("--gpkg", default="data/species_data/BOTW_2025.gpkg")
ap.add_argument("--out", default="data/species_data/derived")
ap.add_argument("--presupuesto", type=float, default=150)
a = ap.parse_args()
t0 = time.time()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
caja = box(*BBOX)

idx = pyogrio.read_dataframe(a.gpkg, layer="all_species", bbox=BBOX, columns=["id"], read_geometry=False, fid_as_index=True)
fids = idx.index.to_numpy()          # lectura directa por fid: evita reescanear el archivo en cada lote
n = len(fids)
lotes = (n + LOTE - 1) // LOTE
print(f"{n} rangos en la caja · {lotes} lotes")
hechos = 0
for k in range(lotes):
    f = out / f"parte_{k:04d}.parquet"
    if f.exists():
        hechos += 1; continue
    if time.time() - t0 > a.presupuesto:
        print(f"presupuesto agotado: {hechos}/{lotes} lotes. Vuelve a correr para continuar."); break
    g = pyogrio.read_dataframe(a.gpkg, layer="all_species", columns=COLS, fids=fids[k * LOTE:(k + 1) * LOTE])
    g["geometry"] = g.geometry.intersection(caja).simplify(0.005, preserve_topology=True)
    g = g[~g.geometry.is_empty]
    g.to_parquet(f)
    hechos += 1
else:
    print(f"completo: {hechos}/{lotes} lotes en {time.time() - t0:.0f} s")
