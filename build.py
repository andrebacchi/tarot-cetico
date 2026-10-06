#!/usr/bin/env python3
"""Monta o app a partir de src/.
  python3 build.py            -> index.html e sw.js (site completo, para o GitHub Pages)
  python3 build.py artifact   -> dist/artifact.html (página para publicar como artefato, sem instalação)
As imagens das cartas ficam em cards/ e são referenciadas por caminho relativo.
A cada atualização publicada, aumente VERSAO: ela aparece no rodapé e renova o cache de quem instalou o app."""
import json, os, re, sys, urllib.parse

RAIZ = os.path.dirname(os.path.abspath(__file__))
VERSAO = '0.4'
FIXOS = 'tarot-cetico-fixos-v1'   # cache das cartas e fontes; só mude se as imagens das cartas mudarem
SITE = 'https://andrebacchi.github.io/tarot-cetico/'
HUB = 'https://andrebacchi.github.io/bacchilab/'
LIVRO = 'https://drive.google.com/file/d/1Zi7Wb5T2tQAeCNduO-DvIcjNKGJ6-aE_/view'
FONTES = 'https://fonts.googleapis.com/css2?family=Macondo&family=Macondo+Swash+Caps&family=Alegreya:ital,wght@0,400;0,500;0,700;1,400&family=Alegreya+Sans:wght@400;500;700&display=swap'
TITULO = 'Tarot Cético'
DESCRICAO = 'Versão digital do livro-jogo Tarot Cético: “cartomancia” racional, de André D. Bacchi.'
ARTEFATO = len(sys.argv) > 1 and sys.argv[1] == 'artifact'

def ler(nome):
    with open(os.path.join(RAIZ, 'src', nome), encoding='utf-8') as f:
        return f.read()

def dados(nome):
    d = json.loads(ler(nome))
    if isinstance(d, dict): d.pop('_nota', None)
    return d

def compacto(d):
    return json.dumps(d, ensure_ascii=False, separators=(',', ':'))

def svg_uri(nome):
    svg = re.sub(r'>\s+<', '><', ler(nome).strip())
    return 'data:image/svg+xml,' + urllib.parse.quote(svg, safe="/:=;,'()!*@ ")

cartas, leituras, hoje = dados('cartas.json'), dados('leituras.json'), dados('hoje.json')
arq = [c['id'] for c in cartas if c['tipo'] == 'arquetipo']
arg = [c['id'] for c in cartas if c['tipo'] in ('falacia', 'vies')]
faltam = [i for i in arq if i not in leituras['arquetipos']] + [i for i in arg if i not in leituras['argumentos']]
assert not faltam, f'leituras.json sem texto para: {faltam}'
faltam = [i for i in arq + arg if i not in hoje['cartas']]
assert not faltam and len(hoje['semana']) == 7, f'hoje.json incompleto: {faltam}'

css = ler('app.css').replace('__VERSO__', svg_uri('verso.svg')).replace('__TRAMA__', svg_uri('trama.svg'))
js = (ler('app.js')
      .replace('__CARTAS__', compacto(cartas))
      .replace('__LEITURAS__', compacto(leituras))
      .replace('__MODOS__', compacto(dados('modos.json')))
      .replace('__HOJE__', compacto(hoje))
      .replace('__PWA__', 'false' if ARTEFATO else 'true')
      .replace('__FIXOS__', FIXOS))
corpo = ler('body.html').replace('__LIVRO__', LIVRO).replace('__VERSAO__', VERSAO).replace('__HUB__', HUB)

miolo = f'''<title>{TITULO}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTES}">
<style>
{css}</style>
{corpo}
<script>
{js}</script>
'''

def gravar(caminho, texto):
    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(texto)
    print(os.path.relpath(caminho, RAIZ), f'{len(texto.encode()) / 1024:.0f} KB')

if ARTEFATO:
    os.makedirs(os.path.join(RAIZ, 'dist'), exist_ok=True)
    gravar(os.path.join(RAIZ, 'dist', 'artifact.html'), miolo)
else:
    cabeca, resto = miolo.split('<style>', 1)
    estilo, resto = resto.split('</style>', 1)
    gravar(os.path.join(RAIZ, 'index.html'), f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{DESCRICAO}">
<meta name="theme-color" content="#231636">
<meta property="og:title" content="{TITULO}">
<meta property="og:description" content="{DESCRICAO}">
<meta property="og:image" content="{SITE}icons/icon-512.png">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" href="icons/favicon-64.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{TITULO}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
{cabeca}<style>
:root{{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}}
{estilo}</style>
</head>
<body>
{resto}</body>
</html>
''')
    gravar(os.path.join(RAIZ, 'sw.js'), ler('sw.js').replace('__VERSAO__', VERSAO).replace('__FIXOS__', FIXOS))
