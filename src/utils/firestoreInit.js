// GochiSpace Firestore Database Schema
// このファイルは、Firestoreデータベースの構成とコレクション構造を定義します

/**
 * === FIRESTORE DATABASE SCHEMA ===
 * 
 * 1. users コレクション - ユーザー情報
 * 2. reviews コレクション - レビュー情報
 * 3. restaurants コレクション - 飲食店情報（オプション）
 * 4. categories コレクション - カテゴリー情報（オプション）
 */

// ===== 1. USERS COLLECTION =====
const usersCollection = {
  // ドキュメントID: Firebase Auth UID
  "documentId": "firebaseAuthUID",
  "fields": {
    // 基本情報
    "userId": "string",              // ユーザーが設定したID
    "firebaseUid": "string",         // Firebase Auth UID
    "email": "string",               // メールアドレス
    "emailVerified": "boolean",      // メール認証済みフラグ
    
    // プロフィール情報
    "displayName": "string",         // 表示名
    "profileImage": "string",        // プロフィール画像URL
    "bio": "string",                 // 自己紹介（オプション）
    
    // 嗜好設定
    "preferences": "array",          // 好きなカテゴリー（最大3つ）
    // 例: ["和食", "イタリアン", "カフェ"]
    
    // 統計情報
    "reviewCount": "number",         // 投稿レビュー数
    "totalRating": "number",         // 総評価値（平均計算用）
    "favoriteCategories": "array",   // よく投稿するカテゴリー
    
    // タイムスタンプ
    "createdAt": "timestamp",
    "updatedAt": "timestamp",
    "lastLoginAt": "timestamp"       // 最終ログイン日時
  }
};

// ===== 2. REVIEWS COLLECTION =====
const reviewsCollection = {
  // ドキュメントID: 自動生成
  "documentId": "auto-generated-id",
  "fields": {
    // ユーザー情報
    "userId": "string",              // 投稿者のFirebase UID
    "userEmail": "string",           // 投稿者のメールアドレス
    "userName": "string",            // 投稿者の表示名
    
    // 飲食店情報
    "restaurantId": "string",        // Google Places API の place_id
    "restaurantName": "string",      // 店名
    "restaurantAddress": "string",   // 住所
    "restaurantLocation": {          // 位置情報
      "lat": "number",
      "lng": "number"
    },
    "restaurantPhone": "string",     // 電話番号（オプション）
    "restaurantWebsite": "string",   // ウェブサイト（オプション）
    
    // レビュー内容
    "comment": "string",             // コメント
    "rating": "number",              // 評価（1-5）
    "category": "string",            // カテゴリー
    "tags": "array",                 // タグ（オプション）
    // 例: ["デート", "家族", "一人", "記念日"]
    
    // メディア
    "imageUrl": "string",            // 画像URL
    "imageUrls": "array",            // 複数画像URL（将来拡張用）
    
    // インタラクション
    "likes": "number",               // いいね数
    "likedBy": "array",              // いいねしたユーザーUID
    "viewCount": "number",           // 閲覧数
    
    // 公開設定
    "isPublic": "boolean",           // 公開フラグ
    "isDeleted": "boolean",          // 削除フラグ（論理削除）
    
    // タイムスタンプ
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
};

// ===== 3. RESTAURANTS COLLECTION（オプション・将来拡張用） =====
const restaurantsCollection = {
  // ドキュメントID: Google Places API の place_id
  "documentId": "google-place-id",
  "fields": {
    // 基本情報
    "placeId": "string",             // Google Places ID
    "name": "string",                // 店名
    "address": "string",             // 住所
    "location": {                    // 位置情報
      "lat": "number",
      "lng": "number"
    },
    "phone": "string",               // 電話番号
    "website": "string",             // ウェブサイト
    "openingHours": "array",         // 営業時間
    
    // カテゴリー・タグ
    "categories": "array",           // カテゴリー
    "googleTypes": "array",          // Google Placesのタイプ
    "tags": "array",                 // タグ
    
    // 統計情報
    "reviewCount": "number",         // レビュー数
    "averageRating": "number",       // 平均評価
    "totalRating": "number",         // 総評価値
    "lastReviewAt": "timestamp",     // 最終レビュー日時
    
    // Google Places情報
    "googleRating": "number",        // Google評価
    "googleReviewCount": "number",   // Google レビュー数
    "priceLevel": "number",          // 価格レベル
    
    // タイムスタンプ
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
};

// ===== 4. CATEGORIES COLLECTION（オプション） =====
const categoriesCollection = {
  // ドキュメントID: カテゴリー名
  "documentId": "category-name",
  "fields": {
    "name": "string",                // カテゴリー名
    "displayName": "string",         // 表示名
    "description": "string",         // 説明
    "color": "string",               // 表示色
    "icon": "string",                // アイコン
    "order": "number",               // 表示順序
    "isActive": "boolean",           // アクティブフラグ
    "reviewCount": "number",         // このカテゴリーのレビュー数
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
};

// ===== 5. LIKES COLLECTION（オプション・いいね機能用） =====
const likesCollection = {
  // ドキュメントID: userId_reviewId
  "documentId": "userId_reviewId",
  "fields": {
    "userId": "string",              // いいねしたユーザーUID
    "reviewId": "string",            // いいねされたレビューID
    "createdAt": "timestamp"
  }
};

// ===== FIRESTORE SECURITY RULES（セキュリティルール案） =====
const securityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ユーザーコレクション
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // 他のユーザー情報は読み取りのみ
    }
    
    // レビューコレクション
    match /reviews/{reviewId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // 飲食店コレクション
    match /restaurants/{restaurantId} {
      allow read: if request.auth != null;
      allow write: if false; // システムからのみ更新
    }
    
    // カテゴリーコレクション
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if false; // 管理者のみ
    }
    
    // いいねコレクション
    match /likes/{likeId} {
      allow read: if request.auth != null;
      allow create, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
`;

// ===== COMPOUND INDEXES（複合インデックス設定） =====
const indexes = [
  {
    collection: "reviews",
    fields: [
      { field: "userId", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collection: "reviews",
    fields: [
      { field: "category", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collection: "reviews",
    fields: [
      { field: "restaurantId", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collection: "reviews",
    fields: [
      { field: "isPublic", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collection: "reviews",
    fields: [
      { field: "category", order: "ASCENDING" },
      { field: "rating", order: "DESCENDING" }
    ]
  }
];

export {
  usersCollection,
  reviewsCollection,
  restaurantsCollection,
  categoriesCollection,
  likesCollection,
  securityRules,
  indexes
};
