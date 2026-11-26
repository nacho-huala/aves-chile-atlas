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
    especies/<slug>.json      ficha de cada especie (foto, canto, fenología, la ola, rasgos, enlaces)
    laminas/*.json            datos de cada lámina interactiva (mapa, ola, rueda, reloj, enjambre,
                              red, riesgo, oido, rasgos); ver exportar_laminas()

Reglas que aplica (documentadas en README.md):
    * Excluye nombres terminados en " sp." (no identifican especie) → 566 especies.
    * Calculadora: excluye Norte Grande ≥ 180 min (1.655 salidas con una sola especie,
      probable monitoreo de una especie).
"""
from __future__ import annotations

import argparse
import csv
import json
import math
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


MIN_SALIDAS_SITIO = 20     # un sitio KBA se recomienda solo si tiene al menos 20 salidas dentro


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--out", type=Path, default=Path("web/public/data"))
    a = ap.parse_args()
    d, out = a.data, a.out

    # ─────────────── especies (índice + fichas)
    enr = [r for r in leer(d / "05b_especies_enriquecidas.csv") if not r["sci_name"].endswith(" sp.")]
    validas = {r["sci_name"] for r in enr}
    nid: dict[str, dict] = {}  # atlas de nidificación (Medrano et al. 2018); lo genera build_nidificacion.py
    if (d / "15_nidificacion.csv").exists():
        for r in leer(d / "15_nidificacion.csv"):
            nid[r["sci_name"]] = {
                "resumen": txt(r["resumen"]), "revisar": r["revisar"] == "True",
                "meses": [int(m) for m in r["meses_nidificacion"].split()] if r["meses_nidificacion"] else [],
                "altitud": [int(float(r["altitud_min"])), int(float(r["altitud_max"]))] if txt(r["altitud_min"]) and txt(r["altitud_max"]) else None,
            }
    fen: dict[str, list] = {}
    for r in leer(d / "03_fenologia.csv"):
        if r["sci_name"] in validas:
            fen.setdefault(r["sci_name"], [None] * 12)[int(r["month"]) - 1] = num(r["pct_salidas"], 3)

    ola = leer_ola(d, validas)

    # sitios KBA donde más se ve cada especie (solo sitios con ≥ MIN_SALIDAS_SITIO salidas y % calculable)
    kba_esp: dict[str, list] = {}
    if (d / "13_kba_sitios.csv").exists():
        sit = {r["kba_id"]: r for r in leer(d / "13_kba_sitios.csv") if (num(r["salidas_dentro"], 0) or 0) >= MIN_SALIDAS_SITIO}
        for r in leer(d / "13_kba_especies.csv"):
            s = sit.get(r["kba_id"])
            if s and txt(r["pct_completas"]) and (num(r["salidas_con"], 0) or 0) >= 10:
                kba_esp.setdefault(r["sci_name"], []).append({"id": num(r["kba_id"], 0), "nombre": s["nombre"], "region": txt(s["region"]),
                                                              "p": num(r["pct_completas"], 1), "salidas": num(r["salidas_con"], 0)})
        for k in kba_esp:
            kba_esp[k] = sorted(kba_esp[k], key=lambda x: (-x["p"], -x["salidas"]))[:5]

    # fotos: se usan solo las de licencia libre. iNaturalist CC → igual que antes; si no, la de Wikimedia Commons
    # (fotos_commons.py); si tampoco hay, la especie queda sin foto en vez de enlazar una foto con todos los derechos reservados.
    commons = {r["sci_name"]: r for r in leer(d / "extra" / "fotos_commons.csv")} if (d / "extra" / "fotos_commons.csv").exists() else {}
    def foto_libre(r):
        if (r.get("foto_licencia") or "").lower().startswith("cc"):
            return txt(r["foto_cuadrada"]), {"url": txt(r["foto_url"]), "credito": txt(r["foto_credito"]), "licencia": txt(r["foto_licencia"]), "fuente": "iNaturalist"}
        c = commons.get(r["sci_name"])
        if c:
            local = out.parent / "fotos" / f"{c['slug']}.jpg"
            return (f"/fotos/{local.name}" if local.exists() else c["url_640"]), {
                "url": c["url_640"], "credito": c["autor"], "licencia": c["licencia_url"] or c["licencia"], "fuente": "Wikimedia Commons"}
        return None, {"url": None, "credito": None, "licencia": None, "fuente": None}
    FOTO = {r["sci_name"]: foto_libre(r) for r in enr}

    indice, fichas = [], 0
    for r in sorted(enr, key=lambda r: -float(r["salidas_con"])):
        s = slug(r["sci_name"])
        base = {
            "slug": s, "sci": r["sci_name"], "nombre": txt(r["nombre"]) or r["common_name"],
            "familia": txt(r["familia"]), "pct": num(r["pct_salidas"], 4), "salidas": num(r["salidas_con"], 0),
            "estatus": txt(r["estatus_final"]), "uicn": txt(r["uicn"]), "foto": FOTO[r["sci_name"]][0],
            "mejorMes": num(r["mejor_mes"], 0),
            "nidifica": r["sci_name"] in nid,  # registrada como nidificante en el atlas (Medrano et al. 2018)
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
            "nidificacion": nid.get(r["sci_name"]),
            "kba": kba_esp.get(r["sci_name"], []),  # sitios KBA donde más se registra  # null si el atlas no la registra como nidificante
            "ola": ola.get(r["sci_name"]),  # lámina 2: % de salidas completas por mes × franja de 0,5°
            "imagen": FOTO[r["sci_name"]][1],
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

    exportar_laminas(d, out, enr, nombre, fen, ola)
    if nid:
        exportar_nidificacion(d, out, enr, nid, fen)
    if (d / "14_uicn_agregado.csv").exists():  # tendencia UICN: solo agregado por categoría (términos UICN)
        escribir({"categorias": [{"cat": r["categoria"], "especies": num(r["especies"], 0), "decreciente": num(r["decreciente"], 0),
                                  "estable": num(r["estable"], 0), "creciente": num(r["creciente"], 0),
                                  "desconocida": num(r["desconocida"], 0)} for r in leer(d / "14_uicn_agregado.csv")],
                  "cita": "IUCN. The IUCN Red List of Threatened Species. https://www.iucnredlist.org (descargado el 14/11/2026)."}, out / "uicn.json")
    if (d / "13_kba_sitios.csv").exists():
        exportar_kba(d, out, nombre)
        exportar_planificador(d, out, enr, nombre, {k: v[0] for k, v in FOTO.items()})

    print(f"✓ {fichas} fichas · especies.json · resumen.json · marea.json · calculadora.json · laminas/ → {out}")


# ═══════════════ nidificación (contrato con web/lib/laminas-datos.ts → getNidificacion)

def exportar_nidificacion(d: Path, out: Path, enr: list, nid: dict, fen: dict):
    """Láminas 13 y 14: calendario de nidificación frente a eBird, y rangos de altitud de nidificación."""
    especies = []
    for r in enr:
        n = nid.get(r["sci_name"])
        if not n:
            continue
        f = fen.get(r["sci_name"])
        mx = max([v or 0 for v in f]) if f else 0
        especies.append({"slug": slug(r["sci_name"]), "nombre": txt(r["nombre"]) or r["common_name"],
                         "estatus": txt(r["estatus_final"]), "pct": num(r["pct_salidas"], 4),
                         "meses": n["meses"], "alt": n["altitud"], "revisar": n["revisar"],
                         # fenología relativa al máximo de la especie (0–1), para comparar especies de distinta frecuencia
                         "fen": [round((v or 0) / mx, 2) for v in f] if f and mx > 0 else None})
    especies.sort(key=lambda e: -(e["pct"] or 0))
    filas = leer(d / "15_nidificacion.csv")
    cruce = [r for r in filas if r["coincide_pico"] in ("True", "False")]
    coincide = sum(r["coincide_pico"] == "True" for r in cruce)
    azar = sum(int(r["n_meses"]) / 12 for r in cruce) / len(cruce) if cruce else None
    por_mes = [sum(1 for e in especies if m in e["meses"]) for m in range(1, 13)]
    escribir({"especies": especies, "porMes": por_mes,
              "cruce": {"n": len(cruce), "coincide": coincide, "azar": round(100 * azar, 1) if azar else None},
              "cita": "Medrano F, Barros R, Norambuena H V, Matus R y Schmitt F. 2018. Atlas de las aves nidificantes de Chile. "
                      "Red de Observadores de Aves y Vida Silvestre de Chile. Santiago, Chile."},
             out / "laminas" / "nidificacion.json")


# ═══════════════ planificador (contrato con web/lib/planificador.ts)

def exportar_planificador(d: Path, out: Path, enr: list, nombre: dict, fotos: dict):
    """Sitios KBA con punto publicable × especies → planificador.json.
    Compacto: e = especies [slug, nombre, foto, estatus, % salidas en Chile, UICN]; s = sitios; r[i] = [[índice especie, % salidas completas, mes pico], …].
    No agrega datos nuevos: reordena 13_kba_sitios y 13_kba_especies para calcular rutas en el navegador."""
    info = {r["sci_name"]: r for r in enr}
    sitios = [r for r in leer(d / "13_kba_sitios.csv")
              if r["punto_publicable"] == "True" and (num(r["salidas_dentro"], 0) or 0) >= MIN_SALIDAS_SITIO]
    ids = {r["kba_id"]: i for i, r in enumerate(sitios)}
    esp_idx: dict[str, int] = {}
    especies, reg = [], [[] for _ in sitios]
    for r in leer(d / "13_kba_especies.csv"):
        i = ids.get(r["kba_id"])
        if i is None or r["sci_name"] not in nombre or not txt(r["pct_completas"]):
            continue
        if r["sci_name"] not in esp_idx:
            e = info[r["sci_name"]]
            esp_idx[r["sci_name"]] = len(especies)
            # miniatura local si existe (mismo dominio: se puede dibujar en el canvas al compartir); si no, la de iNaturalist
            local = out.parent / "fotos" / f"{nombre[r['sci_name']][0]}.jpg"
            foto = f"/fotos/{local.name}" if local.exists() else fotos.get(r["sci_name"])
            especies.append([nombre[r["sci_name"]][0], nombre[r["sci_name"]][1], foto, txt(e["estatus_final"]),
                             num(e["pct_salidas"], 3), txt(e["uicn"])])
        reg[i].append([esp_idx[r["sci_name"]], num(r["pct_completas"], 1), num(r["mes_pico"], 0)])
    s = [{"id": num(r["kba_id"], 0), "nombre": r["nombre"], "region": txt(r["region"]), "macrozona": txt(r["macrozona"]),
          "punto": [num(r["punto_lat"], 2), num(r["punto_lon"], 2)], "salidas": num(r["salidas_dentro"], 0),
          "especies": num(r["especies"], 0), "riqueza": num(r["riqueza_mediana"], 0),
          "meses": [num(r[f"mes_{m:02d}"], 0) for m in range(1, 13)]} for r in sitios]
    escribir({"e": especies, "s": s, "r": reg,
              "nota": "Sitios KBA con punto de referencia de eBird (≥ 20 salidas). Probabilidad = % de salidas completas del sitio "
                      "con la especie, 2019–2025. Distancias en línea recta."}, out / "planificador.json")
    print(f"✓ planificador.json: {len(s)} sitios · {len(especies)} especies · {sum(map(len, reg))} pares sitio-especie")


# ═══════════════ sitios KBA (contrato con web/lib/data.ts → getKba)

MAX_ESPECIES_SITIO = 20    # especies que se listan por sitio (las más frecuentes)
CITA_KBA = ("BirdLife International (2026). Digital boundaries of Key Biodiversity Areas from the World Database of Key "
            "Biodiversity Areas. Developed by the KBA Partnership: BirdLife International, International Union for the "
            "Conservation of Nature, American Bird Conservancy, Amphibian Survival Alliance, Conservation International, "
            "Critical Ecosystem Partnership Fund, Global Environment Facility, Re:Wild, NatureServe, Rainforest Trust, "
            "Royal Society for the Protection of Birds, Wildlife Conservation Society and World Wildlife Fund. "
            "Versión septiembre 2026. https://www.keybiodiversityareas.org (descargado el 14/11/2026).")


def exportar_kba(d: Path, out: Path, nombre: dict):
    """13_kba_sitios + 13_kba_especies (+ 13_kba_proteccion) → kba.json.
    Solo indicadores derivados de eBird; ningún polígono ni coordenada de la capa KBA. El punto de cada sitio
    sale de eBird (celda de ~1 km con más salidas) y solo existe si cumple las reglas de build_kba.py."""
    esp: dict = {}
    for r in leer(d / "13_kba_especies.csv"):
        if r["sci_name"] in nombre:
            s, n = nombre[r["sci_name"]]
            esp.setdefault(r["kba_id"], []).append({"slug": s, "nombre": n, "salidas": num(r["salidas_con"], 0),
                                                    "p": num(r["pct_completas"], 1), "mes": num(r["mes_pico"], 0)})
    filas = leer(d / "13_kba_sitios.csv")
    sitios = []
    for r in filas:
        if (num(r["salidas_dentro"], 0) or 0) < MIN_SALIDAS_SITIO:
            continue
        lista = sorted(esp.get(r["kba_id"], []), key=lambda e: -e["salidas"])[:MAX_ESPECIES_SITIO]
        punto = [num(r["punto_lat"], 2), num(r["punto_lon"], 2)] if r["punto_publicable"] == "True" else None
        sitios.append({
            "id": num(r["kba_id"], 0), "nombre": r["nombre"], "region": txt(r["region"]), "macrozona": txt(r["macrozona"]),
            "salidas": num(r["salidas_dentro"], 0), "localidades": num(r["localidades"], 0),
            "especies": num(r["especies"], 0), "riqueza": num(r["riqueza_mediana"], 1),
            "nGatillo": num(r["n_gatillo_aves"], 0), "gatilloVistas": num(r["gatillo_vistas"], 0),
            "punto": punto, "meses": [num(r[f"mes_{m:02d}"], 0) for m in range(1, 13)], "top": lista,
        })
    sitios.sort(key=lambda s: -s["salidas"])
    prot = []
    if (d / "13_kba_proteccion.csv").exists():
        prot = [{"tramo": r["tramo"], "sitios": num(r["sitios"], 0), "salidas": num(r["salidas_dentro"], 0),
                 "pct": num(r["pct_salidas_en_kba"], 1)} for r in leer(d / "13_kba_proteccion.csv")]
    escribir({
        "sitios": sitios,
        "resumen": {"sitiosTotal": len(filas), "sitiosConDatos": len(sitios),
                    "sitiosSinSalidas": sum(1 for r in filas if (num(r["salidas_dentro"], 0) or 0) == 0),
                    "puntosPublicables": sum(1 for s in sitios if s["punto"]), "proteccion": prot},
        "nota": f"Sitios con al menos {MIN_SALIDAS_SITIO} salidas de eBird dentro del polígono KBA (2019–2025). "
                "El punto es la celda de ~1 km con más salidas dentro del sitio, no su centro ni su límite.",
        "cita": CITA_KBA,
    }, out / "kba.json")
    print(f"✓ kba.json: {len(sitios)} sitios con datos · {sum(1 for s in sitios if s['punto'])} con punto")


# ═══════════════ láminas interactivas (contrato con web/lib/laminas-datos.ts)

def leer_ola(d: Path, validas: set) -> dict:
    """02_ridge → {sci: {"bandas": [lat…], "pct": [[mes1…], … 12 filas]}} (null donde no hay datos)."""
    tmp: dict = {}
    for r in leer(d / "02_ridge.csv"):
        if r["sci_name"] in validas:
            tmp.setdefault(r["sci_name"], {})[(int(r["month"]), float(r["lat_banda"]))] = num(r["pct_salidas"], 2)
    res = {}
    for sci, celdas in tmp.items():
        bandas = sorted({b for _, b in celdas}, reverse=True)  # norte → sur
        res[sci] = {"bandas": bandas, "pct": [[celdas.get((m, b)) for b in bandas] for m in range(1, 13)]}
    return res


HABITAT = {"Forest": "bosque", "Woodland": "bosque", "Marine": "costa", "Coastal": "costa", "Human Modified": "ciudad",
           "Shrubland": "matorral", "Grassland": "matorral", "Rock": "matorral", "Desert": "matorral",
           "Wetland": "humedal", "Riverine": "humedal"}
DIETA = {"Invertivore": "invertívora", "Omnivore": "omnívora", "Granivore": "granívora / herbívora",
         "Herbivore terrestrial": "granívora / herbívora", "Herbivore aquatic": "granívora / herbívora",
         "Nectarivore": "nectarívora / frugívora", "Frugivore": "nectarívora / frugívora",
         "Aquatic predator": "carnívora / pescadora", "Vertivore": "carnívora / pescadora", "Scavenger": "carnívora / pescadora"}
# Especies con temporada marcada (L2): llegan en primavera, en verano o bajan en invierno.
ESTACIONALES = ["Elaenia albiceps", "Hymenops perspicillatus", "Leucophaeus pipixcan", "Colorhamphus parvirostris",
                "Sephanoides sephaniodes", "Muscisaxicola maclovianus", "Tachycineta leucopyga", "Calidris bairdii",
                "Hirundo rustica", "Numenius hudsonicus", "Lessonia rufa", "Phytotoma rara"]


def exportar_laminas(d: Path, out: Path, enr: list, nombre: dict, fen: dict, ola: dict):
    L = out / "laminas"
    por_sci = {r["sci_name"]: r for r in enr}
    ref = lambda sci: {"slug": nombre[sci][0], "nombre": nombre[sci][1]}

    # 1 · mapa bivariado: celdas de 0,25° (lat, lon = centro) con clases por terciles
    celdas = [[num(r["lat"], 3), num(r["lon"], 3), num(r["salidas"], 0), num(r["especies"], 0),
               num(r["clase_esfuerzo"], 0), num(r["clase_riqueza"], 0)]
              for r in leer(d / "01_hex.csv") if r["tipo_celda"] == "grilla_0.25" and float(r["lon"]) > -76]
    escribir({"campos": ["lat", "lon", "salidas", "especies", "claseEsfuerzo", "claseRiqueza"], "celdas": celdas,
              "fuera": sum(1 for r in leer(d / "01_hex.csv") if float(r["lon"]) <= -76)}, L / "mapa.json")

    # 2 · la ola: especies destacadas con su matriz mes × franja (las fichas traen la de cada especie)
    destacadas = [s for s in ESTACIONALES if s in ola and s in nombre]
    escribir([{**ref(s), "sci": s, **ola[s]} for s in destacadas], L / "ola.json")

    # 3 · rueda fenológica: las 4 más comunes + las estacionales, % de salidas completas por mes
    comunes = [r["sci_name"] for r in sorted(enr, key=lambda r: -float(r["salidas_con"]))[:4]]
    rueda = [s for s in comunes + ESTACIONALES if s in fen][:14]
    escribir([{**ref(s), "sci": s, "pct": fen[s], "comun": s in comunes} for s in rueda], L / "rueda.json")

    # 4 · reloj: salidas por macrozona × mes × hora de inicio (local y solar) + amanecer y atardecer
    reloj: dict = {}
    for r in leer(d / "04_reloj.csv"):
        if not r["macrozona"]:
            continue
        m = reloj.setdefault(r["reloj"], {}).setdefault(r["macrozona"], [[0] * 24 for _ in range(12)])
        m[int(r["month"]) - 1][int(r["hora"]) % 24] += int(float(r["salidas"]))
    sol: dict = {}
    for r in leer(d / "04_sol.csv"):
        sol.setdefault(r["macrozona"], [None] * 12)[int(r["month"]) - 1] = [num(r["amanecer"], 3), num(r["atardecer"], 3)]
    escribir({"zonas": ["Chile"] + MACRO, "reloj": reloj, "sol": sol}, L / "reloj.json")

    # 5 · enjambre de rareza · 9 riesgo · 11 rasgos · 10 oído: una fila por especie
    riesgo = {r["sci_name"]: r for r in leer(d / "10_riesgo.csv")}
    rasgos = {r["sci_name"]: r for r in leer(d / "11_rasgos.csv")}
    sonidos = {r["sci_name"]: r for r in leer(d / "extra" / "12_sonidos.csv")}
    esp = []
    for sci, r in por_sci.items():
        pct = num(r["pct_salidas"], 5)
        if not pct:
            continue
        esp.append({**ref(sci), "pct": pct, "obs": num(r["observadores"], 0), "estatus": txt(r["estatus_final"]),
                    "uicn": txt(riesgo.get(sci, {}).get("uicn")), "endemica": r["endemica"] == "true"})
    escribir(sorted(esp, key=lambda e: -e["pct"]), L / "especies.json")

    ras = []
    for sci, r in rasgos.items():
        if sci not in nombre or not txt(r["masa_g"]) or not txt(r["pico_culmen_mm"]):
            continue
        masa, culmen = float(r["masa_g"]), float(r["pico_culmen_mm"])
        ras.append({**ref(sci), "masa": round(masa, 1), "culmen": round(culmen, 1),
                    "picoRel": round(culmen / masa ** (1 / 3), 3), "pct": num(r["pct_salidas"], 4),
                    "dieta": DIETA.get(r["nicho_trofico"]), "habitat": HABITAT.get(r["habitat"])})
    escribir(ras, L / "rasgos.json")

    # 10 · oído vs. vista: regresión log10(grabaciones) ~ log10(% salidas); residuo = cuántas veces más/menos
    pts = [(sci, float(por_sci[sci]["pct_salidas"]), int(float(r["xc_grabaciones_chile"])))
           for sci, r in sonidos.items() if sci in nombre and txt(r["xc_grabaciones_chile"])
           and float(r["xc_grabaciones_chile"]) > 0 and float(por_sci[sci]["pct_salidas"] or 0) > 0]
    xs = [math.log10(p) for _, p, _ in pts]; ys = [math.log10(g) for _, _, g in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs); a = my - b * mx
    oido = []
    for (sci, p, g), x, y in zip(pts, xs, ys):
        s = sonidos[sci]
        oido.append({**ref(sci), "pct": round(p, 5), "grab": g, "veces": round(10 ** (y - (a + b * x)), 2),
                     "audio": txt(s["xc_audio"]), "autor": txt(s["xc_autor"]), "licencia": txt(s["xc_licencia"]),
                     "url": txt(s["xc_url"])})
    escribir({"a": round(a, 4), "b": round(b, 4), "n": len(oido), "especies": oido}, L / "oido.json")

    # 8 · red de co-ocurrencia (40 especies más avistadas, lift ≥ 2)
    nodos = []
    for r in leer(d / "08_nodos.csv"):
        sci = r["sci_name"]
        if sci not in nombre:
            continue
        nodos.append({**ref(sci), "sci": sci, "pct": num(r["pct_salidas"], 2), "comunidad": num(r["comunidad"], 0),
                      "habitat": HABITAT.get(rasgos.get(sci, {}).get("habitat", ""))})
    ids = {n["sci"] for n in nodos}
    aristas = [{"a": r["source"], "b": r["target"], "lift": num(r["lift"], 2), "juntas": num(r["juntas"], 0)}
               for r in leer(d / "08_aristas.csv") if r["source"] in ids and r["target"] in ids and float(r["lift"]) >= 2]
    escribir({"nodos": nodos, "aristas": aristas}, L / "red.json")

    # 8b · red ampliada y navegable (build_red_ampliada.py): 150 especies, vínculos con lift ≥ 2, índices compactos
    if (d / "08b_red_nodos.csv").exists():
        nb = [r for r in leer(d / "08b_red_nodos.csv") if r["sci_name"] in nombre]
        idx = {r["sci_name"]: i for i, r in enumerate(nb)}
        nodos_b = [{**ref(r["sci_name"]), "pct": num(r["pct_salidas"], 2), "c": num(r["comunidad"], 0),
                    "habitat": HABITAT.get(rasgos.get(r["sci_name"], {}).get("habitat", ""))} for r in nb]
        ar_b = [[idx[r["source"]], idx[r["target"]], num(r["lift"], 2), num(r["juntas"], 0)] for r in leer(d / "08b_red_aristas.csv")
                if r["source"] in idx and r["target"] in idx and float(r["lift"]) >= 2]
        # nombre de cada comunidad: su hábitat dominante (AVONET) y la especie más vista
        from collections import Counter
        comunidades = []
        for c in sorted({n["c"] for n in nodos_b}):
            miembros = [n for n in nodos_b if n["c"] == c]
            hab = Counter(n["habitat"] for n in miembros if n["habitat"]).most_common(1)
            comunidades.append({"id": c, "habitat": hab[0][0] if hab else None, "n": len(miembros),
                                "ejemplo": max(miembros, key=lambda n: n["pct"] or 0)["nombre"]})
        escribir({"nodos": nodos_b, "aristas": ar_b, "comunidades": comunidades}, L / "red_ampliada.json")


if __name__ == "__main__":
    main()
