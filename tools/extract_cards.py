"""Recorta as 81 cartas das folhas do livro (PDF) e gera cards/<id>.webp.
Uso: python3 tools/extract_cards.py <pasta com p-000.png ... p-016.png>"""
import sys, os
import numpy as np
from PIL import Image, ImageOps

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'cards')
os.makedirs(OUT, exist_ok=True)

SHEETS = {
 'p-000': ['astrologo','fanatico-religioso','empreendedor-de-startup','atriz-famosa','digital-influencer','consteladora-familiar','cetico-militante','cientista-desiludido','conspiracionista'],
 'p-002': ['filosofo','guru-de-autoajuda','historiador-revisionista','jornalista-sensacionalista','jovem-mistico','life-coach','medico-bombado','militante-ideologico','nutrologa-ortomolecular'],
 'p-004': ['patriota','politico-negacionista','professor-inquestionavel','relativista-epistemologico','terapeuta-holistica','tio-do-zap','ufologo','vendedor','vovo'],
 'p-006': ['ad-hominem','ambiguidade','apelo-ao-medo','apelo-a-piedade','causa-falsa','argumento-de-intimidacao','cherry-picking','composicao','divisao'],
 'p-008': ['vitima-perseguida','apelo-ao-natural','apelo-a-tradicao','argumento-de-autoridade','bola-de-neve','espantalho','incredulidade-pessoal','inversao-do-onus-da-prova','popularidade'],
 'p-010': ['escoces-de-verdade','evidencia-anedotica','falacia-de-nirvana','falacia-do-jogador','falsa-dicotomia','generalizacao-precipitada','falsa-simetria','tu-quoque','red-herring'],
 'p-012': ['ancoragem','confirmacao','disponibilidade','dunning-kruger','otimismo','pessimismo','representatividade','projecao','sobrevivencia'],
 'p-014': ['distribuicao-de-renda','biohacking','disputa-eleitoral','doping','ensino-religioso','educacao-sexual','etica-em-pesquisa','exploracao-espacial','fake-news'],
 'p-016': ['industria-farmaceutica','liberdade-de-expressao','medicina-alternativa','planejamento-reprodutivo','mudanca-climatica','politica-de-drogas','saude-mental','vacinacao-obrigatoria','turismo-sustentavel'],
}
W, H = 450, 720            # 5:8
PAPER = (241, 231, 208)    # pergaminho
INK = (24, 18, 30)         # tinta

def runs(profile, lo, hi, thr=0.7):
    out, start = [], None
    for i in range(max(0, lo), min(len(profile), hi)):
        if profile[i] > thr and start is None: start = i
        if profile[i] <= thr and start is not None: out.append([start, i - 1]); start = None
    if start is not None: out.append([start, min(len(profile), hi) - 1])
    merged = []
    for r in out:                       # junta linhas separadas por um vão de até 2 px
        if merged and r[0] - merged[-1][1] <= 3: merged[-1][1] = r[1]
        else: merged.append(r)
    return merged

def band(profile, guess, win=9):
    """faixa escura (molduras externas de cartas vizinhas, coladas) mais próxima de guess"""
    rs = runs(profile, guess - win, guess + win + 1)
    if not rs: return guess, guess
    return min(rs, key=lambda r: min(abs(r[0] - guess), abs(r[1] - guess)) if not (r[0] <= guess <= r[1]) else 0)

def edges(profile):
    dark = np.where(profile > 0.5)[0]
    return int(dark[0]), int(dark[-1]) + 1

LW = 4  # espessura da linha externa da moldura
report = []
for sheet, ids in SHEETS.items():
    im = Image.open(os.path.join(SRC, sheet + '.png')).convert('L')
    a = np.asarray(im) < 128
    X0, X3 = edges(a.mean(axis=0)); Y0, Y3 = edges(a.mean(axis=1))
    cw, ch = (X3 - X0) / 3, (Y3 - Y0) / 3
    for i, cid in enumerate(ids):
        r, c = divmod(i, 3)
        gx0, gx1 = round(X0 + c * cw), round(X0 + (c + 1) * cw)
        gy0, gy1 = round(Y0 + r * ch), round(Y0 + (r + 1) * ch)
        rowp = a[:, gx0 + int(cw * .3): gx0 + int(cw * .7)].mean(axis=1)   # perfil só desta carta
        colp = a[gy0 + int(ch * .3): gy0 + int(ch * .7), :].mean(axis=0)
        t = band(rowp, gy0); b = band(rowp, gy1 - 1); l = band(colp, gx0); rr = band(colp, gx1 - 1)
        top = max(t[0], t[1] - LW + 1); bottom = min(b[1], b[0] + LW - 1) + 1
        left = max(l[0], l[1] - LW + 1); right = min(rr[1], rr[0] + LW - 1) + 1
        report.append((cid, right - left, bottom - top))
        card = im.crop((left, top, right, bottom)).resize((W, H), Image.LANCZOS)
        card = ImageOps.colorize(card, black=INK, white=PAPER)
        card.save(os.path.join(OUT, cid + '.webp'), 'WEBP', quality=84, method=6)
ws = [r[1] for r in report]; hs = [r[2] for r in report]
print('largura', min(ws), max(ws), 'altura', min(hs), max(hs))
for r in report:
    if abs(r[1] - np.median(ws)) > 3 or abs(r[2] - np.median(hs)) > 3: print('conferir', r)

# "Medicina Alternativa" está cortada no topo da folha original (faltam ~13 px da moldura).
# Como a moldura é igual em todas as cartas, o topo é completado com o da carta vizinha.
def fix_top(cid, ref, sheet, nominal_h):
    im = Image.open(os.path.join(SRC, sheet + '.png')).convert('L')
    a = np.asarray(im) < 128
    X0, X3 = edges(a.mean(axis=0)); Y0, Y3 = edges(a.mean(axis=1))
    cw, ch = (X3 - X0) / 3, (Y3 - Y0) / 3
    c = SHEETS[sheet].index(cid) % 3
    gx0, gx1 = round(X0 + c * cw), round(X0 + (c + 1) * cw)
    rowp = a[:, gx0 + int(cw * .3): gx0 + int(cw * .7)].mean(axis=1)
    colp = a[int(ch * .3): int(ch * .7), :].mean(axis=0)
    b = band(rowp, round(Y0 + ch) - 1); l = band(colp, gx0); rr = band(colp, gx1 - 1)
    bottom = min(b[1], b[0] + LW - 1) + 1
    left = max(l[0], l[1] - LW + 1); right = min(rr[1], rr[0] + LW - 1) + 1
    missing = nominal_h - bottom
    canvas = Image.new('L', (right - left, nominal_h), 255)
    canvas.paste(im.crop((left, 0, right, bottom)), (0, missing))
    card = ImageOps.colorize(canvas.resize((W, H), Image.LANCZOS), black=INK, white=PAPER)
    refim = Image.open(os.path.join(OUT, ref + '.webp')).convert('RGB')
    cut = int(round((missing + 4) * H / nominal_h))
    card.paste(refim.crop((0, 0, W, cut)), (0, 0))
    card.save(os.path.join(OUT, cid + '.webp'), 'WEBP', quality=84, method=6)
    print('topo completado:', cid, 'faltavam', missing, 'px')

fix_top('medicina-alternativa', 'liberdade-de-expressao', 'p-016', int(np.median(hs)))
