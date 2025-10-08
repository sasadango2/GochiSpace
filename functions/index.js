/**
 * Cloud Functions for Firebase
 * GochiSpace データ自動同期システム
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Firebase Admin SDK の初期化
admin.initializeApp();
const db = admin.firestore();

// ==========================================
// 🔄 レビュー投稿時の自動同期
// ==========================================

/**
 * ユーザーレビュー投稿時にrestaurantsコレクションを自動更新
 * トリガー: users/{userId}/postRestaurantInfo/{placeId} への書き込み
 */
exports.syncRestaurantOnReviewCreate = functions.firestore
  .document('users/{userId}/postRestaurantInfo/{placeId}')
  .onCreate(async (snap, context) => {
    const { userId, placeId } = context.params;
    const reviewData = snap.data();
    
    console.log(`🔄 新規レビュー検出: User ${userId}, Restaurant ${placeId}`);
    
    try {
      await syncRestaurantData(placeId, reviewData);
      console.log(`✅ レストラン ${placeId} の同期完了`);
    } catch (error) {
      console.error(`❌ 同期エラー: ${error.message}`);
      throw error;
    }
  });

/**
 * ユーザーレビュー更新時にrestaurantsコレクションを自動更新
 * トリガー: users/{userId}/postRestaurantInfo/{placeId} への更新
 */
exports.syncRestaurantOnReviewUpdate = functions.firestore
  .document('users/{userId}/postRestaurantInfo/{placeId}')
  .onUpdate(async (change, context) => {
    const { userId, placeId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    console.log(`🔄 レビュー更新検出: User ${userId}, Restaurant ${placeId}`);
    
    // 重要なフィールドが変更された場合のみ同期
    const importantFields = ['rating', 'category', 'restaurantName', 'restaurantAddress'];
    const hasImportantChanges = importantFields.some(field => 
      beforeData[field] !== afterData[field]
    );
    
    if (hasImportantChanges) {
      try {
        await syncRestaurantData(placeId, afterData);
        console.log(`✅ レストラン ${placeId} の更新同期完了`);
      } catch (error) {
        console.error(`❌ 更新同期エラー: ${error.message}`);
        throw error;
      }
    } else {
      console.log(`⏭️ 重要な変更なし、同期スキップ`);
    }
  });

/**
 * ユーザーレビュー削除時にrestaurantsコレクションを自動更新
 * トリガー: users/{userId}/postRestaurantInfo/{placeId} の削除
 */
exports.syncRestaurantOnReviewDelete = functions.firestore
  .document('users/{userId}/postRestaurantInfo/{placeId}')
  .onDelete(async (snap, context) => {
    const { userId, placeId } = context.params;
    
    console.log(`🗑️ レビュー削除検出: User ${userId}, Restaurant ${placeId}`);
    
    try {
      await syncRestaurantData(placeId, null);
      console.log(`✅ レストラン ${placeId} の削除同期完了`);
    } catch (error) {
      console.error(`❌ 削除同期エラー: ${error.message}`);
      throw error;
    }
  });

// ==========================================
// 👤 プロフィール更新時の自動同期
// ==========================================

/**
 * ユーザープロフィール更新時に関連レビューを自動更新
 * トリガー: users/{userId} の更新
 */
exports.syncReviewsOnProfileUpdate = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const { userId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // displayName の変更をチェック
    if (beforeData.displayName !== afterData.displayName) {
      console.log(`👤 プロフィール更新検出: User ${userId}, displayName: ${beforeData.displayName} → ${afterData.displayName}`);
      
      try {
        await updateUserDisplayNameInReviews(userId, afterData.displayName);
        console.log(`✅ ユーザー ${userId} のレビュー内displayName更新完了`);
      } catch (error) {
        console.error(`❌ プロフィール同期エラー: ${error.message}`);
        throw error;
      }
    }
  });

// ==========================================
// 🛠️ ヘルパー関数
// ==========================================

/**
 * レストランデータの自動同期処理
 */
async function syncRestaurantData(placeId, latestReviewData) {
  try {
    console.log(`🔄 レストランデータ同期開始: ${placeId}`);
    
    // 該当レストランの全レビューを取得
    const allReviews = await getAllReviewsForRestaurant(placeId);
    
    // 統計情報を計算
    const stats = calculateRestaurantStats(allReviews);
    
    const restaurantRef = db.collection('restaurants').doc(placeId);
    const restaurantDoc = await restaurantRef.get();
    
    if (allReviews.length === 0) {
      // レビューが0件の場合、レストランドキュメントを削除
      if (restaurantDoc.exists) {
        await restaurantRef.delete();
        console.log(`🗑️ レビュー0件のためレストラン ${placeId} を削除`);
      }
      return;
    }
    
    if (restaurantDoc.exists) {
      // 既存レストランの更新
      await restaurantRef.update({
        ...stats,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ 既存レストラン ${placeId} 更新完了`);
    } else {
      // 新規レストランの作成
      const newRestaurantData = {
        name: latestReviewData?.restaurantName || '',
        address: latestReviewData?.restaurantAddress || '',
        location: latestReviewData?.restaurantLocation || null,
        category: latestReviewData?.category || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...stats
      };
      
      await restaurantRef.set(newRestaurantData);
      console.log(`✅ 新規レストラン ${placeId} 作成完了`);
    }
  } catch (error) {
    console.error(`❌ レストランデータ同期エラー: ${error.message}`);
    throw error;
  }
}

/**
 * 特定レストランの全レビューを取得
 */
async function getAllReviewsForRestaurant(placeId) {
  try {
    const allReviews = [];
    
    // 全ユーザーのコレクションを取得
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const reviewRef = db.collection('users').doc(userId)
        .collection('postRestaurantInfo').doc(placeId);
      const reviewDoc = await reviewRef.get();
      
      if (reviewDoc.exists) {
        allReviews.push({
          userId,
          ...reviewDoc.data()
        });
      }
    }
    
    console.log(`📊 レストラン ${placeId} のレビュー ${allReviews.length}件を取得`);
    return allReviews;
  } catch (error) {
    console.error(`❌ レビュー取得エラー: ${error.message}`);
    return [];
  }
}

/**
 * レストランの統計情報を計算
 */
function calculateRestaurantStats(reviews) {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      reviewers: [],
      categories: []
    };
  }

  const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
  const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;
  
  const reviewers = reviews.map(review => ({
    userId: review.userId,
    displayName: review.userDisplayName || review.userEmail || 'Unknown'
  }));
  
  const categories = [...new Set(reviews.map(review => review.category).filter(Boolean))];
  
  // 最新レビュー日時の計算
  const lastReviewDate = reviews.reduce((latest, review) => {
    const reviewDate = review.createdAt || new Date(0);
    return reviewDate > latest ? reviewDate : latest;
  }, new Date(0));

  return {
    totalReviews: reviews.length,
    averageRating,
    reviewers,
    categories,
    lastReviewDate
  };
}

/**
 * ユーザーのdisplayName変更を全レビューに反映
 */
async function updateUserDisplayNameInReviews(userId, newDisplayName) {
  try {
    console.log(`👤 ユーザー ${userId} のdisplayName更新開始: ${newDisplayName}`);
    
    // ユーザーの全レビューを取得
    const reviewsSnapshot = await db.collection('users').doc(userId)
      .collection('postRestaurantInfo').get();
    
    const batch = db.batch();
    const updatedRestaurants = new Set();
    
    // 各レビューのdisplayNameを更新
    reviewsSnapshot.docs.forEach(reviewDoc => {
      const reviewRef = reviewDoc.ref;
      batch.update(reviewRef, {
        userDisplayName: newDisplayName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 影響を受けるレストランを記録
      updatedRestaurants.add(reviewDoc.id); // placeId
    });
    
    // バッチで一括更新
    await batch.commit();
    console.log(`✅ ${reviewsSnapshot.docs.length}件のレビューdisplayName更新完了`);
    
    // 影響を受けるレストランの統計を再計算
    for (const placeId of updatedRestaurants) {
      try {
        await syncRestaurantData(placeId, null);
      } catch (error) {
        console.error(`❌ レストラン ${placeId} の統計更新エラー: ${error.message}`);
      }
    }
    
    console.log(`✅ ${updatedRestaurants.size}件のレストラン統計更新完了`);
  } catch (error) {
    console.error(`❌ displayName更新エラー: ${error.message}`);
    throw error;
  }
}

// ==========================================
// 📊 手動同期・メンテナンス用関数
// ==========================================

/**
 * 全データの整合性チェックと修復（HTTP関数）
 */
exports.performDataIntegrityCheck = functions.https.onCall(async (data, context) => {
  // 認証チェック（管理者のみ実行可能）
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin権限が必要です');
  }
  
  try {
    console.log('🔍 データ整合性チェック開始...');
    
    const restaurantsSnapshot = await db.collection('restaurants').get();
    let processedCount = 0;
    const errors = [];
    
    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const placeId = restaurantDoc.id;
      
      try {
        // 実際のレビューデータから再計算
        const allReviews = await getAllReviewsForRestaurant(placeId);
        const correctStats = calculateRestaurantStats(allReviews);
        
        // 現在のデータと比較
        const currentData = restaurantDoc.data();
        const needsUpdate = (
          currentData.totalReviews !== correctStats.totalReviews ||
          Math.abs(currentData.averageRating - correctStats.averageRating) > 0.1
        );
        
        if (needsUpdate) {
          await db.collection('restaurants').doc(placeId).update({
            ...correctStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          processedCount++;
          console.log(`🔧 データ修正完了: ${placeId}`);
        }
      } catch (error) {
        errors.push({ placeId, error: error.message });
        console.error(`❌ ${placeId} の処理エラー: ${error.message}`);
      }
    }
    
    console.log(`✅ データ整合性チェック完了: ${processedCount}件を修正`);
    
    return {
      success: true,
      processed: processedCount,
      errors: errors,
      message: `${processedCount}件のデータを修正しました`
    };
  } catch (error) {
    console.error(`❌ データ整合性チェックエラー: ${error.message}`);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 特定レストランの手動同期（HTTP関数）
 */
exports.syncSpecificRestaurant = functions.https.onCall(async (data, context) => {
  const { placeId } = data;
  
  if (!placeId) {
    throw new functions.https.HttpsError('invalid-argument', 'placeIdが必要です');
  }
  
  try {
    await syncRestaurantData(placeId, null);
    return {
      success: true,
      message: `レストラン ${placeId} の同期が完了しました`
    };
  } catch (error) {
    console.error(`❌ 手動同期エラー: ${error.message}`);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
