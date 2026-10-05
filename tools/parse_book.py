"""Lê o texto do livro (tools/livro.txt, gerado com `pdftotext -layout`) e gera src/cartas.json
com o texto de cada carta, sem alterar as palavras do autor."""
import re, json, os, unicodedata
HERE = os.path.dirname(__file__)
raw = open(os.path.join(HERE, 'livro.txt'), encoding='utf-8').read().replace('\f', '\n')

# (título no livro, nome na carta, artigo)
ARQ = [("Astrólogo","Astrólogo","o"),("Atriz Famosa","Atriz Famosa","a"),("Cético Militante","Cético Militante","o"),
 ("Cientista desiludido","Cientista Desiludido","o"),("Consteladora Familiar","Consteladora Familiar","a"),
 ("Conspiracionista","Conspiracionista","o"),("Digital Influencer","Digital Influencer","o"),
 ("Empreendedor de Startup","Empreendedor de Startup","o"),("Fanático Religioso","Fanático Religioso","o"),
 ("Filósofo","Filósofo","o"),("Guru de Autoajuda","Guru de Autoajuda","o"),("Historiador Revisionista","Historiador Revisionista","o"),
 ("Jornalista Sensacionalista","Jornalista Sensacionalista","o"),("Jovem Místico","Jovem Místico","o"),("Life Coach","Life Coach","o"),
 ("Médico “Bombado”","Médico Bombado","o"),("Militante Ideológico","Militante Ideológico","o"),
 ("Nutrólogo Ortomolecular","Nutróloga Ortomolecular","a"),("Patriota","Patriota","o"),("Político Negacionista","Político Negacionista","o"),
 ("Professor Inquestionável","Professor Inquestionável","o"),("Relativista Epistemológico","Relativista Epistemológico","o"),
 ("Terapeuta Holística","Terapeuta Holística","a"),("Tio do Zap","Tio do Zap","o"),("Ufólogo","Ufólogo","o"),
 ("Vendedor","Vendedor","o"),("Vovó","Vovó","a")]
FAL = ["Ad Hominem","Ambiguidade","Apelo à Piedade","Apelo à Tradição","Apelo ao Medo","Apelo ao Natural","Argumento de Intimidação",
 "Argumento de Autoridade","Bola de Neve","Causa Falsa","Cherry Picking","Composição","Divisão","Escocês de Verdade","Espantalho",
 "Evidência Anedótica","Falácia de Nirvana","Falácia do Jogador","Falsa Dicotomia","Falsa Simetria","Generalização Precipitada",
 ("Incredulidade pessoal","Incredulidade Pessoal"),"Inversão do Ônus da Prova","Popularidade","Red Herring","Tu Quoque","Vítima Perseguida"]
VIE = ["Ancoragem","Confirmação","Disponibilidade","Dunning-Kruger","Otimismo","Pessimismo","Projeção","Representatividade","Sobrevivência"]
CEN = [("“Biohacking”","“Biohacking”"),"Distribuição de Renda",("Disputa Política Eleitoral","Disputa Eleitoral"),("Doping no Esporte","Doping"),
 "Educação Sexual",("Ensino Religioso nas Escolas","Ensino Religioso"),("Ética em Pesquisa Científica","Ética em Pesquisa"),"Exploração Espacial",
 ("Fake News e Desinformação","Fake News"),"Indústria Farmacêutica","Liberdade de Expressão","Medicina Alternativa","Mudança Climática",
 "Planejamento Reprodutivo","Política de Drogas","Saúde Mental","Turismo Sustentável","Vacinação Obrigatória"]

def slug(s):
    s = unicodedata.normalize('NFD', s); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

entries = []
for b, c, art in ARQ: entries.append(dict(tipo='arquetipo', livro=b, nome=c, artigo=art))
for group, tipo in ((FAL, 'falacia'), (VIE, 'vies'), (CEN, 'cenario')):
    for x in group:
        b, c = x if isinstance(x, tuple) else (x, x)
        entries.append(dict(tipo=tipo, livro=b, nome=c))
for e in entries: e['id'] = slug(e['nome'])

SKIP = re.compile(r'^\s*(-\d+-|ANDRÉ D\. BACCHI|TAROT CÉTICO: “CARTOMANCIA” RACIONAL)\s*$')
lines = [l.rstrip() for l in raw.split('\n')]
start = next(i for i, l in enumerate(lines) if l.strip() == 'ARQUÉTIPOS' and i > 300)
lines = lines[start:]
heads = {e['livro']: e for e in entries}
sections, cur = {}, None
for l in lines:
    s = l.strip()
    if SKIP.match(l): 
        if cur is not None: sections[cur].append('')
        continue
    if re.match(r'^\d\.$', s): cur = None; continue           # início de capítulo
    if s in heads and heads[s]['id'] not in sections: cur = heads[s]['id']; sections[cur] = []; continue
    if cur is not None: sections[cur].append(s)

def blocks(ls):
    out, buf = [], []
    def flush():
        if buf:
            t = ''
            for x in buf: t = (t[:-1] + '-' + x) if t.endswith('-') else (t + ' ' + x if t else x)
            out.append(re.sub(r'\s+', ' ', t).strip()); buf.clear()
    for l in ls:
        if not l: flush(); continue
        if l.startswith('•'): flush()
        buf.append(l)
    flush()
    merged = []
    for b in out:   # parágrafos partidos pela quebra de página
        if merged and not b.startswith('•') and not merged[-1].startswith('•') and (merged[-1][-1] not in '.!?:”"' or b[0].islower()):
            merged[-1] = (merged[-1][:-1] + '-' + b) if merged[-1].endswith('-') else merged[-1] + ' ' + b
        elif merged and merged[-1].startswith('•') and b[0].islower() and not b.startswith('•'):
            merged[-1] += ' ' + b
        else: merged.append(b)
    return merged

def unq(s): return s.strip().strip('"“”').strip()

problems = []
for e in entries:
    bl = blocks(sections.get(e['id'], []))
    if not bl: problems.append(('sem texto', e['id'])); continue
    if e['tipo'] == 'arquetipo':
        intro, tr = [], []
        for b in bl:
            m = re.match(r'^([^:.]{3,48}): (.+)$', b)
            if m and intro: tr.append([m.group(1), m.group(2)])
            else: intro.append(b)
        e['texto'] = intro; e['tracos'] = tr
        if len(tr) != 4 or len(intro) != 1: problems.append(('arquetipo', e['id'], len(intro), len(tr)))
    elif e['tipo'] in ('falacia', 'vies'):
        i = next((k for k, b in enumerate(bl) if b.startswith('Exemplo:')), None)
        if i is None: problems.append(('sem exemplo', e['id'])); continue
        e['texto'] = bl[:i]; e['exemplo'] = ' '.join(bl[i:])[len('Exemplo:'):].strip()
        e['exemplo'] = e['exemplo'][0].upper() + e['exemplo'][1:]
    else:
        i = next(k for k, b in enumerate(bl) if b.startswith('Frases do senso comum'))
        j = next(k for k, b in enumerate(bl) if b.startswith('Perguntas que podem'))
        e['texto'] = bl[:i]
        e['frases'] = [unq(b[1:]) for b in bl[i+1:j] if b.startswith('•')]
        rest = bl[j+1:]
        e['perguntas'] = [unq(b[1:]) for b in rest if b.startswith('•')]
        nota = [b for b in rest if not b.startswith('•')]
        if nota: e['nota'] = nota
        if len(e['frases']) not in (4, 5) or len(e['perguntas']) not in (4, 5): problems.append(('cenario', e['id'], len(e['frases']), len(e['perguntas'])))

# Erros evidentes de digitação do original
a = next(e for e in entries if e['id'] == 'astrologo')
if a['tracos'][-1][1].endswith('"'): a['tracos'][-1][1] = a['tracos'][-1][1][:-1]

json.dump(entries, open(os.path.join(HERE, '..', 'src', 'cartas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(e['tipo'] for e in entries), 'problemas:', problems)
missing = [e['id'] for e in entries if not os.path.exists(os.path.join(HERE, '..', 'cards', e['id'] + '.webp'))]
print('sem imagem:', missing)
