#!/usr/bin/env python3
"""
Sonidos de aves de Chile: cruza tu base eBird (EBD) con Xeno-canto.

Flujo (cada paso es un subcomando y se puede reanudar):

  1) python aves_sonidos.py especies
        Lee el EBD completo (streaming, no carga los 4 GB en RAM) y genera
        especies_chile.csv con las especies unicas (+ n de registros).

  2) python aves_sonidos.py links --key TU_API_KEY
        Consulta la API v3 de Xeno-canto por cada especie (cnt:chile) y genera
        sonidos_links.csv (un renglon por grabacion con URL directa al audio)
        y sin_resultados.csv (especies sin grabaciones).

  3) python aves_sonidos.py descargar [--max-por-especie 3] [--calidad A]
        Descarga los audios a sonidos/<Genero_especie>/...

API key gratis: crear cuenta en https://xeno-canto.org/account y copiar la key.
Tambien se puede definir la variable de entorno XC_API_KEY.

Requisitos: pip install httpx
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

import httpx

AQUI = Path(__file__).resolve().parent
EBD_DEFAULT = AQUI / "chile_ebd_relSep-2026.txt"
ESPECIES_CSV = AQUI / "especies_chile.csv"
LINKS_CSV = AQUI / "sonidos_links.csv"
SIN_RES_CSV = AQUI / "sin_resultados.csv"
SONIDOS_DIR = AQUI / "sonidos"

XC_URL = "https://xeno-canto.org/api/3/recordings"
UA = "aves-chile-sonidos/1.0 (uso personal; investigacion)"

CAMPOS_LINKS = [
    "scientific_name", "common_name_ebird", "xc_id", "genero", "especie",
    "subespecie", "nombre_en", "pais", "localidad", "lat", "lon", "tipo",
    "sexo", "etapa", "calidad", "duracion", "fecha", "grabador", "licencia",
    "url_pagina", "url_audio", "nombre_archivo", "busqueda",
]


# --------------------------------------------------------------------------
# Paso 1: especies unicas desde el EBD
# --------------------------------------------------------------------------
def cmd_especies(args) -> None:
    ebd = Path(args.ebd)
    if not ebd.exists():
        sys.exit(f"No encuentro {ebd}")

    cuenta: Counter[tuple[str, str]] = Counter()
    t0 = time.time()
    with ebd.open("r", encoding="utf-8", errors="replace", newline="") as f:
        header = f.readline().rstrip("\r\n").split("\t")
        col = {n.strip().upper(): i for i, n in enumerate(header)}
        for req in ("SCIENTIFIC NAME", "COMMON NAME"):
            if req not in col:
                sys.exit(f"Falta la columna '{req}'. Columnas: {header}")
        i_sci, i_com = col["SCIENTIFIC NAME"], col["COMMON NAME"]
        i_cat = col.get("CATEGORY")  # filtra spuh, slash, hybrid, etc.
        i_max = max(i for i in (i_sci, i_com, i_cat) if i is not None)

        for n, linea in enumerate(f, 1):
            c = linea.rstrip("\r\n").split("\t")
            if len(c) <= i_max:
                continue
            if i_cat is not None and c[i_cat] != "species":
                continue
            cuenta[(c[i_sci].strip(), c[i_com].strip())] += 1
            if n % 5_000_000 == 0:
                print(f"  {n:,} filas... {len(cuenta)} especies", flush=True)

    filas = sorted(cuenta.items(), key=lambda kv: -kv[1])
    with ESPECIES_CSV.open("w", encoding="utf-8-sig", newline="") as out:
        w = csv.writer(out)
        w.writerow(["scientific_name", "common_name", "n_registros"])
        for (sci, com), n in filas:
            w.writerow([sci, com, n])
    print(f"{len(filas)} especies unicas -> {ESPECIES_CSV} ({time.time()-t0:.0f}s)")


# --------------------------------------------------------------------------
# Paso 2: links en Xeno-canto
# --------------------------------------------------------------------------
def _get(client: httpx.Client, params: dict, reintentos: int = 5) -> dict:
    espera = 2.0
    for intento in range(reintentos):
        try:
            r = client.get(XC_URL, params=params)
            if r.status_code == 429 or r.status_code >= 500:
                raise httpx.HTTPStatusError("reintentable", request=r.request, response=r)
            r.raise_for_status()
            return r.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            if intento == reintentos - 1:
                raise
            print(f"    reintento en {espera:.0f}s ({e.__class__.__name__})", flush=True)
            time.sleep(espera)
            espera *= 2
    raise RuntimeError("inalcanzable")


def _recordings(client, query: str, key: str, pausa: float):
    """Itera todas las paginas de una consulta."""
    pagina = 1
    while True:
        data = _get(client, {"query": query, "key": key, "page": pagina, "per_page": 500})
        if "error" in data:
            raise RuntimeError(f"API error: {data}")
        for rec in data.get("recordings", []):
            yield rec
        if pagina >= int(data.get("numPages", 1) or 1):
            return
        pagina += 1
        time.sleep(pausa)


def _fila(sci: str, com: str, rec: dict, busqueda: str) -> dict:
    audio = rec.get("file") or ""
    if audio.startswith("//"):
        audio = "https:" + audio
    url = rec.get("url") or ""
    if url.startswith("//"):
        url = "https:" + url
    return {
        "scientific_name": sci, "common_name_ebird": com,
        "xc_id": rec.get("id", ""), "genero": rec.get("gen", ""),
        "especie": rec.get("sp", ""), "subespecie": rec.get("ssp", ""),
        "nombre_en": rec.get("en", ""), "pais": rec.get("cnt", ""),
        "localidad": rec.get("loc", ""), "lat": rec.get("lat", ""),
        "lon": rec.get("lon", ""), "tipo": rec.get("type", ""),
        "sexo": rec.get("sex", ""), "etapa": rec.get("stage", ""),
        "calidad": rec.get("q", ""), "duracion": rec.get("length", ""),
        "fecha": rec.get("date", ""), "grabador": rec.get("rec", ""),
        "licencia": ("https:" + rec["lic"]) if str(rec.get("lic", "")).startswith("//") else rec.get("lic", ""),
        "url_pagina": url, "url_audio": audio,
        "nombre_archivo": rec.get("file-name", ""), "busqueda": busqueda,
    }


def cmd_links(args) -> None:
    key = args.key or os.environ.get("XC_API_KEY")
    if not key:
        sys.exit("Falta la API key (--key o variable XC_API_KEY). "
                 "Crear en https://xeno-canto.org/account")
    if not ESPECIES_CSV.exists():
        sys.exit("Primero ejecuta:  python aves_sonidos.py especies")

    with ESPECIES_CSV.open(encoding="utf-8-sig", newline="") as f:
        especies = list(csv.DictReader(f))
    if args.limite:
        especies = especies[: args.limite]

    # reanudar: especies ya consultadas
    hechas: set[str] = set()
    if LINKS_CSV.exists() and not args.reiniciar:
        with LINKS_CSV.open(encoding="utf-8-sig", newline="") as f:
            hechas = {r["scientific_name"] for r in csv.DictReader(f)}
    if SIN_RES_CSV.exists() and not args.reiniciar:
        with SIN_RES_CSV.open(encoding="utf-8-sig", newline="") as f:
            hechas |= {r["scientific_name"] for r in csv.DictReader(f)}

    nuevo_links = args.reiniciar or not LINKS_CSV.exists()
    nuevo_sin = args.reiniciar or not SIN_RES_CSV.exists()
    fl = LINKS_CSV.open("w" if nuevo_links else "a", encoding="utf-8-sig", newline="")
    fs = SIN_RES_CSV.open("w" if nuevo_sin else "a", encoding="utf-8-sig", newline="")
    wl = csv.DictWriter(fl, fieldnames=CAMPOS_LINKS)
    ws = csv.writer(fs)
    if nuevo_links:
        wl.writeheader()
    if nuevo_sin:
        ws.writerow(["scientific_name", "common_name", "n_registros"])

    pais = "" if args.mundial else " cnt:chile"
    calidad = f" q:{args.calidad}" if args.calidad else ""
    pendientes = [e for e in especies if e["scientific_name"] not in hechas]
    print(f"{len(pendientes)} especies por consultar ({len(hechas)} ya hechas)")

    headers = {"User-Agent": UA}
    with httpx.Client(timeout=60, headers=headers, follow_redirects=True) as client:
        for i, e in enumerate(pendientes, 1):
            sci, com = e["scientific_name"], e["common_name"]
            partes = sci.split()
            if len(partes) < 2:
                ws.writerow([sci, com, e["n_registros"]]); fs.flush()
                continue
            q = f'gen:"{partes[0]}" sp:"{partes[1]}"{pais}{calidad}'
            try:
                recs = list(_recordings(client, q, key, args.pausa))
                busqueda = q
                if not recs and args.fallback_nombre:
                    q2 = f'en:"{com}"{pais}{calidad}'
                    recs = list(_recordings(client, q2, key, args.pausa))
                    busqueda = q2
            except Exception as ex:  # no abortar toda la corrida
                print(f"[{i}/{len(pendientes)}] {sci}: ERROR {ex}", flush=True)
                continue  # no se marca como hecha: se reintenta al reanudar

            if recs:
                for rec in recs:
                    wl.writerow(_fila(sci, com, rec, busqueda))
                fl.flush()
            else:
                ws.writerow([sci, com, e["n_registros"]]); fs.flush()
            print(f"[{i}/{len(pendientes)}] {sci}: {len(recs)} grabaciones", flush=True)
            time.sleep(args.pausa)
    fl.close(); fs.close()
    print(f"Listo -> {LINKS_CSV}\n         {SIN_RES_CSV}")


# --------------------------------------------------------------------------
# Paso 3: descargar audios
# --------------------------------------------------------------------------
def _seguro(s: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", s).strip("_")


def cmd_descargar(args) -> None:
    if not LINKS_CSV.exists():
        sys.exit("Primero ejecuta el paso 'links'")
    orden_q = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
    por_especie: dict[str, list[dict]] = {}
    with LINKS_CSV.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["url_audio"]:
                por_especie.setdefault(r["scientific_name"], []).append(r)

    SONIDOS_DIR.mkdir(exist_ok=True)
    with httpx.Client(timeout=120, headers={"User-Agent": UA}, follow_redirects=True) as c:
        for sci, recs in por_especie.items():
            recs.sort(key=lambda r: orden_q.get(r["calidad"], 9))  # mejor calidad primero
            if args.max_por_especie:
                recs = recs[: args.max_por_especie]
            carpeta = SONIDOS_DIR / _seguro(sci)
            carpeta.mkdir(exist_ok=True)
            for r in recs:
                nombre = _seguro(r["nombre_archivo"]) or f"XC{r['xc_id']}.mp3"
                destino = carpeta / nombre
                if destino.exists() and destino.stat().st_size > 0:
                    continue
                try:
                    with c.stream("GET", r["url_audio"]) as resp:
                        resp.raise_for_status()
                        tmp = destino.with_suffix(destino.suffix + ".part")
                        with tmp.open("wb") as out:
                            for trozo in resp.iter_bytes(65536):
                                out.write(trozo)
                        tmp.replace(destino)
                    print(f"ok  {destino.relative_to(AQUI)}", flush=True)
                except Exception as ex:
                    print(f"ERR {r['url_audio']}: {ex}", flush=True)
                time.sleep(args.pausa)


# --------------------------------------------------------------------------
def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)

    a = sp.add_parser("especies", help="Extrae especies unicas del EBD")
    a.add_argument("--ebd", default=str(EBD_DEFAULT))
    a.set_defaults(fn=cmd_especies)

    b = sp.add_parser("links", help="Busca grabaciones en Xeno-canto")
    b.add_argument("--key", help="API key de Xeno-canto (o env XC_API_KEY)")
    b.add_argument("--calidad", help="Filtro de calidad, ej. A o '>C'", default=None)
    b.add_argument("--mundial", action="store_true", help="No restringir a Chile")
    b.add_argument("--fallback-nombre", action="store_true",
                   help="Si no hay resultados, reintenta por nombre en ingles")
    b.add_argument("--pausa", type=float, default=1.1, help="Segundos entre llamadas")
    b.add_argument("--limite", type=int, help="Solo las N especies mas registradas (prueba)")
    b.add_argument("--reiniciar", action="store_true", help="Ignorar avance previo")
    b.set_defaults(fn=cmd_links)

    c = sp.add_parser("descargar", help="Descarga los audios")
    c.add_argument("--max-por-especie", type=int, default=3)
    c.add_argument("--pausa", type=float, default=0.5)
    c.set_defaults(fn=cmd_descargar)

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
