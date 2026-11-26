"""Red de co-ocurrencia ampliada (para la lámina navegable del sitio) → data/08b_red_nodos.csv, data/08b_red_aristas.csv

Igual que la lámina 8 de build_atlas_data.py (no la reemplaza), pero con más especies y aristas más débiles, para
que el sitio deje elegir cuántas mostrar. Solo salidas COMPLETAS (las listas con todas las especies detectadas).

    lift(A, B) = P(A y B en la misma salida) / (P(A) · P(B))      → 1 = independientes; 3 = juntas el triple de lo esperado
    comunidades: Louvain sobre el grafo con peso = lift (networkx, semilla fija)

    python pipeline/build_red_ampliada.py [--top 150] [--min-lift 1.5] [--min-juntas 30]
"""
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import networkx as nx
from scipy import sparse


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw/_atlas_2019_2025"); ap.add_argument("--out", default="data")
    ap.add_argument("--top", type=int, default=150); ap.add_argument("--min-lift", type=float, default=1.5)
    ap.add_argument("--min-juntas", type=int, default=30)
    a = ap.parse_args(); raw = Path(a.raw)
    S = pd.read_parquet(raw / "salidas.parquet", columns=["salida_id", "complete"])
    ids = S.loc[S.complete.astype(bool), "salida_id"]
    A = pd.read_parquet(raw / "avist.parquet", columns=["salida_id", "sci_name"])
    A = A[A.salida_id.isin(ids) & ~A.sci_name.str.contains(r" sp\.|/| x ", regex=True)]
    n = int(ids.nunique())
    frec = A.sci_name.value_counts()
    top = frec.index[: a.top]
    A = A[A.sci_name.isin(top)]
    fila = pd.Categorical(A.salida_id).codes
    col = pd.Categorical(A.sci_name, categories=top).codes
    X = sparse.csr_matrix((np.ones(len(A), dtype=np.float32), (fila, col)), shape=(fila.max() + 1, len(top)))
    X.data[:] = 1
    C = (X.T @ X).toarray()
    p = np.diag(C) / n
    filas = []
    for i in range(len(top)):
        for j in range(i + 1, len(top)):
            if C[i, j] >= a.min_juntas:
                lift = (C[i, j] / n) / (p[i] * p[j])
                if lift >= a.min_lift:
                    filas.append((top[i], top[j], int(C[i, j]), round(float(lift), 3)))
    E = pd.DataFrame(filas, columns=["source", "target", "juntas", "lift"]).sort_values("lift", ascending=False)
    G = nx.Graph(); G.add_nodes_from(top); G.add_weighted_edges_from(E[["source", "target", "lift"]].itertuples(index=False))
    com = {s: k for k, grp in enumerate(sorted(nx.community.louvain_communities(G, weight="weight", seed=1), key=len, reverse=True)) for s in grp}
    N = pd.DataFrame({"sci_name": top, "salidas_con": [int(C[i, i]) for i in range(len(top))]})
    N["pct_salidas"] = (100 * N.salidas_con / n).round(3); N["comunidad"] = N.sci_name.map(com)
    N.to_csv(Path(a.out) / "08b_red_nodos.csv", index=False); E.to_csv(Path(a.out) / "08b_red_aristas.csv", index=False)
    print(f"✓ 08b_red: {len(N)} especies · {len(E)} vínculos (lift ≥ {a.min_lift}, ≥ {a.min_juntas} salidas juntas) · "
          f"{N.comunidad.nunique()} comunidades · {n:,} salidas completas")
    print(N.groupby("comunidad").sci_name.apply(lambda s: ", ".join(s[:5])).to_string())


if __name__ == "__main__":
    main()
