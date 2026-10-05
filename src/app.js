(() => {
'use strict';

/* Dados: CARTAS e MODOS vêm do livro (tools/parse_book.py e tools/parse_modos.py);
   L são os textos novos do modo Tarólogo (src/leituras.json). */
const CARTAS = __CARTAS__;
const L = __LEITURAS__;
const MODOS = __MODOS__;
const HOJE = __HOJE__;       // textos de "A carta de hoje" (src/hoje.json)
const PWA = __PWA__;         // falso na versão de artefato: sem instalação nem service worker
const FIXOS = '__FIXOS__';   // cache das cartas e fontes (o mesmo nome usado no sw.js)
const SITE = 'https://andrebacchi.github.io/tarot-cetico/';

/* Trecho do capítulo 1 do livro, citado na revelação. */
const FORER = 'O "Efeito Forer," também conhecido como "Efeito Barnum," é um fenômeno psicológico que se refere à tendência das pessoas de considerar descrições vagas e generalizadas sobre a personalidade como altamente precisas para si próprias. Este efeito leva a acreditarmos que afirmações genéricas, que na verdade poderiam aplicar-se a uma grande parte da população, são específicas e exclusivas para nós.';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const porId = Object.fromEntries(CARTAS.map(c => [c.id, c]));
const ARQ = CARTAS.filter(c => c.tipo === 'arquetipo');
const ARG = CARTAS.filter(c => c.tipo === 'falacia' || c.tipo === 'vies');
const CEN = CARTAS.filter(c => c.tipo === 'cenario');
const TIPO = { arquetipo: 'Arquétipo', falacia: 'Falácia', vies: 'Viés', cenario: 'Cenário' };
const VERSO = { arquetipo: 'Arquétipo', falacia: 'Falácia · Viés', vies: 'Falácia · Viés', cenario: 'Cenário' };
const POS = [{ chave: 'passado', nome: 'Passado' }, { chave: 'presente', nome: 'Presente' }, { chave: 'futuro', nome: 'Futuro' }];

const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = ms => (calmo ? 1 : ms);
const espera = ms => new Promise(r => setTimeout(r, T(ms)));
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const img = id => `cards/${id}.webp`;
const palavras = t => (t.trim().match(/\S+/g) || []).length;

function acaso(n) { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; }
function sortear(lista, n) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = acaso(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
const um = lista => lista[acaso(lista.length)];

/* Conveniências guardadas no próprio aparelho (rascunho, código da turma). O app funciona sem elas. */
const cofre = {
  ler(k) { try { return JSON.parse(localStorage.getItem('tarot-cetico:' + k)); } catch (_) { return null; } },
  gravar(k, v) { try { if (v == null) localStorage.removeItem('tarot-cetico:' + k); else localStorage.setItem('tarot-cetico:' + k, JSON.stringify(v)); } catch (_) { /* sem armazenamento */ } }
};

/* ---------- códigos de turma (sem servidor) ----------
   O código da turma e o código pessoal do aluno definem as cartas. Assim, o aparelho do professor
   reconstrói a mão de qualquer aluno só com o código (mesma ideia do Bingo do Picareta). */
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1, para não confundir ao ditar
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0) ^ (h1 >>> 0)) >>> 0;
}
function embaralharCom(lista, semente) {
  let a = hash(semente);
  const r = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const arr = [...lista];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const codigoNovo = n => Array.from({ length: n }, () => ALFA[acaso(ALFA.length)]).join('');
const limparCodigo = s => [...String(s || '').toUpperCase()].filter(ch => ALFA.includes(ch)).join('');
/* Turma: 4 caracteres ao acaso + 1 que diz o cenário (o primeiro do alfabeto = sem cenário). */
const novaTurma = cenario => codigoNovo(4) + ALFA[cenario ? CEN.indexOf(cenario) + 1 : 0];
function lerTurma(cod) {
  if (!cod || cod.length !== 5) return null;
  const i = ALFA.indexOf(cod[4]) - 1;
  if (i < -1 || i >= CEN.length) return null;
  return { cod, cen: i < 0 ? null : CEN[i] };
}
/* Código pessoal: 3 caracteres ao acaso + 1 de conferência, que só bate com a turma certa. */
const confere = (turma, base) => ALFA[hash('confere:' + turma + ':' + base) % ALFA.length];
const novoPessoal = turma => { const b = codigoNovo(3); return b + confere(turma, b); };
const pessoalValido = (turma, p) => p.length === 4 && confere(turma, p.slice(0, 3)) === p[3];
function maoDe(turma, pessoal) {
  const s = turma + ':' + pessoal;
  return { arq: embaralharCom(ARQ, 'arquetipo:' + s)[0], args: embaralharCom(ARG, 'argumentos:' + s).slice(0, 3) };
}

/* ---------- carta ---------- */
function rotular(e, c, virada) {
  if (e.tagName === 'BUTTON') e.setAttribute('aria-label', virada ? `${TIPO[c.tipo]}: ${c.nome}. Abrir a carta.` : 'Carta virada para baixo');
}
function criarCarta(c, { virada = false, tag = 'button', tipo = c && c.tipo } = {}) {
  const e = document.createElement(tag);
  e.className = 'carta' + (virada ? ' virada' : '');
  if (tag === 'button') e.type = 'button';
  const frente = c ? `<span class="face frente"><img src="${img(c.id)}" alt="" draggable="false"></span>` : '';
  e.innerHTML = `<span class="giro"><span class="face verso"><span class="tipo">${VERSO[tipo]}</span></span>${frente}</span>`;
  if (c) { e.dataset.id = c.id; rotular(e, c, virada); }
  return e;
}
function voar(carta, de) {
  if (!de.width) return Promise.resolve();
  const casa = carta.parentElement;
  const para = carta.getBoundingClientRect();
  const dx = de.left + de.width / 2 - (para.left + para.width / 2);
  const dy = de.top + de.height / 2 - (para.top + para.height / 2);
  const s = de.width / carta.offsetWidth;
  casa.style.zIndex = 40;
  return carta.animate([
    { transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(0deg)` },
    { transform: `translate(${dx * 0.35}px,${dy * 0.35 - para.height * 0.1}px) scale(1.1) rotate(-9deg)`, offset: 0.6 },
    { transform: 'translate(0,0) scale(1) rotate(0deg)' }
  ], { duration: T(680), easing: 'cubic-bezier(.3,.6,.25,1)', fill: 'backwards' }).finished.catch(() => {}).then(() => { casa.style.zIndex = ''; });
}
function virarCarta(carta, c) {
  carta.classList.add('virada');
  rotular(carta, c, true);
  return carta.animate([
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-6%) scale(1.08)', offset: 0.45 },
    { transform: 'translateY(0) scale(1)' }
  ], { duration: T(780), easing: 'ease-in-out' }).finished.catch(() => {});
}
function montarPilha(monte, n = 7) {
  const p = $('.pilha', monte);
  p.innerHTML = '';
  for (let k = 0; k < n; k++) { const s = document.createElement('span'); s.className = 'lamina'; s.style.setProperty('--k', k); p.append(s); }
}
function embaralharMonte(monte) {
  const ls = $$('.lamina', monte);
  return Promise.all(ls.map((l, i) => {
    const d = i % 2 ? 1 : -1;
    return l.animate([
      { transform: 'none', zIndex: i },
      { transform: `translate(${d * 60}%,${-4 - i}%) rotate(${d * (7 + i)}deg)`, zIndex: i, offset: 0.22 },
      { transform: `translate(${d * 8}%,0) rotate(${d * 1.5}deg)`, zIndex: ls.length - i, offset: 0.46 },
      { transform: `translate(${-d * 54}%,${3 + i}%) rotate(${-d * (6 + i)}deg)`, zIndex: ls.length - i, offset: 0.7 },
      { transform: 'none', zIndex: i }
    ], { duration: T(1300), delay: T(i * 45), easing: 'cubic-bezier(.45,0,.35,1)' }).finished.catch(() => {});
  }));
}
function alvo(el) {
  $$('.alvo').forEach(x => x.classList.remove('alvo'));
  if (el) el.classList.add('alvo');
}

/* ---------- painel lateral (fala + botões), comum aos modos ---------- */
function criarPainel(fala, acao) {
  const P = {
    ocupado: false,
    dizer(html, limpar = false) {
      if (limpar) fala.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'fala-bloco';
      d.innerHTML = html;
      fala.append(d);
      requestAnimationFrame(() => fala.scrollTo({ top: d.offsetTop - 10, behavior: calmo ? 'auto' : 'smooth' }));
      return d;
    },
    botoes(lista) {
      acao.innerHTML = '';
      const caixa = lista.length > 1 ? acao.appendChild(Object.assign(document.createElement('div'), { className: 'acao-dupla' })) : acao;
      lista.forEach(([rotulo, fn, secundario]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn' + (secundario ? '' : ' principal'); b.textContent = rotulo;
        b.addEventListener('click', () => P.travar(fn));
        caixa.append(b);
      });
    },
    botao(rotulo, fn) { P.botoes([[rotulo, fn]]); },
    async travar(fn) {
      if (P.ocupado) return;
      P.ocupado = true;
      const travados = $$('button', acao).filter(b => !b.disabled);
      travados.forEach(b => { b.disabled = true; });
      try { await fn(); } finally { P.ocupado = false; travados.forEach(b => { b.disabled = false; }); }
    }
  };
  return P;
}

/* ---------- navegação ---------- */
const telas = { capa: $('#tela-capa'), hoje: $('#tela-hoje'), consulta: $('#tela-consulta'), escrita: $('#tela-escrita'), educativo: $('#tela-educativo'), baralho: $('#tela-baralho') };
function ir(nome) {
  $$('dialog[open]').forEach(d => d.close());
  for (const [k, t] of Object.entries(telas)) t.hidden = k !== nome;
  telas[nome].scrollTop = 0;
  if (nome === 'consulta' && C.fase === 'nova') novaConsulta();
  if (nome === 'escrita') abrirEscrita();
  if (nome === 'educativo') abrirEducativo();
  if (nome === 'hoje') abrirHoje();
  if (nome === 'baralho') montarBaralho();
  try { history.replaceState(null, '', nome === 'capa' ? location.pathname + location.search : '#' + nome); } catch (_) { /* sem histórico em páginas embutidas */ }
}
document.addEventListener('click', e => {
  const quer = s => e.target.closest(s);
  let el;
  if ((el = quer('[data-ir]'))) return ir(el.dataset.ir);
  if ((el = quer('[data-fechar]'))) return el.closest('dialog').close();
  if ((el = quer('[data-abrir]'))) return abrirFicha(el.dataset.abrir);
  if ((el = quer('[data-regras]'))) return abrirRegras(el.dataset.regras);
  if (quer('[data-nova]')) { $('#truque').close(); novaConsulta(); }
});
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------- capa ---------- */
function montarLeque() {
  // Dois versos atrás e três cartas abertas na frente (um arquétipo, um cenário e uma falácia ou viés).
  const leque = $('#leque');
  const mao = [[null, -27, 'arquetipo'], [null, 27, 'cenario'], [um(ARQ), -14], [um(CEN), 14], [um(ARG), 0]];
  mao.forEach(([c, giro, tipo]) => {
    const e = criarCarta(c, { virada: !!c, tag: 'span', tipo: tipo || c.tipo });
    e.style.setProperty('--g', giro + 'deg');
    leque.append(e);
  });
}

/* ---------- regras (texto do livro) ---------- */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const NO_APP = {
  leitura: ['Abra o baralho e toque em qualquer carta para ler o texto do livro sobre ela.', 'baralho'],
  escrita: ['As cartas são sorteadas na mesa e o texto é escrito na própria tela, com contador de palavras e cronômetro de 15 minutos opcional. A autoavaliação vem no fim.', 'escrita'],
  educativo: ['O professor abre uma turma e passa o código. Cada aluno recebe as cartas no próprio celular, com um código pessoal. Com esse código, o professor mostra na tela as cartas de quem vai falar. Também dá para sortear sem turma.', 'educativo'],
  debate: ['Este modo ainda está em construção.', null],
  identificacao: ['Este modo ainda está em construção.', null],
  tarologo: ['Para jogar sozinho, o app faz o papel do tarólogo: você tira e vira as cartas, e a leitura aparece na tela. No fim, você dá uma nota e o truque é revelado. A versão em duplas ainda está em construção.', 'consulta']
};
function blocosHtml(blocos) {
  let html = '', lista = false;
  const item = b => (b.rot ? `<b>${esc(b.rot)}:</b> ` : '') + esc(b.x);
  for (const b of blocos) {
    if (b.t === 'li') { if (!lista) { html += '<ol>'; lista = true; } html += `<li>${item(b)}</li>`; continue; }
    if (lista) { html += '</ol>'; lista = false; }
    html += b.t === 'h' ? `<h5>${esc(b.x)}</h5>` : `<p>${item(b)}</p>`;
  }
  return html + (lista ? '</ol>' : '');
}
function abrirRegras(id) {
  $('#regras-corpo').innerHTML = `
    <p class="chapa">Regras do livro</p>
    <h3>Seis modos de jogo</h3>
    <p>O Tarot Cético foi projetado para ser versátil, oferecendo seis modos distintos de interação e aprendizado. Toque em um modo para ler as regras.</p>
    ${MODOS.map((m, i) => {
      const [nota, tela] = NO_APP[m.id];
      const abrir = tela ? ` <button class="elo" type="button" data-ir="${tela}">Abrir este modo</button>` : '';
      return `<details id="regra-${m.id}"${m.id === id ? ' open' : ''}>
        <summary><span class="num">${ROMANOS[i]}</span>${esc(m.titulo)}</summary>
        <div class="regra"><p class="no-app"><b>Neste app.</b> ${nota}${abrir}</p>${blocosHtml(m.blocos)}</div>
      </details>`;
    }).join('')}
    <p class="fonte">Regras do livro <cite>Tarot Cético: “cartomancia” racional</cite>, capítulo 1.</p>`;
  const d = $('#regras');
  if (!d.open) d.showModal();
  const aberto = id && $('#regra-' + id);
  d.scrollTop = aberto ? aberto.offsetTop - 64 : 0;
}

/* ---------- modo Tarólogo Cético ---------- */
const C = { fase: 'nova', arq: [], arg: [], n: 0, k: 0, nota: null, cartas: [] };
const monteArq = $('#monte-arq'), monteFal = $('#monte-fal'), acao = $('#acao');
const posicoes = $$('.posicao');
const PC = criarPainel($('#fala'), acao);

function novaConsulta() {
  Object.assign(C, { fase: 'inicio', arq: sortear(ARQ, 3), arg: sortear(ARG, 3), n: 0, k: 0, nota: null, cartas: [] });
  posicoes.forEach(p => {
    const casa = $('.casa', p), casaF = $('.casa-fal', p);
    casa.innerHTML = ''; casa.classList.remove('brilho');
    casaF.innerHTML = ''; casaF.classList.remove('embaixo');
    $('.legenda', p).innerHTML = '';
  });
  montarPilha(monteArq); montarPilha(monteFal);
  $('#conta-arq').textContent = ARQ.length;
  $('#conta-fal').textContent = ARG.length;
  [...C.arq, ...C.arg].forEach(c => { new Image().src = img(c.id); });
  alvo(null);
  PC.dizer('<h4>O tarólogo</h4><p>Sente-se. Pense em uma pergunta sobre a sua vida e guarde-a para você.</p><p>As cartas vão falar do seu passado, do seu presente e do seu futuro.</p>', true);
  PC.botao('Embaralhar as cartas', embaralhar);
}

async function embaralhar() {
  await Promise.all([embaralharMonte(monteArq), embaralharMonte(monteFal)]);
  C.fase = 'tirar';
  PC.dizer('<p>Baralho embaralhado. Tire três cartas do monte de arquétipos: uma para o passado, uma para o presente e uma para o futuro.</p>');
  alvo(monteArq);
  PC.botao('Tirar a carta do passado', tirar);
}

async function tirar() {
  if (C.fase !== 'tirar') return;
  const i = C.n, casa = $('.casa', posicoes[i]);
  const carta = criarCarta(C.arq[i]);
  carta.style.setProperty('--tilt', [-1.4, 0.8, 1.7][i] + 'deg');
  carta.addEventListener('click', () => toqueCarta(i));
  const de = $('.pilha', monteArq).getBoundingClientRect();
  casa.append(carta);
  C.cartas[i] = carta;
  $('#conta-arq').textContent = ARQ.length - (i + 1);
  if (i === 1) { const topo = $('.lamina:last-child', monteArq); if (topo) topo.remove(); }
  await voar(carta, de);
  C.n++;
  if (C.n < 3) return PC.botao(`Tirar a carta do ${POS[C.n].chave}`, tirar);
  C.fase = 'virar';
  PC.dizer('<p>Passado, presente e futuro estão na mesa. Vire a primeira carta.</p>');
  alvo(C.cartas[0]);
  PC.botao('Virar a carta do passado', virar);
}
monteArq.addEventListener('click', () => { if (C.fase === 'tirar') PC.travar(tirar); });
monteFal.addEventListener('click', () => { if (C.fase === 'argumento') PC.travar(argumento); });

function toqueCarta(i) {
  if (C.cartas[i].classList.contains('virada')) return abrirFicha(C.arq[i].id);
  if (C.fase === 'virar' && i === C.k) PC.travar(virar);
}

async function guardarEmbaixo(carta, casa) {
  const o = { duration: T(300), easing: 'cubic-bezier(.4,0,.6,1)' };
  const desce = carta.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(72%)' }], { ...o, fill: 'forwards' });
  await desce.finished.catch(() => {});
  casa.classList.add('embaixo');
  const sobe = carta.animate([{ transform: 'translateY(72%)' }, { transform: 'translateY(0)' }], o);
  desce.cancel();
  await sobe.finished.catch(() => {});
}

/* Passo 1 de cada posição: o cliente vira o arquétipo e ouve a leitura. */
async function virar() {
  if (C.fase !== 'virar') return;
  const i = C.k, pos = POS[i], p = posicoes[i], arq = C.arq[i];
  alvo(null);
  $('.casa', p).classList.add('brilho');
  await virarCarta(C.cartas[i], arq);
  $('.legenda', p).textContent = arq.nome;
  const anuncio = um(L.anuncio[pos.chave]).replace('{quem}', `<b>${arq.artigo} ${esc(arq.nome)}</b>`);
  PC.dizer(`<h4>${pos.nome}</h4><p>${anuncio} ${esc(L.arquetipos[arq.id][pos.chave])}</p>`);
  C.fase = 'argumento';
  alvo(monteFal);
  PC.botao('Próximo: a carta do tarólogo', argumento);
}

/* Passo 2: o tarólogo tira uma falácia ou um viés para sustentar o que disse. */
async function argumento() {
  if (C.fase !== 'argumento') return;
  const i = C.k, p = posicoes[i], arg = C.arg[i];
  alvo(null);
  const casaF = $('.casa-fal', p), cartaF = criarCarta(arg);
  cartaF.addEventListener('click', () => { if (cartaF.classList.contains('virada')) abrirFicha(arg.id); });
  const de = $('.pilha', monteFal).getBoundingClientRect();
  casaF.append(cartaF);
  $('#conta-fal').textContent = ARG.length - (i + 1);
  await voar(cartaF, de);
  await espera(140);
  await virarCarta(cartaF, arg);
  $('.legenda', p).insertAdjacentHTML('beforeend', `<span>${esc(arg.nome)}</span>`);
  const classe = arg.tipo === 'vies' ? 'um viés' : 'uma falácia';
  PC.dizer(`<p><span class="rubrica">O tarólogo tira a carta <b>${esc(arg.nome)}</b>, ${classe}, e argumenta:</span>“${esc(L.argumentos[arg.id])}”</p>`);
  await espera(1100);
  await guardarEmbaixo(cartaF, casaF);

  C.k++;
  if (C.k < 3) { C.fase = 'virar'; alvo(C.cartas[C.k]); return PC.botao(`Virar a carta do ${POS[C.k].chave}`, virar); }
  C.fase = 'nota';
  PC.dizer('<h4>Antes de ir embora</h4><p>A leitura terminou. De 0 a 5, quanto ela descreve você e a sua vida?</p>');
  acao.innerHTML = `<div class="notas" role="group" aria-label="Nota de 0 a 5">${[0, 1, 2, 3, 4, 5].map(n => `<button class="nota" type="button" data-nota="${n}">${n}</button>`).join('')}</div><div class="notas-pontas"><span>nada a ver</span><span>em cheio</span></div>`;
}

acao.addEventListener('click', e => {
  const b = e.target.closest('[data-nota]');
  if (b) {
    C.nota = Number(b.dataset.nota);
    C.fase = 'fim';
    PC.dizer(`<p class="aparte">Você deu nota ${C.nota}. As cartas estão na mesa: toque em qualquer uma para ler o que o livro diz sobre ela.</p>`);
    acao.innerHTML = '<div class="acao-dupla"><button class="btn principal" type="button" data-nova>Nova leitura</button><button class="btn" type="button" data-truque>Rever o truque</button></div>';
    abrirTruque();
  } else if (e.target.closest('[data-truque]')) abrirTruque();
});
$('#recomecar').addEventListener('click', () => { if (!PC.ocupado) novaConsulta(); });

function definicao(c) {
  const par = c.texto.find(t => /^(A falácia|Esta falácia|Essa falácia|O viés|O efeito)/.test(t)) || c.texto[0];
  const m = par.match(/^.*?[.!?](?=\s+[A-ZÀ-Ú"“]|$)/);
  return m ? m[0] : par;
}
function abrirTruque() {
  const n = C.nota;
  const eco = n >= 4 ? 'É uma nota alta para um texto montado por sorteio.'
    : n >= 2 ? 'Alguma coisa ali pareceu falar de você, mesmo em um texto montado por sorteio.'
    : 'As cartas não convenceram você desta vez. Em uma turma inteira, o resultado costuma ser outro.';
  const usados = C.arg.map((c, i) => `
    <li class="usado">
      <button type="button" data-abrir="${c.id}" aria-label="Abrir a carta ${esc(c.nome)}"><img src="${img(c.id)}" alt=""></button>
      <div>
        <h5>${POS[i].nome} · ${esc(c.nome)} (${TIPO[c.tipo].toLowerCase()})</h5>
        <p class="dito">“${esc(L.argumentos[c.id])}”</p>
        <p class="def">${esc(definicao(c))}</p>
      </div>
    </li>`).join('');
  $('#truque-corpo').innerHTML = `
    <p class="chapa">O truque</p>
    <h3>As cartas não sabiam nada sobre você</h3>
    <p class="nota-dada">Você deu nota <b>${n}</b> de 5. ${eco}</p>
    <ul>
      <li>As três cartas saíram ao acaso de um monte de 27 arquétipos. Os argumentos do tarólogo também foram sorteados, entre 27 falácias e 9 vieses.</li>
      <li>Cada frase foi escrita para servir a quase qualquer pessoa. Releia a leitura pensando em um amigo e veja se ela não serve para ele também.</li>
      <li>Este baralho monta mais de 750 milhões de leituras diferentes, e nenhuma depende de quem está do outro lado da tela.</li>
    </ul>
    <h4>O Efeito Forer</h4>
    <blockquote class="citacao"><p>${esc(FORER)}</p><footer>Tarot Cético, capítulo 1</footer></blockquote>
    <p>No experimento original, em 1948, o psicólogo Bertram Forer entregou a mesma descrição de personalidade a todos os seus alunos, dizendo que cada uma era individual. A nota média de precisão foi 4,26 em 5.</p>
    <h4>Os argumentos do tarólogo</h4>
    <ul class="usados">${usados}</ul>
    <div class="truque-acoes">
      <button class="btn principal" type="button" data-nova>Nova leitura</button>
      <button class="btn" type="button" data-fechar>Voltar à mesa</button>
    </div>`;
  const d = $('#truque');
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}

/* ---------- mesa de mão: cenário, arquétipo e três falácias ou vieses (Escrita e Educativo) ---------- */
const MONTE_DE = { cenario: 'cenario', arquetipo: 'arquetipo', falacia: 'argumento', vies: 'argumento' };
function montarMesaMao(mesa, clicavel) {
  const tag = clicavel ? 'button type="button"' : 'div';
  const fim = clicavel ? 'button' : 'div';
  const monte = (k, nome, q) => `<${tag} class="monte" data-monte="${k}"><span class="pilha"></span><span>${nome} <b>${q}</b></span></${fim}>`;
  const vaga = (k, rotulo) => `<div class="vaga" data-vaga="${k}"><div class="casa" data-rotulo="${rotulo}"></div><p class="legenda"></p></div>`;
  mesa.innerHTML = `
    <div class="baralhos">${monte('cenario', 'Cenários', CEN.length)}${monte('arquetipo', 'Arquétipos', ARQ.length)}${monte('argumento', 'Falácias e vieses', ARG.length)}</div>
    <div class="mao">
      <div class="mao-linha">${vaga('cenario', 'Cenário')}${vaga('arquetipo', 'Arquétipo')}</div>
      <div class="mao-linha">${[0, 1, 2].map(i => vaga('arg' + i, 'Falácia ou viés')).join('')}</div>
    </div>`;
  $$('.monte', mesa).forEach(m => montarPilha(m));
}
const NOMES_MAO = ['cenario', 'arquetipo', 'arg0', 'arg1', 'arg2'];
const cartasDaMao = m => [m.cen, m.arq, ...m.args];
async function darCarta(mesa, nome, c, { animar = true, atraso = 0 } = {}) {
  const v = $(`[data-vaga="${nome}"]`, mesa), casa = $('.casa', v), legenda = $('.legenda', v);
  casa.innerHTML = ''; legenda.textContent = '';
  const carta = criarCarta(c, { virada: !animar });
  carta.style.setProperty('--tilt', ((acaso(5) - 2) * 0.7) + 'deg');
  carta.addEventListener('click', () => { if (carta.classList.contains('virada')) abrirFicha(c.id); });
  if (!animar) { casa.append(carta); legenda.textContent = c.nome; return; }
  if (atraso) { carta.style.visibility = 'hidden'; casa.append(carta); await espera(atraso); carta.style.visibility = ''; } else casa.append(carta);
  const monte = $(`[data-monte="${MONTE_DE[c.tipo]}"]`, mesa);
  const conta = $('b', monte);
  conta.textContent = Math.max(0, Number(conta.textContent) - 1);
  await voar(carta, $('.pilha', monte).getBoundingClientRect());
  await espera(110);
  await virarCarta(carta, c);
  legenda.textContent = c.nome;
}
/* Dá a mão inteira de uma vez, uma carta logo atrás da outra. */
function darMao(mesa, mao, animar = true) {
  const pares = cartasDaMao(mao).map((c, i) => [NOMES_MAO[i], c]).filter(([, c]) => c);
  pares.forEach(([, c]) => { new Image().src = img(c.id); });
  return Promise.all(pares.map(([nome, c], k) => darCarta(mesa, nome, c, { animar, atraso: k * 240 })));
}
const elo = c => `<button class="elo" type="button" data-abrir="${c.id}">${esc(c.nome)}</button>`;

/* ---------- modo Escrita Criativa ---------- */
const W = { fase: 'nova', mao: null, n: 0, resta: 900, relogio: null };
const escTela = telas.escrita, escMesa = $('#esc-mesa'), escFala = $('#esc-fala'), escAcao = $('#esc-acao');
const PE = criarPainel(escFala, escAcao);
const TIRAR = ['Tirar o cenário', 'Tirar o arquétipo', 'Tirar a 1ª falácia ou viés', 'Tirar a 2ª falácia ou viés', 'Tirar a 3ª falácia ou viés'];
const LIMITE = 500;

function abrirEscrita() {
  if (W.fase !== 'nova') return;
  const s = cofre.ler('escrita');
  const ids = s && Array.isArray(s.ids) && s.ids.length === 5 && s.ids.every(id => porId[id]) ? s.ids.map(id => porId[id]) : null;
  if (!ids) return novaRodadaEscrita();
  // Retoma o rascunho guardado neste aparelho.
  W.mao = { cen: ids[0], arq: ids[1], args: ids.slice(2) };
  W.resta = 900;
  montarMesaMao(escMesa, true);
  darMao(escMesa, W.mao, false);
  iniciarEscrita(typeof s.texto === 'string' ? s.texto : '');
}
function pararRelogio() { clearInterval(W.relogio); W.relogio = null; }
function novaRodadaEscrita() {
  pararRelogio();
  cofre.gravar('escrita', null);
  Object.assign(W, { fase: 'inicio', mao: { cen: um(CEN), arq: um(ARQ), args: sortear(ARG, 3) }, n: 0, resta: 900 });
  escTela.classList.remove('escrevendo');
  montarMesaMao(escMesa, true);
  cartasDaMao(W.mao).forEach(c => { new Image().src = img(c.id); });
  alvo(null);
  PE.dizer('<h4>Escritor e crítico</h4><p>Sorteie um cenário e um arquétipo para definir o contexto e o personagem central. Depois, tire três cartas de falácias e vieses para tecer sutilmente no texto.</p>', true);
  PE.botao('Embaralhar as cartas', async () => {
    await Promise.all($$('.monte', escMesa).map(embaralharMonte));
    W.fase = 'tirar';
    proximaCarta();
  });
}
const monteDaVez = () => $(`[data-monte="${MONTE_DE[cartasDaMao(W.mao)[W.n].tipo]}"]`, escMesa);
function proximaCarta() {
  alvo(monteDaVez());
  PE.botao(TIRAR[W.n], tirarEscrita);
}
async function tirarEscrita() {
  if (W.fase !== 'tirar') return;
  alvo(null);
  await darCarta(escMesa, NOMES_MAO[W.n], cartasDaMao(W.mao)[W.n]);
  W.n++;
  if (W.n < 5) return proximaCarta();
  await espera(700);
  iniciarEscrita('');
}
escMesa.addEventListener('click', e => {
  const m = e.target.closest('.monte');
  if (m && W.fase === 'tirar' && m === monteDaVez()) PE.travar(tirarEscrita);
});

function iniciarEscrita(texto) {
  const m = W.mao;
  W.fase = 'escrever';
  escTela.classList.add('escrevendo');
  alvo(null);
  escFala.innerHTML = `<div class="oficina">
    <h4>O desafio</h4>
    <p class="briefing">Escreva como ${m.arq.artigo} ${elo(m.arq)}, no cenário ${elo(m.cen)}, tecendo sutilmente no texto as cartas ${elo(m.args[0])}, ${elo(m.args[1])} e ${elo(m.args[2])}. O estilo literário é livre.</p>
    <label class="chapa" for="esc-texto">Seu texto</label>
    <textarea id="esc-texto" spellcheck="true" placeholder="Comece por aqui."></textarea>
    <div class="medidores"><span id="esc-palavras"></span><button class="btn-liso" type="button" id="esc-relogio"></button></div>
  </div>`;
  escFala.scrollTop = 0;
  escAcao.innerHTML = '<button class="btn principal" type="button" id="esc-avaliar">Terminei: avaliar meu texto</button>';
  const ta = $('#esc-texto');
  ta.value = texto;
  let salvar = null;
  const atualizar = () => {
    const n = palavras(ta.value), conta = $('#esc-palavras');
    conta.textContent = `${n} de ${LIMITE} palavras`;
    conta.classList.toggle('passou', n > LIMITE);
    $('#esc-avaliar').disabled = n === 0;
    clearTimeout(salvar);
    salvar = setTimeout(() => cofre.gravar('escrita', { ids: cartasDaMao(m).map(c => c.id), texto: ta.value }), 400);
  };
  ta.addEventListener('input', atualizar);
  atualizar();
  mostrarRelogio();
  $('#esc-relogio').addEventListener('click', () => {
    if (W.resta <= 0) return;
    if (W.relogio) { pararRelogio(); return mostrarRelogio(); }
    W.relogio = setInterval(() => { W.resta--; if (W.resta <= 0) pararRelogio(); mostrarRelogio(); }, 1000);
    mostrarRelogio();
  });
  $('#esc-avaliar').addEventListener('click', abrirAvaliacao);
}
function mostrarRelogio() {
  const b = $('#esc-relogio');
  if (!b) return;
  const mm = String(Math.floor(W.resta / 60)).padStart(2, '0'), ss = String(W.resta % 60).padStart(2, '0');
  b.textContent = W.resta <= 0 ? 'Tempo esgotado' : W.relogio ? `${mm}:${ss} · pausar` : W.resta === 900 ? 'Iniciar cronômetro de 15 min' : `${mm}:${ss} · continuar`;
  b.classList.toggle('passou', W.resta <= 0);
}
$('#esc-recomecar').addEventListener('click', () => {
  if (PE.ocupado) return;
  const ta = $('#esc-texto');
  if (W.fase !== 'escrever' || !ta || !palavras(ta.value)) return novaRodadaEscrita();
  // Confirmação na própria tela, antes de apagar o que foi escrito.
  escAcao.innerHTML = '<p class="aparte">Uma nova rodada apaga o texto atual.</p><div class="acao-dupla"><button class="btn principal" type="button" id="esc-apagar">Apagar e sortear de novo</button><button class="btn" type="button" id="esc-ficar">Continuar escrevendo</button></div>';
  $('#esc-apagar').addEventListener('click', novaRodadaEscrita);
  $('#esc-ficar').addEventListener('click', () => {
    escAcao.innerHTML = '<button class="btn principal" type="button" id="esc-avaliar">Terminei: avaliar meu texto</button>';
    $('#esc-avaliar').addEventListener('click', abrirAvaliacao);
  });
});

function abrirAvaliacao() {
  const texto = $('#esc-texto').value.trim(), m = W.mao;
  const opcoes = (nome, lista) => `<div class="opcoes" role="radiogroup">${lista.map(([v, r]) => `<label><input type="radio" name="${nome}" id="${nome}-${v}" value="${v}"><span>${r}</span></label>`).join('')}</div>`;
  $('#avaliacao-corpo').innerHTML = `
    <p class="chapa">Autoavaliação</p>
    <h3>Agora você é o crítico</h3>
    <p>Releia seu texto e identifique os pontos onde você incorporou cada falácia ou viés.</p>
    <blockquote class="citacao lido"><p>${esc(texto)}</p><footer>${palavras(texto)} palavras · ${esc(m.arq.nome)} em ${esc(m.cen.nome)}</footer></blockquote>
    <h4>Como cada carta apareceu</h4>
    <ul class="usados">${m.args.map((c, i) => `
      <li class="usado">
        <button type="button" data-abrir="${c.id}" aria-label="Abrir a carta ${esc(c.nome)}"><img src="${img(c.id)}" alt=""></button>
        <div><h5>${esc(c.nome)} (${TIPO[c.tipo].toLowerCase()})</h5>${opcoes('av-' + i, [['nao', 'Não usei'], ['obvia', 'Ficou óbvia'], ['camuflada', 'Bem camuflada']])}</div>
      </li>`).join('')}</ul>
    <h4>O argumento ficou convincente?</h4>
    ${opcoes('av-conv', [['pouco', 'Pouco'], ['parte', 'Em parte'], ['muito', 'Muito']])}
    <p class="balanco" id="av-balanco" aria-live="polite">Marque como cada carta apareceu no texto.</p>
    <div class="truque-acoes">
      <button class="btn principal" type="button" id="av-copiar">Copiar o texto</button>
      <button class="btn" type="button" data-fechar>Voltar a escrever</button>
      <button class="btn" type="button" id="av-nova">Apagar e começar nova rodada</button>
    </div>`;
  const d = $('#avaliacao'), corpo = $('#avaliacao-corpo');
  corpo.onchange = () => {
    const r = [0, 1, 2].map(i => ($(`input[name="av-${i}"]:checked`, corpo) || {}).value);
    if (r.some(v => !v)) return;
    const u = r.filter(v => v !== 'nao').length, k = r.filter(v => v === 'camuflada').length;
    let s = `Você usou ${u} das 3 cartas`;
    if (u) s += k === 0 ? ', mas nenhuma ficou bem camuflada' : `, e ${k} ${k === 1 ? 'ficou bem camuflada' : 'ficaram bem camufladas'}`;
    s += u < 3 ? '. As que faltaram podem entrar em uma nova versão do texto.' : '.';
    $('#av-balanco').textContent = s;
  };
  $('#av-copiar').onclick = async e => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(texto); b.textContent = 'Texto copiado'; }
    catch (_) { b.textContent = 'Não deu para copiar aqui'; }
    setTimeout(() => { b.textContent = 'Copiar o texto'; }, 2200);
  };
  $('#av-nova').onclick = () => { d.close(); novaRodadaEscrita(); };
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}

/* ---------- Modo Educativo ---------- */
const E = { fase: 'nova', papel: null, turma: null, cen: null, historico: [] };
const eduTela = telas.educativo, eduMesa = $('#edu-mesa'), eduFala = $('#edu-fala'), eduAcao = $('#edu-acao'), saguaoEl = $('#edu-saguao');
const PD = criarPainel(eduFala, eduAcao);

function abrirEducativo() {
  if (E.fase !== 'nova') return;
  const s = cofre.ler('educativo') || {};
  const turma = lerTurma(limparCodigo(s.turma));
  if (turma && s.papel === 'aluno' && pessoalValido(turma.cod, limparCodigo(s.pessoal))) return entrarAluno(turma, limparCodigo(s.pessoal), false);
  if (turma && s.papel === 'prof') return painelProfessor(turma, Array.isArray(s.historico) ? s.historico.map(limparCodigo).filter(p => pessoalValido(turma.cod, p)) : [], false);
  saguao();
}
function mostrarSaguao(html) {
  eduTela.classList.add('saguao');
  saguaoEl.innerHTML = `<div class="saguao-miolo">${html}</div>`;
  saguaoEl.scrollTop = 0;
}
function saguao() {
  Object.assign(E, { fase: 'saguao', papel: null, turma: null, cen: null, historico: [] });
  cofre.gravar('educativo', null);
  alvo(null);
  mostrarSaguao(`
    <h3>Modo Educativo</h3>
    <p>Cada jogador recebe uma carta de arquétipo e três cartas de falácias ou vieses. O objetivo é construir um discurso persuasivo que incorpore as cartas sorteadas, sob o manto do arquétipo.</p>
    <button class="modo sem-num" type="button" id="edu-entrar"><b>Entrar em uma turma</b><span class="selo">Aluno</span><small>Digite o código que o professor passou e receba suas cartas no celular.</small></button>
    <button class="modo sem-num" type="button" id="edu-abrir"><b>Abrir uma turma</b><span class="selo">Professor</span><small>Crie o código da turma e mostre na tela as cartas de quem vai falar.</small></button>
    <button class="modo sem-num" type="button" id="edu-livre"><b>Sortear sem turma</b><span class="selo">Livre</span><small>Um arquétipo e três falácias na hora, para um jogador ou um grupo.</small></button>`);
  $('#edu-entrar').onclick = formEntrar;
  $('#edu-abrir').onclick = formAbrir;
  $('#edu-livre').onclick = formLivre;
}
function formEntrar() {
  mostrarSaguao(`
    <h3>Entrar em uma turma</h3>
    <form class="campo" id="edu-form-turma" novalidate>
      <label class="chapa" for="edu-cod-turma">Código da turma</label>
      <input class="cod" id="edu-cod-turma" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="5 caracteres">
      <p class="erro" id="edu-erro-turma" role="alert"></p>
      <div class="acao-dupla"><button class="btn principal" type="submit">Receber minhas cartas</button><button class="btn" type="button" id="edu-voltar">Voltar</button></div>
    </form>`);
  $('#edu-voltar').onclick = saguao;
  $('#edu-form-turma').onsubmit = e => {
    e.preventDefault();
    const turma = lerTurma(limparCodigo($('#edu-cod-turma').value));
    if (!turma) { $('#edu-erro-turma').textContent = 'Esse código não existe. Ele tem 5 caracteres, sem as letras I e O e sem os números 0 e 1.'; return; }
    entrarAluno(turma, novoPessoal(turma.cod), true);
  };
  $('#edu-cod-turma').focus();
}
function formAbrir() {
  mostrarSaguao(`
    <h3>Abrir uma turma</h3>
    <form class="campo" id="edu-form-abrir" novalidate>
      <label class="chapa" for="edu-cenario">Carta de cenário (regra opcional)</label>
      <select id="edu-cenario">
        <option value="">Sem cenário</option>
        <option value="acaso">Sortear um cenário</option>
        ${CEN.map(c => `<option value="${c.id}">${esc(c.livro)}</option>`).join('')}
      </select>
      <p class="ajuda">Com cenário, todos os discursos da turma tratam do mesmo tema.</p>
      <div class="acao-dupla"><button class="btn principal" type="submit">Criar turma</button><button class="btn" type="button" id="edu-voltar">Voltar</button></div>
    </form>`);
  $('#edu-voltar').onclick = saguao;
  $('#edu-form-abrir').onsubmit = e => {
    e.preventDefault();
    const v = $('#edu-cenario').value;
    painelProfessor(lerTurma(novaTurma(v === 'acaso' ? um(CEN) : v ? porId[v] : null)), [], true);
  };
}
function formLivre() {
  mostrarSaguao(`
    <h3>Sortear sem turma</h3>
    <p>Regra opcional: a carta de cenário define o tema do discurso.</p>
    <div class="acao-dupla"><button class="btn principal" type="button" id="edu-sem">Sem cenário</button><button class="btn principal" type="button" id="edu-com">Com cenário</button><button class="btn" type="button" id="edu-voltar">Voltar</button></div>`);
  $('#edu-voltar').onclick = saguao;
  $('#edu-sem').onclick = () => sorteioLivre(false);
  $('#edu-com').onclick = () => sorteioLivre(true);
}
function abrirMesaEdu(cen) {
  eduTela.classList.remove('saguao');
  eduTela.classList.toggle('sem-cenario', !cen);
  montarMesaMao(eduMesa, false);
  eduFala.innerHTML = '';
  eduAcao.innerHTML = '';
}
const tarefa = mao => `Construa um discurso persuasivo como ${mao.arq.artigo} ${elo(mao.arq)}, usando ${elo(mao.args[0])}, ${elo(mao.args[1])} e ${elo(mao.args[2])}${mao.cen ? `, no cenário ${elo(mao.cen)}` : ''}.`;

async function sorteioLivre(comCenario) {
  Object.assign(E, { fase: 'mesa', papel: 'livre' });
  const mao = { cen: comCenario ? um(CEN) : null, arq: um(ARQ), args: sortear(ARG, 3) };
  abrirMesaEdu(mao.cen);
  PD.dizer('<h4>Sorteio sem turma</h4><p>As cartas estão saindo do baralho.</p>', true);
  await darMao(eduMesa, mao);
  PD.dizer(`<h4>Sua tarefa</h4><p>${tarefa(mao)}</p><p class="aparte">Depois do discurso, discuta com o grupo onde cada carta apareceu. Toque em uma carta para ler o que o livro diz sobre ela.</p>`, true);
  PD.botoes([['Sortear de novo', () => sorteioLivre(comCenario)], ['Sair', saguao, true]]);
}

async function entrarAluno(turma, pessoal, animar) {
  Object.assign(E, { fase: 'mesa', papel: 'aluno', turma: turma.cod, cen: turma.cen });
  cofre.gravar('educativo', { papel: 'aluno', turma: turma.cod, pessoal });
  const mao = { cen: turma.cen, ...maoDe(turma.cod, pessoal) };
  abrirMesaEdu(turma.cen);
  const cabeca = `<h4>Turma ${turma.cod}</h4><p class="codigo-linha">Seu código <b class="codigo">${pessoal}</b></p>`;
  PD.dizer(cabeca, true);
  await darMao(eduMesa, mao, animar);
  PD.dizer(`${cabeca}<p>${tarefa(mao)}</p><p class="aparte">Na sua vez, diga seu código ao professor para ele mostrar suas cartas à turma.</p>`, true);
  PD.botoes([['Sair da turma', saguao, true]]);
}

function painelProfessor(turma, historico, animar) {
  Object.assign(E, { fase: 'mesa', papel: 'prof', turma: turma.cod, cen: turma.cen, historico });
  const guardar = () => cofre.gravar('educativo', { papel: 'prof', turma: turma.cod, historico: E.historico });
  guardar();
  abrirMesaEdu(turma.cen);
  if (turma.cen) darCarta(eduMesa, 'cenario', turma.cen, { animar });
  eduFala.innerHTML = `<div class="prof">
    <h4>Código da turma</h4>
    <p class="codigo grande">${turma.cod}</p>
    <p>Cada aluno abre o Modo Educativo no celular, toca em “Entrar em uma turma” e digita este código. ${turma.cen ? `Cenário da turma: ${elo(turma.cen)}.` : 'Turma sem carta de cenário.'}</p>
    <form class="linha-form" id="edu-form-aluno" novalidate>
      <label class="chapa" for="edu-cod-aluno">Código do aluno que vai falar</label>
      <input class="cod" id="edu-cod-aluno" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="4 caracteres">
      <button class="btn principal" type="submit">Mostrar cartas</button>
    </form>
    <p class="erro" id="edu-erro-aluno" role="alert"></p>
    <div class="historico" id="edu-historico"></div>
    <div id="edu-conversa"></div>
  </div>`;
  const pintarHistorico = () => {
    $('#edu-historico').innerHTML = E.historico.length ? `<span class="chapa">Já mostrados</span>${E.historico.map(p => `<button class="chip" type="button" data-mao="${p}">${p}</button>`).join('')}` : '';
  };
  pintarHistorico();
  const mostrar = async pessoal => {
    const mao = { cen: turma.cen, ...maoDe(turma.cod, pessoal) };
    $('#edu-conversa').innerHTML = '';
    $('[data-monte="arquetipo"] b', eduMesa).textContent = ARQ.length;
    $('[data-monte="argumento"] b', eduMesa).textContent = ARG.length;
    await darMao(eduMesa, { ...mao, cen: null });
    if (!E.historico.includes(pessoal)) { E.historico.push(pessoal); guardar(); pintarHistorico(); }
    $('#edu-conversa').innerHTML = `<div class="fala-bloco"><h4>Cartas de ${pessoal}</h4><p>${esc(mao.arq.nome)}, com ${esc(mao.args[0].nome)}, ${esc(mao.args[1].nome)} e ${esc(mao.args[2].nome)}.</p><p class="aparte">Para a discussão: onde cada carta apareceu no discurso? Como essas estratégias são usadas na vida real? Toque em uma carta para abrir o texto do livro.</p></div>`;
    eduFala.scrollTo({ top: $('#edu-conversa').offsetTop - 10, behavior: calmo ? 'auto' : 'smooth' });
  };
  $('#edu-form-aluno').onsubmit = e => {
    e.preventDefault();
    if (PD.ocupado) return; // ainda mostrando as cartas anteriores: mantém o que foi digitado
    const campo = $('#edu-cod-aluno'), erro = $('#edu-erro-aluno'), p = limparCodigo(campo.value);
    if (!pessoalValido(turma.cod, p)) { erro.textContent = 'Esse código não confere com esta turma. Peça para o aluno conferir o código da turma e o código pessoal.'; return; }
    erro.textContent = ''; campo.value = '';
    PD.travar(() => mostrar(p));
  };
  $('#edu-historico').onclick = e => { const b = e.target.closest('[data-mao]'); if (b) PD.travar(() => mostrar(b.dataset.mao)); };
  PD.botoes([['Sortear para um grupo', () => mostrar(novoPessoal(turma.cod))], ['Encerrar turma', saguao, true]]);
}

/* ---------- a carta de hoje ----------
   A carta sai da data do aparelho: no mesmo dia, todo mundo recebe a mesma carta e o mesmo texto
   (é o experimento de Forer em versão diária). A cada 63 dias o baralho é reembaralhado. */
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const BARALHO_DIA = [...ARQ, ...ARG];
const nomeCompleto = c => (c.tipo === 'arquetipo' ? `${c.artigo.toUpperCase()} ${c.nome}` : c.nome);
function cartaDoDia(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth(), dia = d.getDate();
  const n = Math.floor(Date.UTC(y, m, dia) / 864e5);
  const carta = embaralharCom(BARALHO_DIA, 'carta-do-dia:' + Math.floor(n / BARALHO_DIA.length))[n % BARALHO_DIA.length];
  return {
    chave: `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, carta,
    semana: SEMANA[d.getDay()], data: `${dia} de ${MESES[m]} de ${y}`,
    texto: `${HOJE.semana[d.getDay()]} ${HOJE.cartas[carta.id]}`
  };
}
const H = { dia: null, revelada: false };
const hojeMonte = $('#hoje-monte'), hojeCasa = $('#hoje-casa');
const PH = criarPainel($('#hoje-fala'), $('#hoje-acao'));

function abrirHoje() {
  const dia = cartaDoDia();
  if (H.dia && H.dia.chave === dia.chave) return;     // mesmo dia: a tela fica como está
  Object.assign(H, { dia, revelada: false });
  $('#hoje-data').innerHTML = `<small>${dia.semana}</small>${dia.data}`;
  montarPilha(hojeMonte);
  hojeCasa.innerHTML = ''; hojeCasa.classList.remove('brilho');
  new Image().src = img(dia.carta.id);
  if (cofre.ler('hoje') === dia.chave) return mostrarHoje(false);   // já tirou a carta hoje neste aparelho
  PH.dizer('<h4>A carta de hoje</h4><p>Todo dia, uma carta do Tarot Cético tem algo a dizer sobre o seu dia. Tire a de hoje e veja se ela acerta.</p>', true);
  alvo(hojeMonte);
  PH.botao('Tirar a carta de hoje', tirarHoje);
}
async function tirarHoje() {
  if (H.revelada) return;
  H.revelada = true;
  alvo(null);
  await embaralharMonte(hojeMonte);
  await mostrarHoje(true);
}
hojeMonte.addEventListener('click', () => { if (H.dia && !H.revelada) PH.travar(tirarHoje); });
async function mostrarHoje(animar) {
  const { carta, texto } = H.dia;
  const c = criarCarta(carta, { virada: !animar });
  c.addEventListener('click', () => { if (c.classList.contains('virada')) abrirFicha(carta.id); });
  const de = $('.pilha', hojeMonte).getBoundingClientRect();
  hojeCasa.append(c);
  H.revelada = true;
  if (animar) {
    await voar(c, de);
    await espera(160);
    hojeCasa.classList.add('brilho');
    await virarCarta(c, carta);
    cofre.gravar('hoje', H.dia.chave);
  }
  PH.dizer(`<p class="chapa">${TIPO[carta.tipo]}</p><h3 class="hoje-nome">${esc(nomeCompleto(carta))}</h3><p>${esc(texto)}</p>
    <details><summary>Como a carta sabe disso?</summary><p>Ela não sabe. Esta é a carta de hoje de todo mundo que abrir o app, e o texto foi escrito para servir a quase qualquer pessoa, em quase qualquer dia. Se pareceu feito para você, é o Efeito Forer funcionando.</p></details>`, true);
  PH.botoes([['Compartilhar', abrirPartilha], ['O que o livro diz', () => abrirFicha(carta.id), true]]);
}

/* Imagem para compartilhar: data, carta e texto, em formato de tela de celular (1080 × 1920). */
function quebrar(x, texto, largura) {
  const linhas = []; let atual = '';
  for (const p of texto.split(/\s+/)) {
    const tenta = atual ? atual + ' ' + p : p;
    if (x.measureText(tenta).width > largura && atual) { linhas.push(atual); atual = p; } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}
function espacado(x, texto, cx, y, espaco) {
  // texto centralizado com espaço entre letras (o canvas não tem letter-spacing em todos os navegadores)
  const letras = [...texto], larguras = letras.map(l => x.measureText(l).width);
  let px = cx - (larguras.reduce((a, b) => a + b, 0) + espaco * (letras.length - 1)) / 2;
  x.textAlign = 'left';
  letras.forEach((l, i) => { x.fillText(l, px, y); px += larguras[i] + espaco; });
  x.textAlign = 'center';
}
async function imagemDoDia(dia) {
  const W = 1080, A = 1920, cv = document.createElement('canvas');
  cv.width = W; cv.height = A;
  const x = cv.getContext('2d');
  const TIT = "'Macondo','Palatino Linotype',Georgia,serif", TXT = "'Alegreya','Iowan Old Style',Georgia,serif", ROT = "'Alegreya Sans','Segoe UI',system-ui,sans-serif";
  const foto = new Image();
  foto.src = img(dia.carta.id);
  const fontes = document.fonts ? Promise.all([`400 70px ${TIT}`, `400 40px ${TXT}`, `italic 400 32px ${TXT}`, `500 30px ${ROT}`].map(f => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  await Promise.all([foto.decode(), Promise.race([fontes, new Promise(r => setTimeout(r, 2500))])]);

  // toalha de veludo com a trama do verso das cartas
  const g = x.createRadialGradient(W / 2, 240, 40, W / 2, 760, 1500);
  g.addColorStop(0, '#3c2759'); g.addColorStop(0.45, '#231636'); g.addColorStop(1, '#110b1b');
  x.fillStyle = g; x.fillRect(0, 0, W, A);
  x.strokeStyle = 'rgba(200,162,90,.07)'; x.lineWidth = 2;
  for (let cy = 0; cy <= A + 120; cy += 60) for (let cx = (cy / 60) % 2 ? 60 : 0; cx <= W + 120; cx += 120) { x.beginPath(); x.arc(cx, cy, 60, 0, 2 * Math.PI); x.stroke(); }
  // moldura com os "olhos" dos cantos das cartas
  x.strokeStyle = '#c8a25a'; x.lineWidth = 4; x.strokeRect(34, 34, W - 68, A - 68);
  x.lineWidth = 1.5; x.strokeRect(48, 48, W - 96, A - 96);
  for (const [cx, cy] of [[70, 70], [W - 70, 70], [70, A - 70], [W - 70, A - 70]]) {
    x.fillStyle = '#1b1130'; x.beginPath(); x.arc(cx, cy, 24, 0, 2 * Math.PI); x.fill(); x.lineWidth = 3; x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 14, 0, 2 * Math.PI); x.stroke();
    x.fillStyle = '#c8a25a'; x.beginPath(); x.arc(cx, cy, 6, 0, 2 * Math.PI); x.fill();
  }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  // cabeçalho: dia, mês e ano
  x.fillStyle = '#c8a25a'; x.font = `500 30px ${ROT}`; espacado(x, 'A CARTA DE HOJE', W / 2, 160, 9);
  x.fillStyle = '#ecd29a'; x.font = `400 78px ${TIT}`; x.fillText(dia.data, W / 2, 258);
  x.fillStyle = '#b9aacd'; x.font = `500 28px ${ROT}`; espacado(x, dia.semana.toUpperCase(), W / 2, 316, 8);
  // carta
  const cw = 470, ch = 752, cx0 = (W - cw) / 2, cy0 = 372, r = 24;
  x.save();
  x.translate(W / 2, cy0 + ch / 2); x.rotate(-0.035); x.translate(-W / 2, -(cy0 + ch / 2));
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 50; x.shadowOffsetY = 22;
  x.beginPath(); x.roundRect ? x.roundRect(cx0, cy0, cw, ch, r) : x.rect(cx0, cy0, cw, ch);
  x.fillStyle = '#f1e7d0'; x.fill();
  x.shadowColor = 'transparent'; x.clip();
  x.drawImage(foto, cx0, cy0, cw, ch);
  x.restore();
  // tipo e nome da carta
  x.fillStyle = '#c8a25a'; x.font = `500 30px ${ROT}`; espacado(x, TIPO[dia.carta.tipo].toUpperCase(), W / 2, 1218, 9);
  const nome = nomeCompleto(dia.carta);
  let tam = 72;
  do { x.font = `400 ${tam}px ${TIT}`; tam -= 4; } while (x.measureText(nome).width > 920 && tam > 36);
  x.fillStyle = '#ecd29a'; x.fillText(nome, W / 2, 1296);
  // texto no estilo Forer
  let corpo = 42, linhas;
  do { x.font = `400 ${corpo}px ${TXT}`; linhas = quebrar(x, dia.texto, 900); corpo -= 2; } while (linhas.length > 7 && corpo > 28);
  const alt = Math.round((corpo + 2) * 1.38);
  x.fillStyle = '#f1e7d0';
  linhas.forEach((l, i) => x.fillText(l, W / 2, 1378 + i * alt));
  // rodapé
  x.fillStyle = '#ecd29a'; x.font = `italic 400 32px ${TXT}`;
  x.fillText('A mesma carta para todo mundo hoje. Serviu para você?', W / 2, 1790);
  x.fillStyle = '#b9aacd'; x.font = `500 27px ${ROT}`;
  x.fillText('Tarot Cético · andrebacchi.github.io/tarot-cetico', W / 2, 1842);
  return new Promise((ok, erro) => cv.toBlob(b => (b ? ok(b) : erro(new Error('sem imagem'))), 'image/png'));
}
let urlPartilha = null;
async function abrirPartilha() {
  const d = $('#partilha'), corpo = $('#partilha-corpo'), dia = H.dia;
  corpo.innerHTML = '<p class="chapa">Compartilhar</p><h3>A carta de hoje</h3><div class="previa" id="previa"><p class="aparte">Montando a imagem.</p></div><div class="truque-acoes" id="partilha-acoes"></div><p class="ajuda" id="partilha-ajuda"></p>';
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  try {
    const blob = await imagemDoDia(dia);
    if (urlPartilha) URL.revokeObjectURL(urlPartilha);
    urlPartilha = URL.createObjectURL(blob);
    const arquivo = `tarot-cetico-${dia.chave}.png`, nome = nomeCompleto(dia.carta);
    $('#previa').innerHTML = `<img src="${urlPartilha}" alt="Imagem com a data ${dia.data}, a carta ${esc(nome)} e o texto de hoje" width="1080" height="1920">`;
    const file = new File([blob], arquivo, { type: 'image/png' });
    let pode = false;
    try { pode = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (_) { /* sem compartilhamento nativo */ }
    // Na pré-visualização em artefato os downloads são bloqueados: lá fica só a imagem, para salvar com um toque longo.
    const acoes = $('#partilha-acoes');
    acoes.innerHTML = pode ? '<button class="btn principal" type="button" id="partilhar">Compartilhar imagem</button>' : '';
    if (PWA) {
      const baixar = Object.assign(document.createElement('a'), { className: 'btn' + (pode ? '' : ' principal'), href: urlPartilha, textContent: 'Baixar imagem' });
      baixar.download = arquivo;
      acoes.append(baixar);
    }
    if (pode) $('#partilhar').onclick = () => navigator.share({ files: [file], title: 'A carta de hoje', text: `A carta de hoje no Tarot Cético: ${nome}. Veja se serve para você também: ${SITE}` }).catch(() => {});
    $('#partilha-ajuda').textContent = PWA ? 'No celular, também dá para segurar o dedo sobre a imagem e salvar ou copiar.'
      : 'Nesta pré-visualização, salve a imagem segurando o dedo sobre ela (ou com o botão direito). No site, há botões para compartilhar e baixar.';
  } catch (_) {
    $('#previa').innerHTML = '<p class="erro">Não foi possível montar a imagem neste aparelho.</p>';
  }
}

/* ---------- instalar (padrão do BACCHI LAB) ---------- */
if (PWA) {
  const botao = $('#instalar-btn');
  let adiado = null;
  const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); adiado = e; });
  addEventListener('appinstalled', () => { botao.hidden = true; });
  botao.hidden = instalado();
  const PASSOS = {
    ios: ['Abra esta página no <b>Safari</b>.', 'Toque em <b>Compartilhar</b> <kbd>⬆︎</kbd>.', 'Toque em <b>Adicionar à Tela de Início</b>.', 'Confirme o nome e toque em <b>Adicionar</b>.'],
    android: ['Abra esta página no <b>Chrome</b>.', 'Toque no menu <kbd>⋮</kbd>.', 'Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.', 'Confirme. O ícone aparece junto dos seus apps.'],
    desktop: ['<b>Chrome ou Edge:</b> use o ícone de instalar na barra de endereço, ou o menu <kbd>⋮</kbd> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app</b>.', '<b>Safari (Mac):</b> menu <b>Arquivo</b> → <b>Adicionar ao Dock</b>.', '<b>Qualquer navegador:</b> salve nos favoritos com <kbd>Ctrl</kbd>+<kbd>D</kbd>.']
  };
  const ABAS = [['ios', 'iPhone e iPad'], ['android', 'Android'], ['desktop', 'Computador']];
  const plataforma = () => { const u = navigator.userAgent || ''; if (/iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'ios'; return /Android/.test(u) ? 'android' : 'desktop'; };
  const aba = k => {
    $('#abas').innerHTML = ABAS.map(([id, l]) => `<button class="chip" type="button" data-aba="${id}" aria-pressed="${id === k}">${l}</button>`).join('');
    $('#passos').innerHTML = PASSOS[k].map(p => `<li>${p}</li>`).join('');
  };
  $('#abas').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) aba(b.dataset.aba); });
  botao.addEventListener('click', async () => {
    if (adiado) { try { adiado.prompt(); const r = await adiado.userChoice; adiado = null; if (r && r.outcome === 'accepted') return; } catch (_) { /* segue para as instruções */ } }
    aba(plataforma());
    $('#instalar').showModal();
  });
  // Funciona sem internet: o service worker guarda o app, e as 81 cartas são guardadas aos poucos, em segundo plano.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    const guardarCartas = async () => {
      try {
        const c = await caches.open(FIXOS);
        const tem = new Set((await c.keys()).map(r => new URL(r.url).pathname));
        for (const carta of CARTAS) { const u = new URL(img(carta.id), location.href); if (!tem.has(u.pathname)) await c.add(u.href); }
      } catch (_) { /* sem rede ou sem espaço: tenta de novo na próxima visita */ }
    };
    addEventListener('load', () => setTimeout(guardarCartas, 4000));
  }
}

/* ---------- ficha da carta (texto do livro) ---------- */
function abrirFicha(id) {
  const c = porId[id];
  const titulo = c.tipo === 'cenario' ? c.livro : c.nome;
  const p = t => `<p>${esc(t)}</p>`;
  const li = t => `<li>${esc(t)}</li>`;
  let corpo = c.texto.map(p).join('');
  if (c.tracos) corpo += `<dl>${c.tracos.map(([n, t]) => `<dt>${esc(n)}</dt><dd>${esc(t)}</dd>`).join('')}</dl>`;
  if (c.exemplo) corpo += `<h4>Exemplo</h4>${p(c.exemplo)}`;
  if (c.frases) corpo += `<h4>Frases do senso comum</h4><ul class="ditos">${c.frases.map(li).join('')}</ul><h4>Perguntas que podem despertar reflexões</h4><ul>${c.perguntas.map(li).join('')}</ul>`;
  if (c.nota) corpo += `<h4>Falácias e vieses neste debate</h4>${c.nota.map(p).join('')}`;
  $('#ficha-corpo').innerHTML = `
    <div class="ficha-carta"><img src="${img(id)}" alt="Carta ${esc(c.nome)}" width="450" height="720"></div>
    <div class="ficha-texto">
      <p class="chapa">${TIPO[c.tipo]}</p>
      <h3>${esc(titulo)}</h3>
      ${corpo}
      <p class="fonte">Texto do livro <cite>Tarot Cético: “cartomancia” racional</cite>, de André D. Bacchi.</p>
    </div>`;
  const d = $('#ficha');
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}

/* ---------- baralho ---------- */
let baralhoPronto = false;
function montarBaralho() {
  if (baralhoPronto) return;
  baralhoPronto = true;
  const filtros = $('#filtros'), grade = $('#grade');
  const grupos = [['todas', 'Todas', CARTAS.length], ['arquetipo', 'Arquétipos', ARQ.length], ['falacia', 'Falácias', ARG.filter(c => c.tipo === 'falacia').length], ['vies', 'Vieses', ARG.filter(c => c.tipo === 'vies').length], ['cenario', 'Cenários', CEN.length]];
  filtros.innerHTML = grupos.map(([k, nome, q], i) => `<button class="chip" type="button" data-filtro="${k}" aria-pressed="${i === 0}">${nome} <span>${q}</span></button>`).join('');
  grade.innerHTML = CARTAS.map(c => `<button class="mini" type="button" data-abrir="${c.id}" data-tipo="${c.tipo}"><img loading="lazy" decoding="async" src="${img(c.id)}" alt="" width="450" height="720"><span>${esc(c.nome)}</span></button>`).join('');
  filtros.addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    $$('.chip', filtros).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $$('.mini', grade).forEach(m => { m.hidden = b.dataset.filtro !== 'todas' && m.dataset.tipo !== b.dataset.filtro; });
  });
}

/* ---------- início ---------- */
montarLeque();
{ const d = cartaDoDia(); $('#capa-data').textContent = `${d.semana}, ${d.data}`; }
const inicial = location.hash.slice(1);
if (telas[inicial] && inicial !== 'capa') ir(inicial);

/* Para os testes automáticos: a lógica dos códigos, sem tocar na tela. */
window.__tarot = { novaTurma, lerTurma, novoPessoal, pessoalValido, maoDe, limparCodigo, CEN, cartaDoDia, imagemDoDia };
})();
