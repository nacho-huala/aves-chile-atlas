"""Fotos de reemplazo desde Wikimedia Commons para especies cuya foto de iNaturalist no tiene licencia libre.

Wikidata (columna wd_imagen_commons de 05b) indica una imagen de Commons por especie; Commons solo acepta licencias
libres. Por cada especie sin foto CC en iNaturalist:
  · consulta la API de Commons (autor, licencia, imagen de 960 px),
  · guarda la miniatura cuadrable de 250 px en web/public/fotos/<slug>.jpg (para el canvas de «Llévate el plan»),
  · escribe data/extra/fotos_commons.csv, que export_web.py usa para la ficha, el catálogo y el planificador.

    python pipeline/fotos_commons.py && python pipeline/export_web.py
"""
import csv, html, json, re, time, unicodedata, urllib.error, urllib.parse, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
API = "https://commons.wikimedia.org/w/api.php"
FICHA, MINI = 960, 250  # tamaños estándar de miniatura de Commons (20, 40, 60, 120, 250, 330, 500, 960, 1280…)
UA = {"User-Agent": "aves-chile-atlas/1.0 (proyecto académico, Magíster en Data Science UDD; contacto vía GitHub)"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()).strip("-")


def get(url, intentos=4):
    """Descarga con reintentos: si Wikimedia responde 429 (demasiadas solicitudes), espera lo que pide y reintenta."""
    for k in range(intentos):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == intentos - 1:
                raise
            espera = int(e.headers.get("Retry-After", 0) or 0) or 10 * (k + 1)
            print(f"    · Wikimedia pide esperar {espera} s…"); time.sleep(espera)


def limpio(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


def main():
    filas = [r for r in csv.DictReader(open(RAIZ / "data" / "05b_especies_enriquecidas.csv", encoding="utf8"))
             if not r["sci_name"].endswith(" sp.") and not (r.get("foto_licencia") or "").lower().startswith("cc")
             and r.get("wd_imagen_commons")]
    archivo = {r["sci_name"]: urllib.parse.unquote(r["wd_imagen_commons"].rsplit("/", 1)[-1]) for r in filas}
    out_dir = RAIZ / "web" / "public" / "fotos"; out_dir.mkdir(parents=True, exist_ok=True)
    resultado, titulos = [], list(archivo.items())
    for k in range(0, len(titulos), 40):
        lote = titulos[k:k + 40]
        q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata",
                                    "iiurlwidth": FICHA, "titles": "|".join(f"File:{a}" for _, a in lote)})
        paginas = json.loads(get(f"{API}?{q}"))["query"]["pages"].values()
        por_titulo = {p["title"].replace("File:", "").replace("_", " "): p for p in paginas}
        for sci, a in lote:
            p = por_titulo.get(a.replace("_", " "))
            if not p or "imageinfo" not in p:
                print("  ✗", sci, "sin datos en Commons"); continue
            ii = p["imageinfo"][0]; md = ii.get("extmetadata", {})
            autor = limpio(md.get("Artist", {}).get("value")) or "Autor en Wikimedia Commons"
            lic = limpio(md.get("LicenseShortName", {}).get("value")); lic_url = md.get("LicenseUrl", {}).get("value", "")
            if not lic or lic.lower().startswith(("copyrighted", "fair use")):
                print("  ✗", sci, "licencia no reutilizable:", lic); continue
            t640 = ii.get("thumburl") or ii["url"]
            # Commons solo sirve tamaños estándar (https://w.wiki/GHai); si la original es menor, se usa la original
            t150 = re.sub(r"/\d+px-", f"/{MINI}px-", t640) if "/thumb/" in t640 else t640
            dest = out_dir / f"{slug(sci)}.jpg"
            if not dest.exists():
                try:
                    dest.write_bytes(get(t150)); time.sleep(1.5)
                except Exception as e:  # noqa: BLE001
                    print("  ✗ miniatura", sci, e)
            resultado.append({"sci_name": sci, "slug": slug(sci), "archivo": a, "url_640": t640, "autor": autor[:120],
                              "licencia": lic, "licencia_url": lic_url, "pagina": ii.get("descriptionurl", "")})
        time.sleep(0.5)
    with open(RAIZ / "data" / "extra" / "fotos_commons.csv", "w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=["sci_name", "slug", "archivo", "url_640", "autor", "licencia", "licencia_url", "pagina"])
        w.writeheader(); w.writerows(resultado)
    print(f"✓ {len(resultado)} de {len(archivo)} especies con foto de Commons → data/extra/fotos_commons.csv")


if __name__ == "__main__":
    main()
