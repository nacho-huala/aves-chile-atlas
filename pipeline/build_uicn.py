"""UICN Red List (descarga manual de iucnredlist.org, CSV) → data/extra/e04_iucn.csv

Cruza las 567 especies de eBird con las evaluaciones UICN de aves: nombre directo, sinónimo UICN (synonyms.csv)
y la homologación eBird↔BirdLife de build_rangos.py (equivalencias.csv, si existe).
Salida con las columnas que ya consume enrich_species.py: sci_name, iucn_categoria, iucn_anio, iucn_tendencia, iucn_url.

TÉRMINOS (IUCN Red List Terms and Conditions v3): la categoría tiene uso sin restricciones; el resto de los datos no se
puede reposicionar ni redistribuir sin permiso. Por eso data/UICN/ y data/extra/e04_iucn.csv están en .gitignore y el sitio
publica solo la categoría y, de la tendencia, el agregado por categoría (14_uicn_agregado.csv). Citar siempre con la versión de la descarga.

    python pipeline/build_uicn.py [--uicn data/UICN] [--especies data/05_especies.csv] [--out data/extra/e04_iucn.csv]
"""
import argparse
from pathlib import Path
import pandas as pd

TEND = {"Decreasing": "decreciente", "Stable": "estable", "Increasing": "creciente", "Unknown": "desconocida"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uicn", default="data/UICN"); ap.add_argument("--especies", default="data/05_especies.csv")
    ap.add_argument("--out", default="data/extra/e04_iucn.csv")
    ap.add_argument("--equiv", default="data/species_data/derived/equivalencias.csv")
    a = ap.parse_args(); U = Path(a.uicn)

    tax = pd.read_csv(U / "taxonomy.csv"); tax = tax[tax.className == "AVES"]
    ass = pd.read_csv(U / "assessments.csv", usecols=["assessmentId", "internalTaxonId", "redlistCategory", "populationTrend", "yearPublished", "scopes"])
    ass = ass[ass.scopes.str.contains("Global", na=False)]
    uic = tax.merge(ass, on="internalTaxonId")[["internalTaxonId", "scientificName", "redlistCategory", "populationTrend", "yearPublished"]]
    uic = uic.drop_duplicates("scientificName")
    por_nombre = uic.set_index("scientificName")
    sin = pd.read_csv(U / "synonyms.csv")
    sin = sin[sin.internalTaxonId.isin(uic.internalTaxonId)].merge(uic[["internalTaxonId", "scientificName"]].rename(columns={"scientificName": "vigente"}), on="internalTaxonId")
    por_sinonimo = dict(zip(sin["name"].str.replace(r"\s*\(.*$|\s+[A-Z][^a-z].*$", "", regex=True).str.strip(), sin.vigente))
    equiv = {}
    if Path(a.equiv).exists():
        e = pd.read_csv(a.equiv); equiv = dict(zip(e.sci_name_ebird, e.sci_name_birdlife))

    esp = pd.read_csv(a.especies, usecols=["sci_name"]).drop_duplicates()
    filas = []
    for s in esp.sci_name:
        for metodo, nom in (("directo", s), ("sinonimo_uicn", por_sinonimo.get(s)), ("birdlife", equiv.get(s)), ("sinonimo_uicn_birdlife", por_sinonimo.get(equiv.get(s)))):
            if nom in por_nombre.index:
                r = por_nombre.loc[nom]
                filas.append({"sci_name": s, "iucn_categoria": r.redlistCategory, "iucn_anio": int(r.yearPublished),
                              "iucn_tendencia": TEND.get(r.populationTrend), "iucn_url": f"https://www.iucnredlist.org/search?query={nom.replace(' ', '%20')}&searchType=species",
                              "uicn_nombre": nom, "uicn_metodo": metodo}); break
    out = pd.DataFrame(filas); Path(a.out).parent.mkdir(parents=True, exist_ok=True); out.to_csv(a.out, index=False)
    # Agregado publicable: especies por categoría × tendencia (sin datos por especie)
    ag = pd.crosstab(out.iucn_categoria, out.iucn_tendencia.fillna("desconocida")).reindex(columns=list(TEND.values()), fill_value=0)
    ag = ag.reindex([c for c in ["CR", "EN", "VU", "NT", "LC", "DD"] if c in ag.index]).reset_index().rename(columns={"iucn_categoria": "categoria"})
    ag.insert(1, "especies", ag[list(TEND.values())].sum(axis=1))
    ag.to_csv(Path(a.out).parents[1] / "14_uicn_agregado.csv", index=False)
    print(ag.to_string(index=False))
    print(f"✓ {a.out}: {len(out)}/{len(esp)} especies con evaluación UICN")
    print(out.uicn_metodo.value_counts().to_dict()); print(out.iucn_categoria.value_counts().to_dict())
    print("sin evaluación:", ", ".join(sorted(set(esp.sci_name) - set(out.sci_name))[:25]), "…")


if __name__ == "__main__":
    main()
