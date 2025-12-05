// GochiSpace - モバイル最適化 Service Worker
const CACHE_NAME = 'gochispace-v2';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/gochiSpaceFavicon.ico',
  '/manifest.json'
];

// インストール時にキャッシュを作成
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📱 GochiSpace キャッシュを作成中...');
        return cache.addAll(urlsToCache);
      })
  );
  // 新しいサービスワーカーを即時有効化
  self.skipWaiting();
});

// リクエストをキャッシュから提供（オフライン対応）
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 非GETリクエスト（POST/PUT/DELETE など）はキャッシュしない・そのままネットワークへ
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // ナビゲーションリクエスト（ページ遷移）はネットワーク優先で取得し、失敗時にキャッシュの index.html を返す
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // 正常なレスポンスなら返す（必要ならここでキャッシュ更新も可能）
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/');
        })
    );
    return;
  }

  // その他の GET リソースはキャッシュ優先（キャッシュがなければネットワークから取得してキャッシュする）
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkResponse) => {
        // セキュリティ: レスポンスが有効で、かつクローン可能な場合のみキャッシュに保存
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone).catch((err) => {
            // キャッシュに入れられない場合はログだけ出す（POST 等の誤操作を防ぐ）
            console.warn('Cache put failed for', request.url, err);
          });
        });

        return networkResponse;
      }).catch(() => {
        // ネットワーク失敗時はキャッシュを再確認（オフライン時の保険）
        return caches.match(request);
      });
    })
  );
});

// 古いキャッシュを削除
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
});