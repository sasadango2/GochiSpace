// Firebase接続とデータ保存の確認用ユーティリティ
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Firebase接続状況の確認
 */
export const testFirebaseConnection = async () => {
  console.log("🔍 Firebase接続テスト開始...");
  
  try {
    // 簡単なテストドキュメントを作成
    const testData = {
      message: "Firebase接続テスト",
      timestamp: new Date(),
      status: "success"
    };
    
    const docRef = await addDoc(collection(db, "connection_test"), testData);
    console.log("✅ テストデータ保存成功:", docRef.id);
    
    // 保存したデータを読み取り
    const docSnap = await getDoc(doc(db, "connection_test", docRef.id));
    if (docSnap.exists()) {
      console.log("✅ テストデータ読み取り成功:", docSnap.data());
    }
    
    return {
      success: true,
      message: "Firebase接続は正常です",
      testDocId: docRef.id
    };
    
  } catch (error) {
    console.error("❌ Firebase接続エラー:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 各コレクションのデータ確認
 */
export const checkAllCollections = async () => {
  console.log("📊 全コレクションデータ確認...");
  
  const collections = ['users', 'reviews', 'categories', 'restaurants'];
  const results = {};
  
  for (const collectionName of collections) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      results[collectionName] = {
        exists: true,
        count: snapshot.size,
        documents: snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }))
      };
      
      console.log(`📁 ${collectionName}: ${snapshot.size}件のドキュメント`);
      
    } catch (error) {
      results[collectionName] = {
        exists: false,
        error: error.message
      };
      console.error(`❌ ${collectionName} エラー:`, error.message);
    }
  }
  
  return results;
};

/**
 * レビューデータのリアルタイム監視
 */
export const watchReviews = (callback) => {
  console.log("👀 レビューデータのリアルタイム監視開始...");
  
  const q = query(
    collection(db, "reviews"),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const reviews = [];
    snapshot.forEach((doc) => {
      reviews.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log("📝 リアルタイムレビューデータ:", reviews.length, "件");
    if (callback) callback(reviews);
  }, (error) => {
    console.error("❌ リアルタイム監視エラー:", error);
  });
  
  return unsubscribe; // 監視停止用の関数を返す
};

/**
 * ユーザーデータの詳細確認
 */
export const checkUserData = async (userId) => {
  try {
    console.log(`👤 ユーザーデータ確認: ${userId}`);
    
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log("✅ ユーザーデータ:", userData);
      
      // そのユーザーのレビュー数も確認
      const userReviewsQuery = query(
        collection(db, "reviews"),
        orderBy("createdAt", "desc")
      );
      const reviewsSnapshot = await getDocs(userReviewsQuery);
      const userReviews = reviewsSnapshot.docs.filter(doc => 
        doc.data().userId === userId
      );
      
      console.log(`📝 ${userId}のレビュー数: ${userReviews.length}件`);
      
      return {
        success: true,
        userData,
        reviewCount: userReviews.length,
        reviews: userReviews.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };
      
    } else {
      console.log("❌ ユーザーデータが見つかりません");
      return {
        success: false,
        message: "ユーザーデータが見つかりません"
      };
    }
    
  } catch (error) {
    console.error("❌ ユーザーデータ確認エラー:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * データベース統計情報の取得
 */
export const getDatabaseStats = async () => {
  try {
    console.log("📊 データベース統計情報取得...");
    
    const stats = {};
    
    // ユーザー数
    const usersSnapshot = await getDocs(collection(db, "users"));
    stats.userCount = usersSnapshot.size;
    
    // レビュー数
    const reviewsSnapshot = await getDocs(collection(db, "reviews"));
    stats.reviewCount = reviewsSnapshot.size;
    
    // カテゴリー別レビュー数
    const categoryStats = {};
    reviewsSnapshot.forEach(doc => {
      const category = doc.data().category;
      if (category) {
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      }
    });
    stats.categoryStats = categoryStats;
    
    // 平均評価
    let totalRating = 0;
    let ratingCount = 0;
    reviewsSnapshot.forEach(doc => {
      const rating = doc.data().rating;
      if (rating) {
        totalRating += rating;
        ratingCount++;
      }
    });
    stats.averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    
    // 最新レビュー
    const latestReviewsQuery = query(
      collection(db, "reviews"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const latestSnapshot = await getDocs(latestReviewsQuery);
    stats.latestReviews = latestSnapshot.docs.map(doc => ({
      id: doc.id,
      restaurantName: doc.data().restaurantName,
      rating: doc.data().rating,
      createdAt: doc.data().createdAt
    }));
    
    console.log("📈 データベース統計:", stats);
    return stats;
    
  } catch (error) {
    console.error("❌ 統計情報取得エラー:", error);
    return { error: error.message };
  }
};

// データ確認のための簡単なデモ関数
export const runFirebaseDemo = async () => {
  console.log("🚀 Firebase接続デモ開始...");
  
  // 1. 接続テスト
  const connectionResult = await testFirebaseConnection();
  console.log("1️⃣ 接続テスト結果:", connectionResult);
  
  // 2. 全コレクション確認
  const collectionsResult = await checkAllCollections();
  console.log("2️⃣ コレクション確認結果:", collectionsResult);
  
  // 3. 統計情報取得
  const statsResult = await getDatabaseStats();
  console.log("3️⃣ 統計情報:", statsResult);
  
  return {
    connection: connectionResult,
    collections: collectionsResult,
    stats: statsResult
  };
};
