/**
 * sw.js — Service Worker pour notifications push
 * À placer à la RACINE du site (pas dans un sous-dossier)
 */

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Recevoir une notification push
self.addEventListener('push', e => {
  if (!e.data) return;

  const data = e.data.json();
  const options = {
    body:    data.body    || 'Nouvelle publication !',
    icon:    data.icon    || '/favicon.ico',
    badge:   data.badge   || '/favicon.ico',
    image:   data.image   || null,
    data:    { url: data.url || '/' },
    actions: [
      { action: 'read', title: 'Lire' },
      { action: 'close', title: 'Fermer' }
    ],
    vibrate: [200, 100, 200],
  };

  e.waitUntil(
    self.registration.showNotification(data.title || 'Les Narvalos', options)
  );
});

// Clic sur notification
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;

  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
