# Cloud Functions for Firebase セットアップガイド

## 🔥 Cloud Functions のデプロイ手順

### 1. Firebase CLI のインストール
```bash
npm install -g firebase-tools
```

### 2. Firebase にログイン
```bash
firebase login
```

### 3. プロジェクトの初期化（既存プロジェクトの場合）
```bash
firebase use your-project-id
```

### 4. Functions の依存関係インストール
```bash
cd functions
npm install
cd ..
```

### 5. Cloud Functions のデプロイ
```bash
firebase deploy --only functions
```

## 📊 自動同期システムの動作確認

### デプロイ後に確認すべき Cloud Functions

1. **syncRestaurantOnReviewCreate**
   - トリガー: `users/{userId}/postRestaurantInfo/{placeId}` の作成
   - 動作: 新規レビュー投稿時にレストラン統計を自動計算・更新

2. **syncRestaurantOnReviewUpdate**  
   - トリガー: `users/{userId}/postRestaurantInfo/{placeId}` の更新
   - 動作: レビュー更新時にレストラン統計を自動再計算

3. **syncRestaurantOnReviewDelete**
   - トリガー: `users/{userId}/postRestaurantInfo/{placeId}` の削除
   - 動作: レビュー削除時にレストラン統計を自動更新

4. **syncReviewsOnProfileUpdate**
   - トリガー: `users/{userId}` の更新
   - 動作: プロフィール変更時に関連レビューのdisplayNameを自動更新

## 🛠️ 管理者向け手動実行関数

### データ整合性チェック
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const checkIntegrity = httpsCallable(functions, 'performDataIntegrityCheck');

// 実行
const result = await checkIntegrity();
console.log(`${result.data.processed}件のデータを修正しました`);
```

### 特定レストランの手動同期
```javascript
const syncRestaurant = httpsCallable(functions, 'syncSpecificRestaurant');

// 実行
const result = await syncRestaurant({ placeId: 'ChIJ...' });
console.log(result.data.message);
```

## 🔍 ログの確認

### Firebase Console でのログ確認
1. Firebase Console → Functions → ログタブ

### CLI でのリアルタイムログ
```bash
firebase functions:log
```

### 特定の関数のログ
```bash
firebase functions:log --only syncRestaurantOnReviewCreate
```

## ⚡ パフォーマンス最適化

### 1. 関数の同時実行数制御
```javascript
// functions/index.js に追加
const runtimeOpts = {
  timeoutSeconds: 300,
  memory: '1GB'
};

exports.syncRestaurantOnReviewCreate = functions
  .runWith(runtimeOpts)
  .firestore.document('users/{userId}/postRestaurantInfo/{placeId}')
  .onCreate(handler);
```

### 2. バッチ処理の最適化
- 大量データ処理時は分割実行
- トランザクションの適切な使用
- リトライロジックの実装

## 🚨 エラーハンドリング

### 1. 関数実行失敗時の対応
- Firebase Console でエラーログを確認
- 必要に応じて手動同期を実行
- データ整合性チェックで一括修復

### 2. 部分的な同期失敗への対応
```javascript
// 個別レストランの手動同期
await syncSpecificRestaurant('ChIJ...');

// 全体の整合性チェック
await performDataIntegrityCheck();
```

## 📈 モニタリング

### 1. Cloud Functions の実行回数監視
- Firebase Console → Functions → 使用量タブ

### 2. パフォーマンス監視
- 実行時間の追跡
- メモリ使用量の監視
- エラー率の確認

### 3. Firestore 使用量監視
- 読み取り/書き込み回数
- ストレージ使用量
- ネットワーク使用量

## 🔄 バックアップとリストア

### 1. データのバックアップ
```bash
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
```

### 2. 緊急時のリストア
```bash
gcloud firestore import gs://your-bucket/backup-20240919
```

## 💡 ベストプラクティス

1. **段階的デプロイ**
   - まずテスト環境でデプロイ
   - 本番環境は慎重にデプロイ

2. **監視とアラート**
   - 異常なエラー率のアラート設定
   - パフォーマンス低下の監視

3. **コスト管理**
   - 関数実行回数の最適化
   - 不要な同期処理の削減

4. **セキュリティ**
   - 管理者権限の適切な設定
   - API呼び出しの認証確認
