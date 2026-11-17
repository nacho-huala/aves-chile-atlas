"""Atlas de las aves nidificantes de Chile (Medrano et al. 2018) × eBird → data/15_nidificacion.csv

Entrada: data/extra/atlas_nidificacion_v3.csv (resúmenes PROPIOS por especie, escritos a partir del atlas y revisados
contra el PDF; sci_name ya está en la taxonomía de eBird, sci_atlas conserva el nombre del atlas) y 03_fenologia.csv.
Salida: una fila por especie nidificante con resumen, altitud, meses de nidificación, y su cruce con el pico de eBird.

Reglas:
  · Los meses solo se usan si la ficha no requiere revisión (requiere_revision == 'no'); si no, quedan vacíos.
  · 'coincide_pico' = el mes con más % de salidas en eBird cae dentro de los meses de nidificación del atlas.
  · 'razon_temporada' = % medio de salidas dentro de la temporada ÷ % medio fuera de ella (1 = sin diferencia).
  · El atlas es de 2011–2016 y eBird de 2019–2025: se muestran como fuentes distintas.

    python pipeline/build_nidificacion.py [--atlas data/extra/atlas_nidificacion_v3.csv] [--data data]
"""
import argparse, re
from pathlib import Path
import pandas as pd

MES = {m: i + 1 for i, m in enumerate(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
                                       "septiembre", "octubre", "noviembre", "diciembre"])}


def meses(txt):
    if not isinstance(txt, str):
        return []
    return sorted({MES[m] for m in re.findall(r"[a-z]+", txt.lower()) if m in MES})


def altitud(txt):
    n = [int(x.replace(".", "")) for x in re.findall(r"\d[\d.]*", txt)] if isinstance(txt, str) else []
    return (n[0], n[-1]) if len(n) >= 2 else (None, None)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--atlas", default="data/extra/atlas_nidificacion_v3.csv"); ap.add_argument("--data", default="data")
    a = ap.parse_args(); d = Path(a.data)
    at = pd.read_csv(a.atlas)
    fen = pd.read_csv(d / "03_fenologia.csv").pivot(index="sci_name", columns="month", values="pct_salidas")
    esp = set(pd.read_csv(d / "05_especies.csv").sci_name)
    assert at.sci_name.isin(esp).all(), "hay especies del atlas que no están en 05_especies"

    filas = []
    for r in at.itertuples():
        ok = r.requiere_revision == "no"
        m = meses(r.meses_mencionados) if ok else []
        amin, amax = altitud(r.altitud_atlas)
        pico = razon = coincide = None
        if r.sci_name in fen.index and m:
            f = fen.loc[r.sci_name].reindex(range(1, 13)).fillna(0)
            pico = int(f.idxmax())
            dentro, fuera = f[f.index.isin(m)], f[~f.index.isin(m)]
            coincide = pico in m
            razon = round(dentro.mean() / fuera.mean(), 2) if len(fuera) and fuera.mean() > 0 else None
        filas.append({"sci_name": r.sci_name, "sci_atlas": r.sci_atlas, "resumen": r.resumen_atlas,
                      "altitud_min": amin, "altitud_max": amax, "meses_nidificacion": " ".join(map(str, m)),
                      "n_meses": len(m), "pico_ebird": pico, "coincide_pico": coincide, "razon_temporada": razon,
                      "conservacion_atlas": r.conservacion_atlas, "revisar": not ok,
                      "nota": r.notas_revision if isinstance(r.notas_revision, str) else "",
                      "fuente": "Medrano et al. 2018"})
    out = pd.DataFrame(filas); out.to_csv(d / "15_nidificacion.csv", index=False)
    c = out.dropna(subset=["coincide_pico"])
    print(f"✓ 15_nidificacion.csv: {len(out)} especies · {len(c)} con meses para cruzar · {int(out.revisar.sum())} por revisar")
    print(f"  pico de eBird dentro de la temporada del atlas: {int(c.coincide_pico.sum())}/{len(c)} ({100 * c.coincide_pico.mean():.0f} %)")
    print(f"  razón de temporada: mediana {c.razon_temporada.median():.2f}; >1 en {(c.razon_temporada > 1).mean() * 100:.0f} %")
    print(f"  meses de nidificación por especie: mediana {c.n_meses.median():.0f}")


if __name__ == "__main__":
    main()
