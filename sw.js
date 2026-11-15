// فيكسورا: إشعارات الموبايل
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "فيكسورا", {
    body: d.body || "", icon: "icon-192.png", badge: "badge-96.png", tag: d.tag || undefined, renotify: !!d.tag,
    dir: "rtl", lang: "ar", vibrate: [120, 60, 120], data: { url: d.url || "app.html" }
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "app.html", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if (w.url.split("#")[0] === url.split("#")[0] && "focus" in w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
