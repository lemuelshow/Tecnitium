// Service worker do Tecnitium: guarda o aplicativo no aparelho para abrir sem internet.
// Os dados ja ficam no navegador (localStorage e IndexedDB), entao o app funciona 100% offline.
const VERSAO = 'tecnitium-v5';
const BASE = ['/', '/manifest.webmanifest', '/icone.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(BASE);
    // Guarda tambem os arquivos do build citados no index.html (nomes com hash).
    try {
      const html = await (await fetch('/', { cache: 'no-store' })).text();
      const assets = [...new Set(html.match(/\/assets\/[^"')\s]+/g) || [])];
      await cache.addAll(assets);
    } catch { /* sem rede na instalacao: os arquivos entram no cache no primeiro uso */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSAO) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Paginas: tenta a rede (versao nova) e cai para o app guardado quando estiver offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copia = res.clone();
      caches.open(VERSAO).then((c) => c.put('/', copia));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  // Arquivos do app e fontes: responde do cache e atualiza em segundo plano.
  const fonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === self.location.origin || fonte) {
    e.respondWith(caches.match(req).then((guardado) => {
      const rede = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
        return res;
      }).catch(() => guardado);
      return guardado || rede;
    }));
  }
});
