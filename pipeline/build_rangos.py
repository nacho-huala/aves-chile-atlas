#!/usr/bin/env python3
"""
build_rangos.py — cruza las especies del atlas con los rangos BirdLife/HBW (BOTW 2025)
======================================================================================
Entradas (no versionadas; términos de uso de BirdLife, ver .gitignore):
    data/species_data/derived/botw_chile.parquet   rangos recortados a Chile (extraer_rangos_chile.py)
    data/species_data/Handbook...Checklist...xlsx  lista HBW/BirdLife v10 (nombres, sinónimos, UICN 2025)
    data/raw/_atlas_2019_2025/salidas.parquet      salidas de eBird
    data/05b_especies_enriquecidas.csv             ficha maestra de especies

Salidas:
    data/extra/e06_birdlife.csv                    por especie: nombre BirdLife, UICN 2025, estacionalidad del rango
    data/species_data/derived/equivalencias.csv    (privado) tabla de nombres eBird ↔ BirdLife, para revisión manual
    data/extra/overrides_birdlife.csv              (opcional, a mano) sci_name_ebird,sci_name_birdlife

Códigos BirdLife/UICN: seasonal 1 residente, 2 reproducción, 3 no reproducción, 4 paso, 5 incierta;
origin 1 nativa, 2 reintroducida, 3 introducida, 4 divagante.
Solo se publican valores derivados por especie, nunca polígonos.
"""
from __future__ import annotations
import argparse, difflib, re
from pathlib import Path
import numpy as np, pandas as pd, geopandas as gpd
from shapely import STRtree

MIN_SALIDAS = 10   # salidas cubiertas para considerar que un tipo de rango "aplica" en Chile

def norm(s): return re.sub(r"\s+", " ", str(s)).strip()

def cargar_lista(xlsx):
    c = pd.read_excel(xlsx, header=3)
    c.columns = [norm(k) for k in c.columns]
    c = c[c["Scientific name"].notna()].copy()
    c["Scientific name"] = c["Scientific name"].map(norm)
    return c

def equivalencias(nombres, fam_ebird, lista, rangos_set, overrides):
    nombres_bl = set(lista["Scientific name"])
    syn = {}
    for _, r in lista[lista.Synonyms.notna()].iterrows():
        for s in re.split(r"[;]", str(r.Synonyms)):
            s = norm(re.sub(r"\(.*?\)", "", s))
            if len(s.split()) >= 2: syn.setdefault(" ".join(s.split()[:2]), set()).add(r["Scientific name"])
    fam = lista.set_index("Scientific name")["Family name"].to_dict()
    por_fam = lista.groupby("Family name")["Scientific name"].apply(list).to_dict()
    out = []
    for n in nombres:
        if n in overrides: out.append((n, overrides[n], "manual")); continue
        if n in nombres_bl: out.append((n, n, "directo")); continue
        s = syn.get(n)
        if s and len(s) == 1: out.append((n, next(iter(s)), "sinonimo")); continue
        if s and len(s) > 1:
            en_r = [x for x in s if x in rangos_set]
            if len(en_r) == 1: out.append((n, en_r[0], "sinonimo_con_rango")); continue
        ep = n.split()[-1]; f = fam_ebird.get(n)
        cand = [x for x in por_fam.get(f, []) if x.split()[-1] == ep]
        if len(cand) == 1: out.append((n, cand[0], "epiteto+familia")); continue
        cand = [x for x in por_fam.get(f, []) if difflib.SequenceMatcher(None, x.split()[-1], ep).ratio() >= 0.85]
        if len(cand) == 1: out.append((n, cand[0], "epiteto_aprox(REVISAR)")); continue
        out.append((n, None, "sin_resolver"))
    return pd.DataFrame(out, columns=["sci_name_ebird", "sci_name_birdlife", "metodo"])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rangos", default="data/species_data/derived/botw_chile.parquet")
    ap.add_argument("--lista", default="data/species_data/Handbook of the Birds of the World and BirdLife International Digital Checklist of the Birds of the World_Version_10.xlsx")
    ap.add_argument("--salidas", default="data/raw/_atlas_2019_2025/salidas.parquet")
    ap.add_argument("--especies", default="data/05b_especies_enriquecidas.csv")
    ap.add_argument("--extra", default="data/extra")
    ap.add_argument("--privado", default="data/species_data/derived")
    a = ap.parse_args()

    esp = pd.read_csv(a.especies); esp = esp[~esp.sci_name.str.endswith(" sp.")]
    lista = cargar_lista(a.lista)
    rg = gpd.read_parquet(a.rangos)
    rg["sci_name"] = rg.sci_name.map(norm)
    tax = pd.read_csv(Path(a.extra) / "e01_ebird_taxonomia.csv").set_index("sci_name")["familia_cientifica"].to_dict()
    ov_path = Path(a.extra) / "overrides_birdlife.csv"
    ov = dict(pd.read_csv(ov_path)[["sci_name_ebird", "sci_name_birdlife"]].values) if ov_path.exists() else {}

    eq = equivalencias(esp.sci_name.tolist(), tax, lista, set(rg.sci_name), ov)
    eq["tiene_rango"] = eq.sci_name_birdlife.isin(set(rg.sci_name))
    eq.to_csv(Path(a.privado) / "equivalencias.csv", index=False)
    print("nombres:", eq.metodo.value_counts().to_dict())
    print("con rango en la zona:", int(eq.tiene_rango.sum()), "de", len(eq))

    # salidas por localidad → cuántas salidas cubre cada polígono
    s = pd.read_parquet(a.salidas, columns=["locality_id", "lat", "lon"])
    loc = s.groupby("locality_id").agg(lat=("lat", "first"), lon=("lon", "first"), n=("lat", "size")).reset_index()
    pts = gpd.points_from_xy(loc.lon, loc.lat)
    tree = STRtree(pts)
    cub = np.zeros(len(rg), dtype=int)
    for i, geom in enumerate(rg.geometry.values):
        idx = tree.query(geom, predicate="contains")
        cub[i] = loc.n.values[idx].sum() if len(idx) else 0
    rg["salidas_cubiertas"] = cub
    rg.drop(columns="geometry").to_csv(Path(a.privado) / "rangos_cobertura.csv", index=False)

    ok = rg[(rg.presence.isin([1, 2, 3])) & (rg.salidas_cubiertas >= MIN_SALIDAS)]
    def flag(cod): return ok[ok.seasonal == cod].groupby("sci_name").salidas_cubiertas.sum()
    t = pd.DataFrame({"rango_residente": flag(1), "rango_reproduccion": flag(2),
                      "rango_no_reproduccion": flag(3), "rango_paso": flag(4)})
    t["rango_introducido"] = ok[ok.origin == 3].groupby("sci_name").salidas_cubiertas.sum()
    t = (t.fillna(0) > 0).astype(int).reset_index()

    def estatus(r):
        if r.rango_residente and r.rango_no_reproduccion: return "residente + visitante"
        if r.rango_residente: return "residente"
        if r.rango_reproduccion and r.rango_no_reproduccion: return "reproduce y pasa invierno"
        if r.rango_reproduccion: return "reproductora estival"
        if r.rango_no_reproduccion: return "visitante no reproductora"
        if r.rango_paso: return "paso"
        return "sin_clasificar"
    t["estatus_rango_chile"] = t.apply(estatus, axis=1)

    ver = rg.groupby("sci_name").agg(rango_anio=("yrcompiled", "max")).reset_index()
    u = lista[["Scientific name", "2025 IUCN Red List category"]].rename(columns={"Scientific name": "sci_name_birdlife", "2025 IUCN Red List category": "uicn_birdlife_2025"})
    out = eq.merge(u, on="sci_name_birdlife", how="left") \
            .merge(t.rename(columns={"sci_name": "sci_name_birdlife"}), on="sci_name_birdlife", how="left") \
            .merge(ver.rename(columns={"sci_name": "sci_name_birdlife"}), on="sci_name_birdlife", how="left")
    out["uicn_birdlife_2025"] = out.uicn_birdlife_2025.astype(str).str.strip().replace({"NR": np.nan, "nan": np.nan})  # NR = taxonomía no reconocida por BirdLife
    out["estatus_rango_chile"] = out.estatus_rango_chile.fillna("sin_rango_en_chile")
    out = out.rename(columns={"metodo": "birdlife_metodo_nombre"}).drop(columns="tiene_rango")
    out.to_csv(Path(a.extra) / "e06_birdlife.csv", index=False)

    cmp = esp[["sci_name", "estatus_final", "uicn", "estacional_en_chile"]].merge(out, left_on="sci_name", right_on="sci_name_ebird")
    print("\nestatus_rango_chile:\n", out.estatus_rango_chile.value_counts().to_string())
    print("\nestatus_final (atlas) × estatus_rango_chile:")
    print(pd.crosstab(cmp.estatus_final, cmp.estatus_rango_chile).to_string())
    d = cmp[cmp.uicn.notna() & cmp.uicn_birdlife_2025.notna() & (cmp.uicn != cmp.uicn_birdlife_2025)]
    print(f"\nUICN: coinciden {(cmp.uicn == cmp.uicn_birdlife_2025).sum()}, difieren {len(d)}, atlas sin dato {cmp.uicn.isna().sum()} (BirdLife lo trae para {cmp[cmp.uicn.isna()].uicn_birdlife_2025.notna().sum()})")
    print(d[["sci_name", "uicn", "uicn_birdlife_2025"]].head(15).to_string(index=False))
    print("\nsin resolver:", eq[eq.metodo == "sin_resolver"].sci_name_ebird.tolist())
    print("a revisar:", eq[eq.metodo.str.contains("REVISAR")][["sci_name_ebird", "sci_name_birdlife"]].values.tolist())

if __name__ == "__main__":
    main()
