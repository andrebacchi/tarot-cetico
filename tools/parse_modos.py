"""Extrai do capítulo 1 do livro (tools/livro.txt) as regras dos seis modos de jogo e gera src/modos.json.
Cada modo vira uma lista de blocos: p (parágrafo), h (subtítulo) e li (item numerado); 'rot' é o rótulo em negrito."""
import re, json, os
HERE = os.path.dirname(__file__)
raw = open(os.path.join(HERE, 'livro.txt'), encoding='utf-8').read().replace('\f', '\n')
MODOS = [('leitura', 'Modo Solo de Leitura'), ('escrita', 'Modo Solo de Escrita Criativa'), ('educativo', 'Modo Educativo'),
         ('debate', 'Modo Debate'), ('identificacao', 'Modo Identificação de Falácias'), ('tarologo', 'Modo Tarólogo Cético')]
ROTULOS = ['Exemplo', 'Regra Opcional com Cartas de Cenário', 'Moderação', 'Número de rodadas', 'Elemento de Risco opcional (Regra opcional)']
SKIP = re.compile(r'^\s*(-\d+-|ANDRÉ D\. BACCHI|TAROT CÉTICO: “CARTOMANCIA” RACIONAL)\s*$')

lines = [l.rstrip() for l in raw.split('\n')]
ini = next(i for i, l in enumerate(lines) if l.strip() == 'Modo Solo de Leitura')
fim = next(i for i, l in enumerate(lines) if i > ini and l.strip() == 'ARQUÉTIPOS')
heads = {t: k for k, t in MODOS}
sec, cur = {}, None
for l in lines[ini:fim]:
    s = l.strip()
    if SKIP.match(l):
        if cur: sec[cur].append('')
        continue
    if re.match(r'^\d\.$', s): cur = None; continue
    if s in heads: cur = heads[s]; sec[cur] = []; continue
    if cur: sec[cur].append(s)

def blocks(ls):
    out, buf = [], []
    def flush():
        if buf: out.append(re.sub(r'\s+', ' ', ' '.join(buf)).strip()); buf.clear()
    for l in ls:
        if not l: flush(); continue
        if re.match(r'^\d\)\s', l): flush()
        buf.append(l)
    flush()
    merged = []
    for b in out:
        item = re.match(r'^\d\)\s', b)
        if merged and not item and (merged[-1][-1] not in '.!?:”"' or b[0].islower()) and len(merged[-1]) > 60:
            merged[-1] += ' ' + b
        else: merged.append(b)
    return merged

res = []
for k, titulo in MODOS:
    bl = []
    for b in blocks(sec[k]):
        m = re.match(r'^(\d)\)\s+(.*)$', b)
        if m:
            t = m.group(2); r = re.match(r'^([^:]{3,60}):\s+(.*)$', t)
            bl.append({'t': 'li', 'rot': r.group(1), 'x': r.group(2)} if r else {'t': 'li', 'x': t})
            continue
        rot = next((r for r in ROTULOS if b.startswith(r + ':')), None)
        if rot: bl.append({'t': 'p', 'rot': rot, 'x': b[len(rot) + 1:].strip()})
        elif len(b) < 60 and b[-1] != '.': bl.append({'t': 'h', 'x': b.rstrip(':')})
        else: bl.append({'t': 'p', 'x': b})
    res.append({'id': k, 'titulo': titulo, 'blocos': bl})
json.dump(res, open(os.path.join(HERE, '..', 'src', 'modos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for m in res:
    print('\n##', m['titulo'])
    for b in m['blocos']: print(f"  [{b['t']}]{'{'+b['rot']+'}' if 'rot' in b else ''} {b['x'][:95]}{'…' if len(b['x'])>95 else ''} ⟂{b['x'][-22:]}")
