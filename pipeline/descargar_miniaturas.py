"""Descarga las miniaturas cuadradas (75 px) de iNaturalist a web/public/fotos/<slug>.jpg.

Sirven para la imagen que se comparte desde el planificador: el navegador solo deja dibujar en un canvas fotos del mismo
dominio (los servidores de iNaturalist no envían permiso CORS). Solo se descargan fotos con licencia Creative Commons
(o CC0); se guarda el crédito en web/public/fotos/creditos.csv. Es reanudable: no vuelve a bajar lo que ya existe.

    python pipeline/descargar_miniaturas.py            # luego: python pipeline/export_web.py
"""
import csv, re, time, unicodedata, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
OUT = RAIZ / "web" / "public" / "fotos"


def slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    filas = list(csv.DictReader(open(RAIZ / "data" / "05b_especies_enriquecidas.csv", encoding="utf8")))
    creditos, nuevas, omitidas = [], 0, 0
    for r in filas:
        url, lic = r.get("foto_cuadrada") or "", (r.get("foto_licencia") or "").lower()
        if not url or not (lic.startswith("cc") ):
            omitidas += 1; continue
        s = slug(r["sci_name"]); dest = OUT / f"{s}.jpg"
        if not dest.exists():
            # la misma foto puede estar en otro servidor o con otra extensión; si se borró, se prueba la foto mediana
            candidatos = [url, url.replace("inaturalist-open-data.s3.amazonaws.com", "static.inaturalist.org"),
                          url.replace("static.inaturalist.org", "inaturalist-open-data.s3.amazonaws.com")]
            candidatos += [c.rsplit(".", 1)[0] + ext for c in candidatos[:1] for ext in (".jpeg", ".png")]
            if r.get("foto_url"):
                candidatos.append(r["foto_url"])
            ok = False
            for u in dict.fromkeys(candidatos):
                try:
                    req = urllib.request.Request(u, headers={"User-Agent": "aves-chile-atlas/1.0 (proyecto académico UDD)"})
                    dest.write_bytes(urllib.request.urlopen(req, timeout=20).read()); nuevas += 1; ok = True; time.sleep(0.25); break
                except Exception:  # noqa: BLE001
                    continue
            if not ok:
                print(f"  ✗ {s}: la foto ya no está en iNaturalist (se mostrará la inicial)"); continue
        creditos.append({"slug": s, "licencia": lic, "credito": r.get("foto_credito", ""), "fuente": url})
    with open(OUT / "creditos.csv", "w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=["slug", "licencia", "credito", "fuente"]); w.writeheader(); w.writerows(creditos)
    print(f"✓ {len(creditos)} miniaturas en {OUT} ({nuevas} nuevas) · {omitidas} sin foto o sin licencia CC")


if __name__ == "__main__":
    main()
