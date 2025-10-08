# GochiSpaceプロジェクト - 最適化されたFirestoreセキュリティルール

## 🔒 セキュリティルールの概要

このプロジェクトに最適化されたFirestoreセキュリティルールです。ソーシャル機能、レビューシステム、フォロー機能に対応した包括的なセキュリティ設定となっています。

## 📋 主要な機能とセキュリティポリシー

### 1. **認証・ユーザー管理**
```javascript
// 基本認証チェック
function isAuthenticated() {
  return request.auth != null;
}

// 自分のデータかチェック
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

### 2. **Users Collection**
- **読み取り**: 認証済みユーザーなら誰でも（検索・プロフィール表示用）
- **作成**: 自分のUIDのドキュメントのみ、必須フィールドの検証
- **更新**: 自分のプロフィールのみ、重要フィールド（firebaseUid、createdAt）は変更不可
- **削除**: 自分のプロフィールのみ

**バリデーション**:
- `displayName`, `email`, `preferences`は必須
- `preferences`は最大5個まで
- `firebaseUid`と`createdAt`は更新時に変更不可

### 3. **フォロー機能 (`/follows` サブコレクション)**
- **読み取り**: 自分のフォロー情報 + フォロー状態確認用
- **作成**: フォローリクエスト送信（自分をフォロー不可）
- **更新**: フォロー状態変更（accepted, rejected, blocked）
- **削除**: フォロー解除

**フォロー状態**:
- `pending`: フォローリクエスト送信済み
- `accepted`: フォロー承認済み
- `rejected`: フォローリクエスト拒否
- `blocked`: ブロック

### 4. **通知システム (`/notifications` サブコレクション)**
- **読み取り**: 自分の通知のみ
- **作成**: 他ユーザーへの通知送信可能
- **更新**: 既読状態変更のみ
- **削除**: 通知削除

**通知タイプ**:
- `follow_request`: フォローリクエスト
- `follow_accepted`: フォロー承認
- `review_like`: レビューいいね
- `system_notification`: システム通知

### 5. **レビューシステム**

#### **A. postRestaurantInfo サブコレクション**
- **読み取り**: 相互フォロー関係 + 自分のデータ
- **作成**: 自分のレビュー投稿のみ
- **更新**: 自分のレビューのみ（userIdとcreatedAtは変更不可）
- **削除**: 自分のレビューのみ

#### **B. reviews コレクション（旧版互換）**
- **読み取り**: 公開レビュー + 自分のレビュー
- **作成**: 自分のレビューのみ
- **更新**: 自分のレビューのみ（基本情報は変更不可）
- **削除**: 自分のレビューのみ

**レビューバリデーション**:
- 評価は1-5の範囲
- コメントは1000文字以内
- 必須フィールド: `userId`, `userEmail`, `restaurantId`, `restaurantName`, `comment`, `rating`, `category`

### 6. **レストラン情報 (`restaurants` コレクション)**
- **読み取り**: 認証済みユーザーなら誰でも
- **作成**: レビュー投稿時の店舗データ作成
- **更新**: レビュー統計更新のみ（基本情報は変更不可）
- **削除**: 管理者のみ

### 7. **カテゴリー管理 (`categories` コレクション)**
- **読み取り**: 認証済みユーザーなら誰でも
- **作成・更新・削除**: 管理者のみ

### 8. **いいね機能 (`likes` コレクション)**
- **読み取り**: 認証済みユーザーなら誰でも
- **作成**: 自分のいいねのみ
- **更新**: 禁止（削除して再作成）
- **削除**: 自分のいいねのみ

## 🔧 相互フォロー関係の判定

```javascript
function isMutualFollow(userId, targetUserId) {
  return exists(/databases/$(database)/documents/users/$(userId)/follows/$(targetUserId)) &&
         exists(/databases/$(database)/documents/users/$(targetUserId)/follows/$(userId));
}
```

## 🛡️ セキュリティの特徴

### **1. プライバシー保護**
- レビューは相互フォロー関係でのみ閲覧可能
- 個人情報は厳格にアクセス制御

### **2. データ整合性**
- 重要フィールドの変更を防止
- 適切なバリデーション実装

### **3. スパム・悪用防止**
- ファイルサイズ制限
- フィールド長制限
- 自分のデータのみ操作可能

### **4. 管理機能**
- 管理者による全データアクセス
- システムログ記録
- カテゴリー管理

## 🗂️ Firebase Storage ルール

```javascript
// プロフィール画像: 5MB制限
match /profile-images/{userId}/{allPaths=**}

// レビュー画像: 10MB制限  
match /review-images/{userId}/{allPaths=**}

// 一時ファイル: 20MB制限
match /temp/{userId}/{allPaths=**}
```

## 📊 パフォーマンス最適化

### **1. インデックス要件**
```javascript
// 必要なコンポジットインデックス
- users/{userId}/follows: [targetUserId, status, createdAt]
- users/{userId}/notifications: [type, read, createdAt]
- users/{userId}/postRestaurantInfo: [category, rating, createdAt]
- restaurants: [category, averageRating]
- reviews: [userId, isPublic, createdAt]
```

### **2. クエリ最適化**
- フォロー状態の効率的な判定
- 通知の適切なフィルタリング
- レビューの権限ベースアクセス

## 🚀 実装推奨事項

### **1. クライアントサイド**
```javascript
// セキュリティルール適用の確認
import { enableNetwork, disableNetwork } from "firebase/firestore";

// ネットワーク接続テスト
await enableNetwork(db);
```

### **2. エラーハンドリング**
```javascript
// 権限エラーの適切な処理
try {
  await setDoc(doc(db, "users", userId), userData);
} catch (error) {
  if (error.code === 'permission-denied') {
    console.error('アクセス権限がありません');
  }
}
```

### **3. 段階的デプロイ**
1. テスト環境での動作確認
2. セキュリティルールの段階的適用
3. 本番環境での監視

## 🔍 監視とログ

### **1. セキュリティ監視**
- 不正アクセス試行の検出
- 異常なデータアクセスパターンの監視

### **2. パフォーマンス監視**
- クエリ実行時間の監視
- リアルタイムリスナーの最適化

このセキュリティルールにより、GochiSpaceプロジェクトの全機能が安全かつ効率的に動作します。
