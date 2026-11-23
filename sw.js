// Service worker لليجانو: بيستقبل إشعارات الدفع (طلبات الاستشارة) ويفتح الصفحة لما المحامي يدوس عليها.
// مقصود إنه مايعملش تخزين مؤقت (cache) للصفحات، عشان أي تحديث ينزل فوراً.
self.addEventListener('install', () => self.skipWaiting());
// معالج fetch فاضي: بعض نسخ كروم على أندرويد بتشترطه عشان تعتبر الموقع قابل للتثبيت. مابيعملش تخزين ولا بيغيّر أي طلب.
self.addEventListener('fetch', () => {});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = String(d.title || 'ليجانو').slice(0, 80);
  e.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || '').slice(0, 200),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: String(d.tag || 'legano'),
    renotify: true,
    requireInteraction: !!d.urgent,
    vibrate: d.urgent ? [300, 120, 300, 120, 500] : [120],
    data: { url: typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/consultations.html' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/consultations.html', self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (new URL(c.url).origin === self.location.origin && 'focus' in c) { await c.focus(); if ('navigate' in c) { try { await c.navigate(url); } catch {} } return; } }
    await self.clients.openWindow(url);
  })());
});
