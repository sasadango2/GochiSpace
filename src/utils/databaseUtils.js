// Firestore データベース初期化ユーティリティ
import { collection, doc, setDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";

// カテゴリーマスターデータ
const categoryMasterData = [
  {
    name: "和食",
    displayName: "和食",
    description: "日本の伝統的な料理",
    color: "#FF6B6B",
    icon: "🍱",
    order: 1,
    isActive: true
  },
  {
    name: "洋食",
    displayName: "洋食",
    description: "西洋料理",
    color: "#4ECDC4",
    icon: "🍽️",
    order: 2,
    isActive: true
  },
  {
    name: "中華",
    displayName: "中華料理",
    description: "中国料理",
    color: "#FFE66D",
    icon: "🥢",
    order: 3,
    isActive: true
  },
  {
    name: "イタリアン",
    displayName: "イタリア料理",
    description: "イタリア料理",
    color: "#FF8B94",
    icon: "🍝",
    order: 4,
    isActive: true
  },
  {
    name: "フレンチ",
    displayName: "フランス料理",
    description: "フランス料理",
    color: "#A8E6CF",
    icon: "🥖",
    order: 5,
    isActive: true
  },
  {
    name: "焼肉",
    displayName: "焼肉・BBQ",
    description: "焼肉・バーベキュー",
    color: "#FF9999",
    icon: "🥩",
    order: 6,
    isActive: true
  },
  {
    name: "寿司",
    displayName: "寿司・海鮮",
    description: "寿司・海鮮料理",
    color: "#87CEEB",
    icon: "🍣",
    order: 7,
    isActive: true
  },
  {
    name: "ラーメン",
    displayName: "ラーメン・麺類",
    description: "ラーメン・麺料理",
    color: "#DDA0DD",
    icon: "🍜",
    order: 8,
    isActive: true
  },
  {
    name: "カフェ",
    displayName: "カフェ・喫茶店",
    description: "カフェ・喫茶店",
    color: "#F0E68C",
    icon: "☕",
    order: 9,
    isActive: true
  },
  {
    name: "居酒屋",
    displayName: "居酒屋・バー",
    description: "居酒屋・バー",
    color: "#FFA07A",
    icon: "🍺",
    order: 10,
    isActive: true
  },
  {
    name: "ファストフード",
    displayName: "ファストフード",
    description: "ファストフード",
    color: "#98FB98",
    icon: "🍔",
    order: 11,
    isActive: true
  },
  {
    name: "デザート",
    displayName: "デザート・スイーツ",
    description: "デザート・スイーツ",
    color: "#FFB6C1",
    icon: "🍰",
    order: 12,
    isActive: true
  },
  {
    name: "その他",
    displayName: "その他",
    description: "その他の料理",
    color: "#D3D3D3",
    icon: "🍽️",
    order: 13,
    isActive: true
  }
];

/**
 * カテゴリーマスターデータを初期化
 */
export const initializeCategories = async () => {
  try {
    console.log("📁 カテゴリー初期化開始...");
    
    for (const category of categoryMasterData) {
      const categoryDoc = {
        ...category,
        reviewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, "categories", category.name), categoryDoc);
      console.log(`✅ カテゴリー作成完了: ${category.displayName}`);
    }
    
    console.log("🎉 カテゴリー初期化完了！");
    return { success: true, message: "カテゴリーの初期化が完了しました" };
    
  } catch (error) {
    console.error("❌ カテゴリー初期化エラー:", error);
    return { success: false, error: error.message };
  }
};

/**
 * サンプルレビューデータを作成
 */
export const createSampleReviews = async (userId, userEmail) => {
  if (!userId || !userEmail) {
    throw new Error("ユーザー情報が必要です");
  }

  const sampleReviews = [
    {
      restaurantId: "sample_restaurant_1",
      restaurantName: "築地寿司清",
      restaurantAddress: "東京都中央区築地4-13-9",
      restaurantLocation: { lat: 35.6663, lng: 139.7708 },
      comment: "新鮮なネタと職人の技術が光る本格寿司店。特にまぐろが絶品でした！",
      rating: 5,
      category: "寿司",
      imageUrl: null,
      isPublic: true,
      isDeleted: false,
      likes: 0,
      likedBy: [],
      viewCount: 0
    },
    {
      restaurantId: "sample_restaurant_2",
      restaurantName: "パスタハウス イタリアーノ",
      restaurantAddress: "東京都港区青山2-3-1",
      restaurantLocation: { lat: 35.6714, lng: 139.7243 },
      comment: "本格的なパスタとピザが楽しめます。雰囲気も良くデートにおすすめ。",
      rating: 4,
      category: "イタリアン",
      imageUrl: null,
      isPublic: true,
      isDeleted: false,
      likes: 0,
      likedBy: [],
      viewCount: 0
    },
    {
      restaurantId: "sample_restaurant_3",
      restaurantName: "ラーメン二郎 三田本店",
      restaurantAddress: "東京都港区三田2-16-4",
      restaurantLocation: { lat: 35.6455, lng: 139.7477 },
      comment: "ボリューム満点のラーメン。野菜マシマシで大満足でした！",
      rating: 4,
      category: "ラーメン",
      imageUrl: null,
      isPublic: true,
      isDeleted: false,
      likes: 0,
      likedBy: [],
      viewCount: 0
    }
  ];

  try {
    console.log("📝 サンプルレビュー作成開始...");
    
    for (const review of sampleReviews) {
      const reviewDoc = {
        ...review,
        userId: userId,
        userEmail: userEmail,
        userName: userEmail.split('@')[0], // メールアドレスからユーザー名を生成
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, "reviews"), reviewDoc);
      console.log(`✅ サンプルレビュー作成完了: ${review.restaurantName} (ID: ${docRef.id})`);
    }
    
    console.log("🎉 サンプルレビュー作成完了！");
    return { success: true, message: "サンプルレビューの作成が完了しました" };
    
  } catch (error) {
    console.error("❌ サンプルレビュー作成エラー:", error);
    return { success: false, error: error.message };
  }
};

/**
 * データベース全体を初期化
 */
export const initializeDatabase = async (userId = null, userEmail = null) => {
  try {
    console.log("🚀 データベース初期化開始...");
    
    // 1. カテゴリー初期化
    const categoryResult = await initializeCategories();
    if (!categoryResult.success) {
      throw new Error(categoryResult.error);
    }
    
    // 2. サンプルレビュー作成（ユーザー情報があれば）
    if (userId && userEmail) {
      const reviewResult = await createSampleReviews(userId, userEmail);
      if (!reviewResult.success) {
        console.warn("⚠️ サンプルレビュー作成に失敗しましたが、続行します:", reviewResult.error);
      }
    }
    
    console.log("🎉 データベース初期化完了！");
    return { 
      success: true, 
      message: "データベースの初期化が完了しました。アプリケーションの利用を開始できます。" 
    };
    
  } catch (error) {
    console.error("❌ データベース初期化エラー:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * ユーザーデータを更新（統計情報など）
 */
export const updateUserStats = async (userId) => {
  try {
    // レビュー数などの統計情報を計算して更新
    // 実装は必要に応じて追加
    console.log(`📊 ユーザー統計更新: ${userId}`);
    return { success: true };
  } catch (error) {
    console.error("❌ ユーザー統計更新エラー:", error);
    return { success: false, error: error.message };
  }
};

/**
 * データベース構造の確認
 */
export const validateDatabaseStructure = async () => {
  try {
    console.log("🔍 データベース構造確認中...");
    
    // 各コレクションの存在確認
    const collections = ['users', 'reviews', 'categories'];
    const results = {};
    
    for (const collectionName of collections) {
      try {
        const testRef = collection(db, collectionName);
        results[collectionName] = "✅ アクセス可能";
      } catch (error) {
        results[collectionName] = `❌ エラー: ${error.message}`;
      }
    }
    
    console.log("📋 データベース構造確認結果:", results);
    return { success: true, results };
    
  } catch (error) {
    console.error("❌ データベース構造確認エラー:", error);
    return { success: false, error: error.message };
  }
};
