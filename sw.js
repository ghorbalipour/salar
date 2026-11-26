const CACHE_NAME = "salar-pwa-v26";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=2.16",
  "./app.js?v=2.16",
  "./manifest.json",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/naming.jpg",
  "./images/grb-192.png",
  "./images/salar_banner.webp",
  "./images/salar_congratulations.png",
  "./images/salar_encouragement.png",
  "./images/salar_guidance.png",
  "./images/salar_praise.png",
  "./images/salar_thinking.png",
  "./data/grade1.js?v=2.16",
  "./data/grade2.js?v=2.16",
  "./data/grade3.js?v=2.16",
  "./data/grade4.js?v=2.16",
  "./data/grade5.js?v=2.16",
  "./data/grade6.js?v=2.16"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: "no-cache" }).then((res) => {
            if (res && res.ok) return cache.put(url, res);
          })
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const reqUrl = new URL(event.request.url);

  // درخواست‌های بیرونی (مثل آمارگیر Yandex Metrica) هرگز توسط Service Worker کش یا مسدود نمی‌شوند
  if (reqUrl.origin !== self.location.origin) return;

  // فایل version.json همیشه مستقیم از شبکه خوانده می‌شود
  if (reqUrl.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match(event.request, { ignoreSearch: true }))
      )
  );
});
