/* FND Management System — privacy-first notification worker.
   No employee names, request reasons, or passwords are sent in push payloads. */
self.addEventListener('push', event => {
  const show = self.registration.showNotification('FND Management System', {
    body: 'You have a new notification. Open FND to review.',
    icon: '/fnd-logo2.png', badge: '/fnd-logo2.png',
    tag: 'fnd-new-notification', renotify: true,
    data: { url: '/?page=notifications' },
  });
  event.waitUntil(show);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const destination = new URL('/?page=notifications', self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === destination.origin) {
        await client.navigate(destination.href);
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(destination.href);
  })());
});
