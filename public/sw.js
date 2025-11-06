// GochiSpace - Service Worker
// 変更点:
// - キャッシュ名にバージョンを付与（更新時に値を上げて強制更新）
// - ナビゲーション（HTML）は network-first を使い、常に最新の index.html を取得する
// - 静的アセットは cache-first だが、同時にバックグラウンドで更新して次回反映
const CACHE_NAME = 'gochispace-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/gochiSpaceFavicon.ico',
  '/manifest.json'
];

// インストール: 必要最小限をプリキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📱 GochiSpace: キャッシュを作成中...');
      return cache.addAll(urlsToCache);
    })
  );
  // 新しい SW が入ったらすぐに activate させる
  self.skipWaiting();
});

// activate: 古いキャッシュの削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// fetch: ナビゲーションは network-first、それ以外は cache-first + 背景更新
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // HTML ナビゲーション要求（SPA のルート HTML）はネットワーク優先
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          // 成功したらキャッシュを更新して返す
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // それ以外のリソースはキャッシュ優先。キャッシュがあれば即返し、バックグラウンドで更新。
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndCache = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => null);

      if (cached) {
        // バックグラウンドで更新を行うが、即座にキャッシュを返す
        fetchAndCache;
        return cached;
      }
      // キャッシュがなければネットワークを返す（か失敗時はエラー）
      return fetchAndCache;
    })
  );
});