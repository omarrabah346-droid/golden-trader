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
  const scope = new URL(self.registration.scope);
  let target;
  try { target = new URL(e.notification.data?.url || "app.html", scope); } catch (_) {}
  const url = (target?.origin === scope.origin && target.pathname.startsWith(scope.pathname)
    ? target : new URL("app.html", scope)).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if (w.url.split("#")[0] === url.split("#")[0] && "focus" in w) {
      return w.navigate(url).then(client => (client || w).focus());
    }
    return self.clients.openWindow(url);
  }));
});
