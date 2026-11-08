"""
analisis_e2.py — E2 · Exploración, controles y prueba de concepto (Grupo 05, VIZ 2026)
=====================================================================================
Lee SOLO las tablas ya construidas (data/*.csv y data/raw/_atlas_2019_2025/salidas.parquet) y produce:

    e2/tablas/   CSV con los números citados en el brief
    e2/figuras/  PNG del brief (esquemas, exploración y prueba de concepto)
    e2/tablas/controles.csv   resultado esperado vs observado de cada control

Uso (desde la raíz del repositorio):
    pip install pandas numpy matplotlib pyarrow
    python pipeline/analisis/analisis_e2.py
    python pipeline/analisis/analisis_e2.py --parquet /ruta/a/salidas.parquet   # si el parquet está en otra carpeta

Salidas en docs/e2/tablas y docs/e2/figuras.

No toca el EBD original ni modifica las tablas de entrada.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.patches import FancyBboxPatch

# ───────────────────────── sistema visual L2 (tema «Día de campo»)
BG, LAM, TXT, APOYO, FOCO, SOL = "#E9E7DC", "#F3F1E9", "#22261C", "#62655A", "#7A2638", "#8C6418"
MUSGO = ["#A8AF78", "#8F9A55", "#667B26", "#4A5A1B", "#323A12"]  # secuencial ordenada (norte → sur)
MACRO = ["Norte Grande", "Norte Chico", "Centro", "Sur", "Austral"]
MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
# Tipografías del sistema: Young Serif / Instrument Sans / IBM Plex Mono. Si no están instaladas se usan sustitutas.
_disp = {f.name for f in mpl.font_manager.fontManager.ttflist}
_elige = lambda *ops: next((f for f in ops if f in _disp), ops[-1])
SERIF = _elige("Young Serif", "DejaVu Serif")
SANS = _elige("Instrument Sans", "Inter", "DejaVu Sans")
MONO = _elige("IBM Plex Mono", "DejaVu Sans Mono")
mpl.rcParams.update({
    "font.family": SANS, "font.size": 8.5, "text.color": TXT, "axes.labelcolor": APOYO,
    "xtick.color": APOYO, "ytick.color": APOYO, "axes.edgecolor": APOYO, "axes.facecolor": LAM,
    "figure.facecolor": BG, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#D6D3C2", "grid.linewidth": 0.6, "axes.axisbelow": True,
    "savefig.facecolor": BG,
})
W = 6.5  # ancho útil (pulgadas) en página Carta con márgenes de 1"


def titulo(fig, t, sub=None, y=0.985):
    fig.text(0.02, y, t, family=SERIF, fontsize=11, color=TXT, va="top", ha="left")
    if sub:
        fig.text(0.02, y - 0.055, sub, fontsize=8.5, color=APOYO, va="top", ha="left")


def pie(fig, s):
    import textwrap
    s = "\n".join(textwrap.wrap(s, 98))
    fig.text(0.02, 0.012, s, fontsize=7.5, color=APOYO, family=MONO, va="bottom", ha="left")


# ───────────────────────── carga
def cargar(raiz: Path, parquet: Path | None = None):
    d = raiz / "data"
    rd = lambda n: pd.read_csv(d / n, low_memory=False)
    T = dict(kpis=rd("00_kpis.csv"), anual=rd("00_anual.csv"), reg=rd("00_regiones.csv"), hexd=rd("01_hex.csv"),
             rid=rd("02_ridge.csv"), fen=rd("03_fenologia.csv"), reloj=rd("04_reloj.csv"), esp=rd("05_especies.csv"),
             enr=rd("05b_especies_enriquecidas.csv"), acc=rd("06_acumulacion.csv"), prob=rd("06_probabilidad.csv"),
             mar=rd("07_marea.csv"), nod=rd("08_nodos.csv"), ari=rd("08_aristas.csv"), rie=rd("10_riesgo.csv"),
             ras=rd("11_rasgos.csv"), son=rd("extra/12_sonidos.csv"))
    T["S"] = pd.read_parquet(parquet or raiz / "data" / "raw" / "_atlas_2019_2025" / "salidas.parquet")
    return T


# ───────────────────────── controles (resultado esperado vs observado)
def controles(T) -> pd.DataFrame:
    S, k, rows = T["S"], T["kpis"].iloc[0], []

    def add(id_, que, esperado, observado, ok, accion):
        rows.append(dict(id=id_, control=que, esperado=esperado, observado=observado,
                         resultado="OK" if ok else "REVISAR", accion=accion))

    n, nc = len(S), int(S.complete.sum())
    add("C01", "Salidas: parquet = 00_kpis = 00_anual = 00_regiones = 01_hex", f"{k.salidas:,}",
        f"{n:,} / {T['anual'].salidas.sum():,} / {T['reg'].salidas.sum():,} / {T['hexd'].salidas.sum():,}",
        n == k.salidas == T["anual"].salidas.sum() == T["reg"].salidas.sum() == T["hexd"].salidas.sum(), "—")
    add("C02", "Salidas completas: parquet = 00_kpis = suma de denominadores mensuales de 03_fenologia",
        f"{k.salidas_completas:,}", f"{nc:,} / {int(T['fen'].groupby('month').salidas_total.first().sum()):,}",
        nc == k.salidas_completas == T["fen"].groupby("month").salidas_total.first().sum(), "—")
    sin_mz = int(S.macrozona.isna().sum())
    add("C03", "07_marea suma las salidas con macrozona (2 salidas sin región quedan fuera)",
        f"{n - sin_mz:,}", f"{int(T['mar'].salidas.sum()):,}", T["mar"].salidas.sum() == n - sin_mz,
        "Documentado: 2 salidas con STATE CODE vacío (océano, lat −26,3)")
    claves = {t: T[t].sci_name for t in ["esp", "enr", "rie", "ras", "son"]}
    add("C04", "sci_name único y con la misma cobertura en 05, 05b, 10, 11 y 12", "567 en cada tabla",
        " / ".join(str(v.nunique()) for v in claves.values()),
        all(v.is_unique and v.nunique() == 567 for v in claves.values()), "—")
    sub = set(T["fen"].sci_name) | set(T["rid"].sci_name) | set(T["prob"].sci_name) | set(T["nod"].sci_name)
    add("C05", "Toda especie de 02, 03, 06_prob y 08 existe en 05_especies (sin huérfanas)", "0 huérfanas",
        f"{len(sub - set(T['esp'].sci_name))} huérfanas", sub <= set(T["esp"].sci_name), "—")
    chk = (T["esp"].salidas_con / n * 100 - T["esp"].pct_salidas).abs().max()
    add("C06", "05_especies.pct_salidas = salidas_con ÷ todas las salidas × 100", "diferencia < 1e-4",
        f"{chk:.1e}", chk < 1e-4, "—")
    chk2 = (T["nod"].salidas_con / nc * 100 - T["nod"].pct_salidas).abs().max()
    add("C07", "08_nodos.pct_salidas usa el denominador de salidas COMPLETAS (≠ 05_especies)",
        "mismo nombre de columna, mismo denominador", f"05: ÷{n:,} · 08: ÷{nc:,} (Zorzal 33,8 % vs 40,5 %)", False,
        "Renombrar a pct_salidas_completas en 02, 03, 08 y 06 (pendiente)")
    p, a = T["prob"], T["acc"][T["acc"].macrozona != "Chile"]
    m = p.drop_duplicates(["macrozona", "minutos"]).merge(a, on=["macrozona", "minutos"], suffixes=("", "_a"))
    add("C08", "06_probabilidad: denominador = salidas de 06_acumulacion y 0 ≤ probabilidad ≤ 1", "iguales",
        f"{int((m.salidas != m.salidas_a).sum())} diferencias; máx = {p.probabilidad.max():.3f}",
        bool((m.salidas == m.salidas_a).all() and p.probabilidad.between(0, 1).all()), "—")
    nu = int(T["rie"].uicn.notna().sum())
    add("C09", "10_riesgo.uicn trae la categoría (Wikidata cubre 525 de 567)", "525 con categoría",
        f"{nu} con categoría", nu == 525,
        "Corregido (nov-2026): WD_IUCN de enrich_species.py incluye las etiquetas en español de Wikidata")
    sp_ = T["enr"].sci_name.str.endswith(" sp.")
    ef = T["enr"][~sp_].estatus_final.value_counts()
    add("C10", "Introducidas (sin 'sp.') = 41, cifra de L2 tras corregir Tiuque y Diuca", "41",
        f"{int(ef.get('introducida', 0))} · Tiuque: {T['enr'].set_index('common_name').estatus_final.get('Chimango Caracara')}",
        ef.get("introducida", 0) == 41,
        "Corregido (nov-2026): introducida = código exótico Y iNaturalist no la considera nativa ni endémica")
    n_sp = int(sp_.sum())
    add("C11", "Especies: 05 incluye 1 nombre 'sp.'; el sitio (export_web.py) lo excluye → 566", "567 − 1 = 566",
        f"{T['esp'].sci_name.nunique()} − {n_sp} = {T['esp'].sci_name.nunique() - n_sp}", n_sp == 1,
        "Cifra pública: 566 especies (README, brief, sitio)")
    dn = S.groupby(S.protocol.isin(["Incidental"]))["duration_min"].apply(lambda x: x.isna().mean())
    add("C12", "Duración vacía casi solo en protocolo Incidental (ausencia estructural, no cero)", "≈ 100 % en Incidental",
        f"{dn.get(True, np.nan) * 100:.1f} % en Incidental · {dn.get(False, np.nan) * 100:.1f} % en el resto",
        dn.get(True, 0) > 0.99, "Se excluye de calculadora; no se imputa")
    return pd.DataFrame(rows)


# ───────────────────────── exploración
def explorar(T, out_t: Path):
    S = T["S"].dropna(subset=["macrozona"]).copy()
    S["ts"] = S.protocol.isin(["Traveling", "Stationary"])
    # Q1 · esfuerzo
    q1 = S.groupby("year").agg(salidas=("salida_id", "size"), pct_completas=("complete", "mean"),
                               dur_mediana=("duration_min", "median"),
                               pct_sin_duracion=("duration_min", lambda x: x.isna().mean()),
                               pct_traveling_stationary=("ts", "mean"),
                               esp_por_salida=("riqueza", "mean")).round(3)
    mix = pd.crosstab(S.year, S.macrozona, normalize="index").mul(100).round(1)[MACRO]
    mix_m = pd.crosstab(S.month, S.macrozona, normalize="index").mul(100).round(1)[MACRO]
    q1.to_csv(out_t / "q1_esfuerzo_anual.csv"); mix.to_csv(out_t / "q1_mezcla_macrozona_anual.csv")
    mix_m.to_csv(out_t / "q1_mezcla_macrozona_mensual.csv")
    top = T["hexd"].sort_values("salidas", ascending=False)
    conc = pd.DataFrame({"top_celdas": [10, 50, 100],
                         "pct_salidas": [top.salidas.head(k).sum() / top.salidas.sum() * 100 for k in (10, 50, 100)]}).round(1)
    conc.to_csv(out_t / "q1_concentracion_celdas.csv", index=False)
    # Q2a · riqueza por macrozona, con y sin igualar duración
    C = S[S.complete & S.ts & S.duration_min.between(5, 240)]
    def resumen(df, etiqueta):
        g = df.groupby("macrozona").riqueza
        return pd.DataFrame({"escenario": etiqueta, "n": g.size(), "q1": g.quantile(.25), "mediana": g.median(),
                             "q3": g.quantile(.75)}).reindex(MACRO).reset_index()
    q2a = pd.concat([resumen(C, "5–240 min (todas)"), resumen(C[C.duration_min.between(30, 59.99)], "30–59 min"),
                     resumen(C[C.duration_min.between(60, 119.99)], "60–119 min")])
    q2a.to_csv(out_t / "q2a_riqueza_por_macrozona.csv", index=False)
    dur_med = C.groupby("macrozona").duration_min.median().reindex(MACRO)
    rm_vs = {rc: C[(C.region_code == rc) & C.duration_min.between(30, 59.99)].riqueza.median() for rc in ["CL-RM", "CL-VS"]}
    # Q2b · estacionalidad estandarizada por latitud
    rid, fen, enr = T["rid"], T["fen"], T["enr"].set_index("sci_name")
    den = rid.groupby(["lat_banda", "month"]).salidas_total.max().unstack("month")
    core = den.index[(den >= 30).all(axis=1)]
    w = den.loc[core].sum(axis=1) / den.loc[core].values.sum()
    esp = ["Elaenia albiceps", "Colorhamphus parvirostris", "Numenius hudsonicus", "Sephanoides sephaniodes", "Zonotrichia capensis"]
    filas = []
    for sci in esp:
        d = rid[(rid.sci_name == sci) & rid.lat_banda.isin(core)].pivot(index="lat_banda", columns="month", values="salidas_con") \
            .reindex(index=core, columns=range(1, 13)).fillna(0)
        D = den.loc[core]
        std = (d / D).mul(w, axis=0).sum() * 100
        nat = fen[fen.sci_name == sci].set_index("month").pct_salidas
        for mth in range(1, 13):
            filas.append(dict(sci_name=sci, nombre=enr.nombre_es[sci], month=mth, pct_nacional=nat[mth],
                              pct_estandarizado=std[mth]))
    q2b = pd.DataFrame(filas).round(3)
    q2b["dif_pp"] = (q2b.pct_estandarizado - q2b.pct_nacional).round(3)
    q2b.to_csv(out_t / "q2b_estacionalidad_estandarizada.csv", index=False)
    info = dict(n_core=len(core), cobertura_core=den.loc[core].values.sum() / int(T["S"].complete.sum()),
                dur_med=dur_med, rm_vs=rm_vs)
    return S, q1, mix, mix_m, conc, q2a, q2b, info


# ───────────────────────── figuras
def fig_pipeline(path):
    fig, ax = plt.subplots(figsize=(W, 3.1)); ax.set_xlim(0, 100); ax.set_ylim(0, 48); ax.axis("off"); ax.grid(False)
    ax.set_facecolor(BG)
    def caja(x, y, w, h, t, s="", fc=LAM, ec=APOYO, tc=TXT, bold=False):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=1", fc=fc, ec=ec, lw=0.9))
        ax.text(x + w / 2, y + h * (0.64 if s else 0.5), t, ha="center", va="center", fontsize=7.6, color=tc,
                fontweight="bold" if bold else "normal")
        if s:
            ax.text(x + w / 2, y + h * 0.28, s, ha="center", va="center", fontsize=5.6, color=APOYO, family=MONO)
    def flecha(x1, y1, x2, y2, t=""):
        ax.annotate("", (x2, y2), (x1, y1), arrowprops=dict(arrowstyle="-|>", color=APOYO, lw=1))
        if t: ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 1.6, t, fontsize=6.2, color=APOYO, ha="center")
    caja(1, 32, 16, 12, "EBD Chile", "TSV ≈ 4 GB\nrelSep-2026", fc="#D6D3C2")
    caja(23, 32, 17, 12, "1 · Limpiar", "build_atlas_\ndata.py", bold=True)
    caja(46, 32, 16, 12, "salidas.parquet", "1 fila =\n1 salida")
    caja(46, 17, 16, 12, "avist.parquet", "salida ×\nespecie")
    caja(68, 32, 15, 12, "CSV 00–08", "1 por\nlámina")
    caja(1, 5, 16, 12, "APIs y AVONET", "eBird · Wikidata\niNat · XC · AVONET")
    caja(23, 5, 17, 12, "2 · Enriquecer", "enrich_\nspecies.py", bold=True)
    caja(46, 2, 16, 12, "05b, 10, 11, 12", "ficha por\nespecie")
    caja(68, 17, 15, 12, "3 · Preparar web", "export_\nweb.py", bold=True)
    caja(86, 17, 13, 12, "Sitio web", "Next.js", fc="#E4E3CF")
    caja(86, 32, 13, 12, "4 · Brief E2", "analisis_\ne2.py", fc="#EBDDD8", ec=FOCO, bold=True)
    flecha(17.3, 38, 22.7, 38); flecha(40.3, 38, 45.7, 38); flecha(54, 32, 54, 29.4)
    flecha(62.3, 38, 67.7, 38); flecha(17.3, 11, 22.7, 11); flecha(40.3, 11, 45.7, 9)
    flecha(75.5, 32, 75.5, 29.4); flecha(62.3, 8, 67.7, 21); flecha(83.3, 23, 85.7, 23)
    flecha(83.3, 38, 85.7, 38)
    fig.savefig(path, dpi=200, bbox_inches="tight"); plt.close(fig)


def fig_esquema(path):
    """Matriz tablas × columnas-clave: PK = clave de la fila · c = parte de clave compuesta · FK = referencia · 1:1 / N:1 = cardinalidad."""
    cols = ["salida_id", "sci_name", "region_code", "macrozona", "year", "month", "minutos / hora", "celda"]
    filas = [
        ("salidas.parquet", "1 salida", {"salida_id": "PK", "region_code": "N:1", "macrozona": "N:1", "year": "·", "month": "·"}),
        ("00_regiones", "1 región", {"region_code": "PK", "macrozona": "N:1"}),
        ("00_anual", "1 año", {"year": "PK"}),
        ("01_hex", "1 celda 0,25°", {"celda": "PK"}),
        ("07_marea", "año×mes×macrozona", {"macrozona": "c", "year": "c", "month": "c"}),
        ("04_reloj · 04_sol", "mes×hora×macrozona", {"macrozona": "c", "month": "c", "minutos / hora": "c"}),
        ("06_acumulacion", "macrozona×duración", {"macrozona": "c", "minutos / hora": "c"}),
        ("06_probabilidad", "macrozona×dur.×especie", {"sci_name": "N:1", "macrozona": "c", "minutos / hora": "c"}),
        ("05_especies", "1 especie", {"sci_name": "PK"}),
        ("05b · 10 · 11 · 12 · e0X", "1 especie", {"sci_name": "1:1"}),
        ("03_fenologia", "especie×mes", {"sci_name": "N:1", "month": "c"}),
        ("02_ridge", "especie×mes×franja", {"sci_name": "N:1", "month": "c"}),
        ("08_nodos · 08_aristas", "40 especies · pares", {"sci_name": "N:M"}),
    ]
    fig, ax = plt.subplots(figsize=(W, 4.9)); ax.set_xlim(0, 100); ax.set_ylim(0, len(filas) + 2.2); ax.axis("off"); ax.grid(False)
    LBL = {"salida_id": "salida\n_id", "sci_name": "sci_\nname", "region_code": "region\n_code", "macrozona": "macro\nzona", "year": "year", "month": "month", "minutos / hora": "min /\nhora", "celda": "celda"}
    x0, cw = 36, (100 - 36) / len(cols)
    for j, c in enumerate(cols):
        ax.text(x0 + cw * (j + .5), len(filas) + 1.2, LBL[c], ha="center", va="center", fontsize=6.8, family=MONO, color=TXT, fontweight="bold")
    col_f = {"PK": FOCO, "c": SOL, "N:1": MUSGO[3], "1:1": MUSGO[3], "N:M": MUSGO[3], "·": APOYO}
    for i, (t, g, d) in enumerate(filas):
        y = len(filas) - i - .5
        ax.add_patch(plt.Rectangle((0, y - .45), 100, .9, fc=LAM if i % 2 == 0 else BG, ec="none", zorder=0))
        ax.text(1, y + .12, t, fontsize=7.4, family=MONO, va="center", color=TXT, fontweight="bold")
        ax.text(1, y - .24, g, fontsize=6.6, va="center", color=APOYO)
        for j, c in enumerate(cols):
            v = d.get(c)
            if v:
                ax.add_patch(FancyBboxPatch((x0 + cw * j + 1.2, y - .27), cw - 2.4, .54, boxstyle="round,pad=0.02,rounding_size=.2", fc=col_f[v], ec="none"))
                ax.text(x0 + cw * (j + .5), y, v, ha="center", va="center", fontsize=7.2, color="#F3F1E9", family=MONO, fontweight="bold")
    ax.text(0, -.55, "PK = clave de la fila · c = parte de clave compuesta · N:1 = muchas filas → una · 1:1 = una a una · N:M = muchos a muchos · · = columna de agrupación sin unión",
            fontsize=6.4, color=APOYO, va="top")
    fig.savefig(path, dpi=200, bbox_inches="tight"); plt.close(fig)


def fig_esfuerzo(path, q1, mix):
    fig = plt.figure(figsize=(W, 4.6)); titulo(fig, "El esfuerzo se multiplicó ×2,7; la composición cambió poco",
        "Salidas por año y macrozona (a) · especies por salida (b) · duración mediana (c)")
    gs = fig.add_gridspec(2, 2, left=0.08, right=0.98, top=0.82, bottom=0.16, hspace=0.55, wspace=0.28)
    a = fig.add_subplot(gs[0, :]); bot = np.zeros(len(q1))
    cnt = pd.crosstab(q1.index, q1.index)  # placeholder para índice
    sal = (mix / 100).mul(q1.salidas, axis=0)
    for c, col in zip(MACRO, MUSGO):
        a.bar(q1.index, sal[c] / 1000, bottom=bot / 1000, color=col, width=0.7, label=c, edgecolor=LAM, lw=0.4); bot += sal[c].values
    for x, v in zip(q1.index, q1.salidas):
        a.text(x, v / 1000 + 2, f"{v / 1000:.0f}", ha="center", fontsize=7.6, family=MONO, color=TXT)
    a.set_ylabel("miles de salidas"); a.set_xticks(q1.index); a.legend(ncol=5, frameon=False, fontsize=7.2, loc="upper left", bbox_to_anchor=(0, 1.02))
    a.set_ylim(0, 135); a.grid(axis="x", visible=False)
    b = fig.add_subplot(gs[1, 0]); b.plot(q1.index, q1.esp_por_salida, color=FOCO, marker="o", ms=3.5, lw=1.6)
    b.set_ylim(0, 12); b.set_ylabel("especies por salida (media)"); b.set_xticks(q1.index); b.set_title("(b) casi constante", fontsize=8, loc="left", color=TXT)
    c = fig.add_subplot(gs[1, 1]); c.bar(q1.index, q1.dur_mediana, color=MUSGO[2], width=0.7); c.set_ylim(0, 40)
    c.set_ylabel("minutos (mediana)"); c.set_xticks(q1.index); c.set_title("(c) duración, salidas que la informan", fontsize=8, loc="left", color=TXT); c.grid(axis="x", visible=False)
    pie(fig, "Fuente: eBird Basic Dataset relSep-2026, Chile 2019–2025 · 524.379 salidas con macrozona · salidas.parquet")
    fig.savefig(path, dpi=200); plt.close(fig)


def fig_riqueza(path, q2a):
    fig = plt.figure(figsize=(W, 3.6)); titulo(fig, "Igualar la duración separa al Austral y empareja Centro y Sur",
        "Especies por salida: mediana y rango intercuartil (Q1–Q3) · salidas completas Traveling/Stationary")
    gs = fig.add_gridspec(1, 2, left=0.17, right=0.97, top=0.76, bottom=0.24, wspace=0.12)
    for i, (esc, tit) in enumerate([("5–240 min (todas)", "Todas las duraciones (5–240 min)"), ("60–119 min", "Solo salidas de 60–119 min")]):
        ax = fig.add_subplot(gs[0, i], sharey=None if i == 0 else None)
        d = q2a[q2a.escenario == esc].set_index("macrozona").reindex(MACRO)
        y = np.arange(len(MACRO))[::-1]
        for yy, (m, r) in zip(y, d.iterrows()):
            ax.plot([r.q1, r.q3], [yy, yy], color=MUSGO[2], lw=5, solid_capstyle="butt", alpha=.55)
            ax.plot(r.mediana, yy, "o", color=FOCO if m in ("Austral", "Sur") else TXT, ms=6)
            ax.text(r.q3 + .6, yy, f"{r.mediana:.0f}", va="center", fontsize=7.6, family=MONO, color=TXT)
        ax.set_yticks(y); ax.set_yticklabels([f"{m}\nn={int(d.n[m]):,}".replace(",", ".") for m in MACRO] if i == 0 else [], fontsize=7.2)
        ax.set_xlim(0, 28); ax.set_xlabel("especies por salida"); ax.set_title(tit, fontsize=8, loc="left", color=TXT); ax.grid(axis="y", visible=False)
    pie(fig, "Punto = mediana · barra = Q1–Q3 · rojo = Sur y Austral · Fuente: salidas.parquet")
    fig.savefig(path, dpi=200); plt.close(fig)


def fig_estacion(path, q2b):
    fig = plt.figure(figsize=(W, 4.3)); titulo(fig, "La estacionalidad se mantiene al fijar la latitud",
        "% de salidas completas con la especie: nacional (línea gruesa) vs. estandarizado por franjas de 0,5° (rojo)")
    gs = fig.add_gridspec(2, 2, left=0.09, right=0.98, top=0.8, bottom=0.18, hspace=0.5, wspace=0.25)
    for i, sci in enumerate(["Elaenia albiceps", "Colorhamphus parvirostris", "Numenius hudsonicus", "Sephanoides sephaniodes"]):
        d = q2b[q2b.sci_name == sci]; ax = fig.add_subplot(gs[i // 2, i % 2])
        ax.plot(d.month, d.pct_nacional, color=MUSGO[3], lw=3, alpha=.6, solid_capstyle="round")
        ax.plot(d.month, d.pct_estandarizado, color=FOCO, lw=1.2, marker="o", ms=2.5)
        ax.set_xticks(range(1, 13)); ax.set_xticklabels(MESES, fontsize=7.4); ax.set_ylim(0, None)
        mx = d.dif_pp.abs().max(); ax.set_title(f"{d.nombre.iloc[0]} · dif. máx. {mx:.1f} pp".replace(".", ","), fontsize=8, loc="left", color=TXT)
        if i % 2 == 0: ax.set_ylabel("% de salidas")
        ax.grid(axis="x", visible=False)
    pie(fig, "pp = puntos porcentuales · Fuente: 02_ridge.csv y 03_fenologia.csv (47 franjas con ≥30 salidas todos los meses)")
    fig.savefig(path, dpi=200); plt.close(fig)


def fig_poc(path, T, zona="Sur", minutos=90):
    acc = T["acc"]; a = acc[acc.macrozona == zona].sort_values("minutos")
    p = T["prob"]; p = p[(p.macrozona == zona) & (p.minutos == minutos)].sort_values("probabilidad", ascending=False).head(10)
    nom = T["enr"].set_index("sci_name").nombre_es
    p = p.assign(nombre=p.sci_name.map(nom).fillna(p.common_name))
    fila = a[a.minutos == minutos].iloc[0]
    fig = plt.figure(figsize=(W, 4.2))
    titulo(fig, f"Si salgo {minutos} min en el {zona}: ¿cuántas especies y cuáles?",
           f"{int(fila.salidas):,} salidas completas comparables · mitad de los casos entre {fila.q1:.0f} y {fila.q3:.0f} especies".replace(",", "."))
    gs = fig.add_gridspec(1, 2, left=0.08, right=0.97, top=0.76, bottom=0.24, wspace=0.62, width_ratios=[1, 1.05])
    ax = fig.add_subplot(gs[0, 0])
    ax.fill_between(a.minutos, a.q1, a.q3, color=MUSGO[0], alpha=.55, lw=0, label="Q1–Q3")
    ax.plot(a.minutos, a.mediana, color=MUSGO[4], lw=1.8, label="mediana")
    ax.plot(minutos, fila.mediana, "o", color=FOCO, ms=7, zorder=5)
    ax.annotate(f"{fila.mediana:.0f} especies", (minutos, fila.mediana), (minutos + 12, fila.mediana - 9), fontsize=8, color=FOCO,
                arrowprops=dict(arrowstyle="-", color=FOCO, lw=.8))
    ax.set_xlabel("duración de la salida (min)"); ax.set_ylabel("especies por salida"); ax.set_xlim(15, 240); ax.set_ylim(0, None)
    ax.legend(frameon=False, fontsize=7.4, loc="upper left"); ax.set_title("Más tiempo, más especies", fontsize=8.5, loc="left", color=TXT)
    ax2 = fig.add_subplot(gs[0, 1]); y = np.arange(len(p))[::-1]
    ax2.barh(y, p.probabilidad * 100, color=MUSGO[2], height=.68)
    for yy, v in zip(y, p.probabilidad * 100): ax2.text(v + 1, yy, f"{v:.0f} %", va="center", fontsize=7.6, family=MONO)
    ax2.set_yticks(y); ax2.set_yticklabels(p.nombre, fontsize=7.8); ax2.set_xlim(0, 80); ax2.set_xlabel("% de esas salidas con la especie")
    ax2.set_title("Las diez más probables", fontsize=8.5, loc="left", color=TXT); ax2.grid(axis="y", visible=False)
    pie(fig, "Fuente: eBird Basic Dataset relSep-2026 · Chile 2019–2025 · salidas completas Traveling/Stationary de 76–90 min (06_acumulacion, 06_probabilidad)")
    fig.savefig(path, dpi=200)
    tam = min(t.get_fontsize() for t in fig.findobj(mpl.text.Text) if t.get_text().strip())
    plt.close(fig)
    return fila, p, tam


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--raiz", type=Path, default=Path("."))
    ap.add_argument("--parquet", type=Path, default=None, help="ruta a salidas.parquet (por defecto data/raw/_atlas_2019_2025/)")
    args = ap.parse_args(); raiz = args.raiz.resolve()
    out_t, out_f = raiz / "docs" / "e2" / "tablas", raiz / "docs" / "e2" / "figuras"; out_t.mkdir(parents=True, exist_ok=True); out_f.mkdir(parents=True, exist_ok=True)
    T = cargar(raiz, args.parquet)
    ctr = controles(T)
    S, q1, mix, mix_m, conc, q2a, q2b, info = explorar(T, out_t)
    fig_pipeline(out_f / "f1_pipeline.png"); fig_esquema(out_f / "f2_esquema.png")
    fig_esfuerzo(out_f / "f3_esfuerzo.png", q1, mix); fig_riqueza(out_f / "f4_riqueza.png", q2a)
    fig_estacion(out_f / "f5_estacion.png", q2b)
    fila, p, tam = fig_poc(out_f / "f6_poc.png", T)
    ok = pd.DataFrame([dict(id="C13", control="Prueba de concepto (Sur, 90 min) = 06_acumulacion y 06_probabilidad",
                            esperado="mediana 16 · Q1–Q3 10–23 (cifra de L2)",
                            observado=f"mediana {fila.mediana:.0f} · Q1–Q3 {fila.q1:.0f}–{fila.q3:.0f} · n={int(fila.salidas)}",
                            resultado="OK" if (fila.mediana, fila.q1, fila.q3) == (16, 10, 23) else "REVISAR", accion="—"),
                       dict(id="C14", control="Tamaño de lectura: texto mínimo de la figura a ancho completo (6,5 in)",
                            esperado="≥ 7,4 pt", observado=f"{tam:.1f} pt", resultado="OK" if tam >= 7.4 else "REVISAR", accion="—")])
    def lum(h):
        c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
    cr = lambda a, b: (max(lum(a), lum(b)) + .05) / (min(lum(a), lum(b)) + .05)
    texto = {"texto": TXT, "apoyo": APOYO}; marcas = {"foco": FOCO, "musgo medio": MUSGO[2], "musgo oscuro": MUSGO[4]}
    mt = min(cr(v, LAM) for v in texto.values()); mm = min(cr(v, LAM) for v in marcas.values())
    ok = pd.concat([ok, pd.DataFrame([dict(id="C15", control="Contraste sobre la lámina #F3F1E9: texto (texto, apoyo) y marcas (foco, musgo medio y oscuro)",
                      esperado="texto ≥ 4,5:1 · marcas ≥ 3:1", observado=f"texto mín. {mt:.1f}:1 · marcas mín. {mm:.1f}:1",
                      resultado="OK" if mt >= 4.5 and mm >= 3 else "REVISAR", accion="Musgo claro (#A8AF78) solo como relleno separado por borde; nunca como único portador de un dato")])], ignore_index=True)
    ctr = pd.concat([ctr, ok], ignore_index=True); ctr.to_csv(out_t / "controles.csv", index=False)
    print(ctr[["id", "resultado", "observado"]].to_string(index=False))
    print("\nQ1\n", q1); print("\nconcentración\n", conc); print("\nQ2a\n", q2a.round(1)); print(info)
    print("\nQ2b dif máx por especie\n", q2b.groupby("nombre").dif_pp.apply(lambda s: s.abs().max()))


if __name__ == "__main__":
    main()
