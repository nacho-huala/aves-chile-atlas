"""
export_web.py — paso 3 del pipeline: CSV de data/ → JSON para el sitio Next.js
============================================================================
Reemplaza a prep_web_data.py. Solo usa la biblioteca estándar de Python (csv, json),
así que corre en cualquier entorno sin instalar nada.

Uso (desde la raíz del repositorio):
    python pipeline/export_web.py                 # data/ → web/public/data/
    python pipeline/export_web.py --data data --out web/public/data

Salidas (contrato de datos con web/lib/data.ts; si cambias un campo, cambia también los tipos):
    resumen.json              cifras de control y serie anual
    marea.json                salidas por año, mes y macrozona
    calculadora.json          especies por salida (mediana, Q1, Q3) y probabilidad por especie
    especies.json             índice de especies (una fila por especie, para listas y búsqueda)
    especies/<slug>.json      ficha de cada especie (foto, canto, fenología, rasgos, enlaces)

Reglas que aplica (documentadas en README.md):
    * Excluye nombres terminados en " sp." (no identifican especie) → 566 especies.
    * Calculadora: excluye Norte Grande ≥ 180 min (1.655 salidas con una sola especie,
      probable monitoreo de una especie).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path

MACRO = ["Norte Grande", "Norte Chico", "Centro", "Sur", "Austral"]


def leer(p: Path) -> list[dict]:
    with p.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def num(x, nd=None):
    """'' o 'NaN' → None; si no, float (o int si es entero), redondeado a nd decimales."""
    if x is None or x == "" or x.lower() in ("nan", "null", "none"):
        return None
    v = float(x)
    if nd is not None:
        v = round(v, nd)
    return int(v) if v.is_integer() and nd in (None, 0) else v


def txt(x):
    return x if x not in (None, "", "NaN", "nan") else None


def slug(sci: str) -> str:
    s = unicodedata.normalize("NFKD", sci).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def escribir(obj, p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--out", type=Path, default=Path("web/public/data"))
    a = ap.parse_args()
    d, out = a.data, a.out

    # ─────────────── especies (índice + fichas)
    enr = [r for r in leer(d / "05b_especies_enriquecidas.csv") if not r["sci_name"].endswith(" sp.")]
    validas = {r["sci_name"] for r in enr}
    fen: dict[str, list] = {}
    for r in leer(d / "03_fenologia.csv"):
        if r["sci_name"] in validas:
            fen.setdefault(r["sci_name"], [None] * 12)[int(r["month"]) - 1] = num(r["pct_salidas"], 3)

    indice, fichas = [], 0
    for r in sorted(enr, key=lambda r: -float(r["salidas_con"])):
        s = slug(r["sci_name"])
        base = {
            "slug": s, "sci": r["sci_name"], "nombre": txt(r["nombre"]) or r["common_name"],
            "familia": txt(r["familia"]), "pct": num(r["pct_salidas"], 4), "salidas": num(r["salidas_con"], 0),
            "estatus": txt(r["estatus_final"]), "uicn": txt(r["uicn"]), "foto": txt(r["foto_cuadrada"]),
            "mejorMes": num(r["mejor_mes"], 0),
        }
        indice.append(base)
        ficha = {
            **base,
            "nombreIngles": r["common_name"],
            "orden": txt(r["orden"]),
            "observadores": num(r["observadores"], 0),
            "macrozona": txt(r["macrozona_principal"]),
            "endemica": r["endemica"] == "true",
            "primerAvistamiento": txt(r["primer_avistamiento"]), "ultimoAvistamiento": txt(r["ultimo_avistamiento"]),
            "fenologia": fen.get(r["sci_name"]),  # % de salidas completas por mes (ene → dic); null si no hay
            "imagen": {"url": txt(r["foto_url"]), "credito": txt(r["foto_credito"]), "licencia": txt(r["foto_licencia"])},
            "canto": None if not txt(r["xc_audio"]) else {
                "audio": r["xc_audio"], "tipo": txt(r["xc_tipo"]), "calidad": txt(r["xc_calidad"]),
                "autor": txt(r["xc_autor"]), "licencia": txt(r["xc_licencia"]), "url": txt(r["xc_url"]),
                "grabacionesChile": num(r["xc_grabaciones_chile"], 0)},
            "rasgos": {"masaG": num(r["masa_g"], 1), "picoMm": num(r["pico_culmen_mm"], 1), "alaMm": num(r["ala_mm"], 1),
                       "habitat": txt(r["habitat"]), "dieta": txt(r["nicho_trofico"]), "estiloVida": txt(r["estilo_vida"]),
                       "migracion": txt(r["migracion_global"])},
            "enlaces": {"ebird": txt(r["url_ebird"]), "wikipedia": txt(r["wikipedia_url"]),
                        "inaturalist": f"https://www.inaturalist.org/taxa/{int(float(r['inat_id']))}" if txt(r["inat_id"]) else None},
        }
        escribir(ficha, out / "especies" / f"{s}.json"); fichas += 1
    escribir(indice, out / "especies.json")
    nombre = {r["sci_name"]: (slug(r["sci_name"]), txt(r["nombre"]) or r["common_name"]) for r in enr}

    # ─────────────── resumen
    k = leer(d / "00_kpis.csv")[0]
    resumen = {
        "desde": k["desde"], "hasta": k["hasta"], "salidas": num(k["salidas"], 0),
        "salidasCompletas": num(k["salidas_completas"], 0), "avistamientos": num(k["avistamientos"], 0),
        "avistamientosCrudos": num(k["avistamientos_crudos"], 0), "listasEbird": num(k["listas_ebird"], 0),
        "especies": len(enr), "observadores": num(k["observadores"], 0), "localidades": num(k["localidades"], 0),
        "anual": [{"anio": num(r["year"], 0), "salidas": num(r["salidas"], 0), "observadores": num(r["observadores"], 0),
                   "especiesPorSalida": num(r["especies_por_salida"], 2)} for r in leer(d / "00_anual.csv")],
        "fuente": "eBird Basic Dataset relSep-2026 · Cornell Lab of Ornithology",
    }
    escribir(resumen, out / "resumen.json")

    # ─────────────── marea
    escribir([{"anio": num(r["year"], 0), "mes": num(r["month"], 0), "macrozona": r["macrozona"],
               "salidas": num(r["salidas"], 0)} for r in leer(d / "07_marea.csv")], out / "marea.json")

    # ─────────────── calculadora
    excluir = lambda z, m: z == "Norte Grande" and m >= 180
    acum: dict = {}
    for r in leer(d / "06_acumulacion.csv"):
        z, m = r["macrozona"], int(r["minutos"])
        if excluir(z, m):
            continue
        acum.setdefault(z, {})[m] = {"n": num(r["salidas"], 0), "mediana": num(r["mediana"], 1),
                                     "q1": num(r["q1"], 1), "q3": num(r["q3"], 1)}
    prob: dict = {}
    for r in leer(d / "06_probabilidad.csv"):
        z, m = r["macrozona"], int(r["minutos"])
        if excluir(z, m) or r["sci_name"] not in nombre:
            continue
        s, n = nombre[r["sci_name"]]
        prob.setdefault(z, {}).setdefault(m, []).append({"slug": s, "nombre": n, "p": num(r["probabilidad"], 3)})
    zonas = [z for z in MACRO if z in acum and z in prob]  # "Chile" no tiene desglose por especie en 06_probabilidad
    escribir({"zonas": zonas, "acumulacion": acum, "probabilidad": prob,
              "nota": "Salidas completas Traveling/Stationary de 5–240 min; tramos de 15 min (90 = 76–90 min). "
                      "Norte Grande ≥ 180 min excluido."}, out / "calculadora.json")

    print(f"✓ {fichas} fichas · especies.json · resumen.json · marea.json · calculadora.json → {out}")


if __name__ == "__main__":
    main()
