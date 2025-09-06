# GochiSpace Firestore Database 構成

## 📊 データベース概要

GochiSpaceアプリケーションは、Google Cloud Firestoreを使用してデータを管理しています。
このドキュメントでは、データベースの構成とセットアップ方法について説明します。

## 🗂️ コレクション構造

### 1. `users` コレクション
ユーザー情報を格納します。

```javascript
{
  // ドキュメントID: Firebase Auth UID
  "userId": "user123",           // ユーザー設定ID
  "firebaseUid": "auth_uid",     // Firebase認証UID
  "email": "user@example.com",   // メールアドレス
  "emailVerified": true,         // メール認証済み
  "displayName": "ユーザー名",    // 表示名
  "profileImage": "url",         // プロフィール画像URL
  "preferences": ["和食", "カフェ", "イタリアン"], // 嗜好
  "reviewCount": 5,              // レビュー投稿数
  "createdAt": timestamp,
  "updatedAt": timestamp
}
```

### 2. `reviews` コレクション
レビュー情報を格納します。

```javascript
{
  // ドキュメントID: 自動生成
  "userId": "auth_uid",          // 投稿者UID
  "userEmail": "user@example.com", // 投稿者メール
  "restaurantId": "place_id",    // Google Places ID
  "restaurantName": "店名",      // 店名
  "restaurantAddress": "住所",   // 住所
  "restaurantLocation": {        // 位置情報
    "lat": 35.6762,
    "lng": 139.6503
  },
  "comment": "美味しかった！",    // コメント
  "rating": 5,                   // 評価(1-5)
  "category": "和食",            // カテゴリー
  "imageUrl": "url",             // 画像URL
  "isPublic": true,              // 公開フラグ
  "isDeleted": false,            // 削除フラグ
  "likes": 3,                    // いいね数
  "createdAt": timestamp,
  "updatedAt": timestamp
}
```

### 3. `categories` コレクション
カテゴリーマスター情報を格納します。

```javascript
{
  // ドキュメントID: カテゴリー名
  "name": "和食",               // カテゴリー名
  "displayName": "和食",        // 表示名
  "description": "日本の伝統的な料理", // 説明
  "color": "#FF6B6B",           // 表示色
  "icon": "🍱",                 // アイコン
  "order": 1,                   // 表示順序
  "isActive": true,             // アクティブフラグ
  "reviewCount": 10,            // レビュー数
  "createdAt": timestamp,
  "updatedAt": timestamp
}
```

### 4. `restaurants` コレクション（オプション）
飲食店情報を格納します。

```javascript
{
  // ドキュメントID: Google Places ID
  "placeId": "google_place_id", // Google Places ID
  "name": "店名",               // 店名
  "address": "住所",            // 住所
  "location": { "lat": 35.6762, "lng": 139.6503 },
  "categories": ["和食"],       // カテゴリー
  "reviewCount": 5,             // レビュー数
  "averageRating": 4.2,         // 平均評価
  "googleRating": 4.1,          // Google評価
  "createdAt": timestamp,
  "updatedAt": timestamp
}
```

### 5. `likes` コレクション（オプション）
いいね情報を格納します。

```javascript
{
  // ドキュメントID: userId_reviewId
  "userId": "auth_uid",         // いいねユーザーUID
  "reviewId": "review_id",      // レビューID
  "createdAt": timestamp
}
```

## 🔧 セットアップ手順

### 1. Firestoreの初期化

```javascript
import { initializeDatabase } from './src/utils/databaseUtils';

// カテゴリーとサンプルデータの初期化
const result = await initializeDatabase(userId, userEmail);
console.log(result.message);
```

### 2. カテゴリーの初期化のみ

```javascript
import { initializeCategories } from './src/utils/databaseUtils';

const result = await initializeCategories();
console.log(result.message);
```

### 3. Firebase コンソールでの設定

1. Firebase プロジェクト設定
2. Firestore Database の作成
3. セキュリティルールの設定（`firestore.rules` ファイルを適用）
4. 複合インデックスの作成

## 📋 必要なインデックス

Firebase コンソールで以下のインデックスを作成してください：

### reviews コレクション
1. `userId` (昇順) + `createdAt` (降順)
2. `category` (昇順) + `createdAt` (降順)  
3. `restaurantId` (昇順) + `createdAt` (降順)
4. `isPublic` (昇順) + `createdAt` (降順)
5. `category` (昇順) + `rating` (降順)

### users コレクション
1. `createdAt` (降順)
2. `reviewCount` (降順)

## 🔒 セキュリティルール

`firestore.rules` ファイルに定義されたセキュリティルールを適用してください：

- **users**: 自分の情報のみ編集可能、他は読み取りのみ
- **reviews**: 公開済みレビューは全員読み取り可能、自分のレビューのみ編集可能
- **categories**: 読み取りのみ
- **restaurants**: 読み取りのみ
- **likes**: 自分のいいねのみ操作可能

## 📱 アプリケーションでの使用例

### レビューの投稿
```javascript
import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

const reviewData = {
  userId: user.uid,
  userEmail: user.email,
  restaurantName: "店名",
  // ... その他のフィールド
  createdAt: new Date(),
  updatedAt: new Date()
};

await addDoc(collection(db, "reviews"), reviewData);
```

### レビューの取得（フィルタリング）
```javascript
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

// カテゴリーでフィルタリング
const q = query(
  collection(db, "reviews"),
  where("category", "==", "和食"),
  where("isPublic", "==", true),
  orderBy("createdAt", "desc")
);

const querySnapshot = await getDocs(q);
const reviews = querySnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

### ユーザーのレビューのみ取得
```javascript
const q = query(
  collection(db, "reviews"),
  where("userId", "==", currentUser.uid),
  orderBy("createdAt", "desc")
);
```

## 🚀 運用のベストプラクティス

1. **論理削除**: `isDeleted` フラグを使用して物理削除を避ける
2. **公開設定**: `isPublic` フラグでプライバシー管理
3. **統計情報**: 定期的に `reviewCount` などの統計を更新
4. **画像最適化**: Firebase Storage の画像は適切なサイズに圧縮
5. **インデックス管理**: クエリパフォーマンスを定期的に監視

## 📊 監視とメンテナンス

### 定期的に確認すべき項目
- Firestore の読み書き回数
- ストレージ使用量
- セキュリティルールの違反ログ
- パフォーマンスの監視

### バックアップ
Firebase プロジェクト設定で自動バックアップを有効にすることを推奨します。

## 🔧 トラブルシューティング

### よくある問題
1. **権限エラー**: セキュリティルールの確認
2. **インデックスエラー**: 必要なインデックスの作成
3. **クエリ制限**: 複合インデックスの作成
4. **画像アップロードエラー**: Storage ルールの確認

詳細なエラー情報は Firebase コンソールのログで確認できます。
