const CACHE_NAME = "farsi6-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./lessons.js",
  "./lessons-3-to-6.js",
  "./lessons-7-to-12.js",
  "./lessons-13-to-17.js",
  "./manifest.json",
  "./icon.svg"
];

// ذخیره اولیه تمام فایل‌ها برای استفاده آفلاین
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS.map((url) => cache.add(url)))
    )
  );
});

// فعال‌سازی فوری نسخه جدید
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// استراتژی Network-First: در حالت آنلاین همیشه فایل جدید را می‌گیرد و کش را آپدیت می‌کند؛ در حالت آفلاین از کش می‌خواند
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});