/* Tarot Cético: funciona sem internet depois da primeira visita.
   Este arquivo é gerado pelo build (python3 build.py) a partir de src/sw.js; a versão vem de VERSAO no build.py. */
const APP = 'tarot-cetico-app-0.3';   // página e ícones: troca a cada versão
const FIXOS = 'tarot-cetico-fixos-v1';                   // cartas e fontes: raramente mudam
// Todos os apps dividem andrebacchi.github.io: apague só os caches deste app.
const PREFIXO = 'tarot-cetico-';
const NUCLEO = ['./', 'index.html', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-64.png', 'icons/apple-touch-icon.png'];
const ESCOPO = new URL(self.registration.scope).pathname;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIXO) && k !== APP && k !== FIXOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const guardar = (cache, req, resp) => { if (resp && (resp.ok || resp.type === 'opaque')) { const copia = resp.clone(); caches.open(cache).then(c => c.put(req, copia)); } return resp; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!fonte && (url.origin !== location.origin || !url.pathname.startsWith(ESCOPO))) return;
  if (fonte || url.pathname.startsWith(ESCOPO + 'cards/')) {
    // cartas e fontes: o que já está guardado responde na hora
    e.respondWith(caches.match(req).then(tem => tem || fetch(req).then(r => guardar(FIXOS, req, r))));
    return;
  }
  // página e ícones: rede primeiro (para ver a versão nova logo), cache se estiver sem internet
  e.respondWith(fetch(req).then(r => guardar(APP, req, r))
    .catch(() => caches.match(req).then(tem => tem || (req.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
