import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  where
} from "firebase/firestore";
import { db } from "../firebase";
// ...existing code...

/**
 * フォロー状態の取得
 */
export const getFollowStatus = async (myUserId, otherUserId) => {
  try {
    // 自分が相手をフォローしているか
    const myFollowSnap = await getDocs(query(
      collection(db, "users", myUserId, "follows"),
      where("targetUserId", "==", otherUserId)
    ));
    
    // 相手が自分をフォローしているか
    const otherFollowSnap = await getDocs(query(
      collection(db, "users", otherUserId, "follows"),
      where("targetUserId", "==", myUserId)
    ));
    
    const iFollowThem = myFollowSnap.size > 0;
    const theyFollowMe = otherFollowSnap.size > 0;
    
    let myFollowStatus = "none";
    let theirFollowStatus = "none";
    
    if (iFollowThem) {
      const myFollowDoc = myFollowSnap.docs[0];
      myFollowStatus = myFollowDoc.data().status || "pending";
    }
    
    if (theyFollowMe) {
      const theirFollowDoc = otherFollowSnap.docs[0];
      theirFollowStatus = theirFollowDoc.data().status || "pending";
    }
    
    return {
      iFollowThem,
      theyFollowMe,
      isMutual: iFollowThem && theyFollowMe && myFollowStatus === "accepted" && theirFollowStatus === "accepted",
      myFollowStatus,
      theirFollowStatus
    };
  } catch (error) {
    console.error("フォロー状態取得エラー:", error);
    return {
      iFollowThem: false,
      theyFollowMe: false,
      isMutual: false,
      myFollowStatus: "none",
      theirFollowStatus: "none"
    };
  }
};

/**
 * 相互フォロー判定（旧版互換性用）
 */
export const isMutualFollow = async (myUserId, otherUserId) => {
  const status = await getFollowStatus(myUserId, otherUserId);
  return status.isMutual;
};

/**
 * 指定ユーザーのレビュー取得（相互フォローのみ）
 */
export const getUserReviewsIfMutual = async (myUserId, targetUserId) => {
  const mutual = await isMutualFollow(myUserId, targetUserId);
  if (!mutual) return [];
  // reviewedRestaurantsサブコレクション取得
  const reviewsSnap = await getDocs(collection(db, "users", targetUserId, "reviewedRestaurants"));
  return reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * 店舗のレビュー取得
 */
export const getRestaurantReviews = async (placeId) => {
  const restaurantDoc = await getDoc(doc(db, "restaurants", placeId));
  if (!restaurantDoc.exists()) return [];
  const data = restaurantDoc.data();
  // reviewsはMap形式
  if (data.reviews) {
    return Object.entries(data.reviews).map(([userId, review]) => ({ userId, ...review }));
  }
  return [];
};

/**
 * カテゴリー検索で該当店舗のレビュー取得
 */
export const getCategoryReviews = async (category) => {
  const restaurantsSnap = await getDocs(query(
    collection(db, "restaurants"),
    where("category", "==", category)
  ));
  let reviews = [];
  restaurantsSnap.forEach(docu => {
    const data = docu.data();
    if (data.reviews) {
      Object.entries(data.reviews).forEach(([userId, review]) => {
        reviews.push({ userId, ...review, restaurantId: docu.id });
      });
    }
  });
  return reviews;
};

/**
 * ユーザープロフィール取得
 */
export const getUserProfile = async (userId) => {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists() ? userDoc.data() : null;
};

/**
 * ユーザー検索（displayNameで部分一致）
 */
export const searchUsersByDisplayName = async (searchText) => {
  if (!searchText) return [];
  
  try {
    // Firestoreでは部分一致が困難なため、全取得してフィルター
    const usersSnap = await getDocs(collection(db, "users"));
    const matchedUsers = [];
    
    usersSnap.forEach(docu => {
      const userData = docu.data();
      const displayName = userData.displayName || "";
      const email = userData.email || "";
      
      if (displayName.toLowerCase().includes(searchText.toLowerCase()) ||
          email.toLowerCase().includes(searchText.toLowerCase()) ||
          docu.id.toLowerCase().includes(searchText.toLowerCase())) {
        matchedUsers.push({
          id: docu.id,
          ...userData
        });
      }
    });
    
    return matchedUsers;
  } catch (error) {
    console.error("ユーザー検索エラー:", error);
    return [];
  }
};

/**
 * ユーザー検索（userIdで部分一致）
 */
export const searchUsersByUserId = async (searchText) => {
  if (!searchText) return [];
  
  try {
    // Firestoreでは部分一致が困難なため、全取得してフィルター
    const usersSnap = await getDocs(collection(db, "users"));
    const matchedUsers = [];
    
    usersSnap.forEach(docu => {
      const userData = docu.data();
      const userId = userData.userId || userData.displayName || "";
      
      // userIdフィールドまたはdisplayNameで部分一致検索
      if (userId.toLowerCase().includes(searchText.toLowerCase())) {
        matchedUsers.push({
          id: docu.id,
          ...userData
        });
      }
    });
    
    return matchedUsers;
  } catch (error) {
    console.error("ユーザーID検索エラー:", error);
    return [];
  }
};

/**
 * フォロー・解除
 */
export const followUser = async (myUserId, targetUserId) => {
  if (myUserId === targetUserId) return; // 自分をフォローできない
  
  try {
    // 既にフォローしているかチェック
    const existingFollow = await getDocs(query(
      collection(db, "users", myUserId, "follows"),
      where("targetUserId", "==", targetUserId)
    ));
    
    if (existingFollow.size > 0) {
      console.log("既にフォロー済みです");
      return;
    }
    
    // followsサブコレクションに追加
    await addDoc(collection(db, "users", myUserId, "follows"), {
      targetUserId,
      createdAt: new Date(),
      status: "pending" // フォローリクエスト送信状態
    });
    
    // 相手のnotificationsサブコレクションに通知追加
    await addDoc(collection(db, "users", targetUserId, "notifications"), {
      type: "follow_request",
      fromUserId: myUserId,
      message: "フォローリクエストが届きました",
      read: false,
      createdAt: new Date()
    });
    
    console.log("フォローリクエストを送信しました");
  } catch (error) {
    console.error("フォローエラー:", error);
    throw error;
  }
};

export const unfollowUser = async (myUserId, targetUserId) => {
  try {
    // followsサブコレクションから該当ドキュメント削除
    const snap = await getDocs(query(
      collection(db, "users", myUserId, "follows"),
      where("targetUserId", "==", targetUserId)
    ));
    
    const deletePromises = [];
    snap.forEach(docu => deletePromises.push(deleteDoc(docu.ref)));
    await Promise.all(deletePromises);
    
    // 相手のfollowsからも削除（相互フォローの場合）
    const otherSnap = await getDocs(query(
      collection(db, "users", targetUserId, "follows"),
      where("targetUserId", "==", myUserId)
    ));
    
    const otherDeletePromises = [];
    otherSnap.forEach(docu => otherDeletePromises.push(deleteDoc(docu.ref)));
    await Promise.all(otherDeletePromises);
    
    console.log("フォローを解除しました");
  } catch (error) {
    console.error("フォロー解除エラー:", error);
    throw error;
  }
};

/**
 * フォローリクエストを承認（フォローバック）
 */
export const acceptFollowRequest = async (myUserId, fromUserId) => {
  try {
    // 自分のfollowsに相手を追加
    await addDoc(collection(db, "users", myUserId, "follows"), {
      targetUserId: fromUserId,
      createdAt: new Date(),
      status: "accepted"
    });
    
    // 相手のフォロー状態をacceptedに更新
    const fromUserFollowSnap = await getDocs(query(
      collection(db, "users", fromUserId, "follows"),
      where("targetUserId", "==", myUserId)
    ));
    
    // ここでは簡易的に削除して再作成
    const deletePromises = [];
    fromUserFollowSnap.forEach(docu => deletePromises.push(deleteDoc(docu.ref)));
    await Promise.all(deletePromises);
    
    await addDoc(collection(db, "users", fromUserId, "follows"), {
      targetUserId: myUserId,
      createdAt: new Date(),
      status: "accepted"
    });
    
    // 承認通知を送信
    await addDoc(collection(db, "users", fromUserId, "notifications"), {
      type: "follow_accepted",
      fromUserId: myUserId,
      message: "フォローリクエストが承認されました",
      read: false,
      createdAt: new Date()
    });
    
    console.log("フォローリクエストを承認しました");
  } catch (error) {
    console.error("フォロー承認エラー:", error);
    throw error;
  }
};

/**
 * 通知取得
 */
export const getNotifications = async (userId) => {
  try {
    const notificationsSnap = await getDocs(query(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc")
    ));
    
    return notificationsSnap.docs.map(docu => ({
      id: docu.id,
      ...docu.data()
    }));
  } catch (error) {
    console.error("通知取得エラー:", error);
    return [];
  }
};

/**
 * 通知を既読にする
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    await deleteDoc(doc(db, "users", userId, "notifications", notificationId));
  } catch (error) {
    console.error("通知削除エラー:", error);
  }
};
// ...existing code...

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
