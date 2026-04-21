const CACHE_NAME = 'abogapp-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/formularios.css',
  '/tareas.css',
  '/modales.css',
  '/script.js',
  '/supabaseClient.js',
  '/lib/choices/choices.min.css',
  '/lib/choices/choices.min.js',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/drive_button.png',
  '/cotizacion.js',
  '/lib/docxtemplater/pizzip.min.js',
  '/templatepropuesta.docx'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
