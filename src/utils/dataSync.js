/**
 * データベース同期ユーティリティ（クライアントサイド完全版）
 * postRestaurantInfoとrestaurantsコレクション間の自動同期を管理
 * Cloud Functions を使用せず、クライアントサイドで完全な自動同期を実現
 */

import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  collection, 
  getDocs, 
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * 全体データ整合性チェック（クライアントサイド版）
 */
export const performDataIntegrityCheck = async () => {
  try {
    console.log('🔍 データ整合性チェック開始 (クライアントサイド)...');
    
    const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
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
          await updateDoc(doc(db, "restaurants", placeId), {
            ...correctStats,
            updatedAt: serverTimestamp()
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
    throw error;
  }
};

/**
 * 特定レストランの手動同期（クライアントサイド版）
 */
export const syncSpecificRestaurant = async (placeId) => {
  try {
    console.log(`🔄 特定レストラン同期開始 (クライアントサイド): ${placeId}`);
    
    await syncRestaurantData(placeId, null, null);
    
    console.log(`✅ レストラン ${placeId} の同期完了`);
    return {
      success: true,
      message: `レストラン ${placeId} の同期が完了しました`
    };
  } catch (error) {
    console.error(`❌ レストラン ${placeId} の同期エラー:`, error);
    throw error;
  }
};

/**
 * 投稿時の統合保存処理（クライアントサイド完全版）
 */
export const saveReviewData = async (userId, restaurantData, reviewData) => {
  try {
    // Google Place IDを取得
    const placeId = restaurantData.placeId || restaurantData.place_id;
    
    console.log('📝 統合レビュー保存開始 (クライアントサイド完全版):', {
      userId,
      placeId: placeId
    });

    // 1. レビューをpostRestaurantInfoサブコレクションに保存（ドキュメントIDはGoogle Place ID）
    const reviewRef = doc(db, 'users', userId, 'postRestaurantInfo', placeId);
    
    // 座標データを安全に抽出
    const lat = typeof restaurantData.geometry?.location?.lat === 'number' 
      ? restaurantData.geometry.location.lat 
      : (typeof restaurantData.geometry?.location?.lat === 'function' 
        ? restaurantData.geometry.location.lat() 
        : 0);
    const lng = typeof restaurantData.geometry?.location?.lng === 'number' 
      ? restaurantData.geometry.location.lng 
      : (typeof restaurantData.geometry?.location?.lng === 'function' 
        ? restaurantData.geometry.location.lng() 
        : 0);
    
    // レビューデータを整理（レストラン情報も含む）
    const cleanReviewData = {
      // レビュー情報
      comment: reviewData.comment,
      rating: reviewData.rating,
      category: reviewData.category,
      userDisplayName: reviewData.userDisplayName,
      userId: userId,
      createdAt: "", // 空文字列として保存
      
      // レストラン情報
      restaurantName: restaurantData.name,
      restaurantAddress: restaurantData.formatted_address || "",
      restaurantLocation: {
        lat: lat,
        lng: lng
      },
      placeId: placeId,
      
      updatedAt: serverTimestamp()
    };
    
    await setDoc(reviewRef, cleanReviewData);

    // 2. レストランデータを restaurants コレクションに保存（ドキュメントIDはGoogle Place ID）
    const restaurantRef = doc(db, 'restaurants', placeId);
    
    // レストランドキュメントの構造
    const restaurantDocData = {
      name: restaurantData.name,
      address: restaurantData.formatted_address || "",
      category: reviewData.category,
      location: {
        lat: lat,
        lng: lng
      },
      createdAt: "", // 空文字列として保存
      [`reviews.${userId}`]: {
        comment: reviewData.comment,
        rating: reviewData.rating,
        userDisplayName: reviewData.userDisplayName,
        userId: userId,
        createdAt: "" // 空文字列として保存
      }
    };
    
    await setDoc(restaurantRef, restaurantDocData, { merge: true });

    // 3. 自動同期処理を実行
    await syncRestaurantData(placeId, userId, reviewData);

    console.log('✅ 統合レビュー保存完了 (クライアントサイド)');

    return {
      success: true,
      placeId: placeId,
      message: 'レビューが正常に保存され、自動同期されました'
    };
  } catch (error) {
    console.error('❌ 統合レビュー保存エラー (クライアントサイド):', error);
    throw error;
  }
};

/**
 * レストランデータ同期処理（クライアントサイド版）
 */
export const syncRestaurantData = async (placeId, userId = null, reviewData = null) => {
  try {
    console.log(`🔄 レストランデータ同期開始 (クライアントサイド): ${placeId}`);

    // 該当レストランの全レビューを収集
    const allReviews = await getAllReviewsForRestaurant(placeId);
    
    if (allReviews.length === 0) {
      // レビューが存在しない場合、レストランドキュメントを削除
      const restaurantRef = doc(db, 'restaurants', placeId);
      await deleteDoc(restaurantRef);
      console.log(`🗑️ レストラン削除完了 (レビューなし): ${placeId}`);
      return {
        success: true,
        action: 'deleted',
        message: `レストラン ${placeId} を削除しました（レビューなし）`
      };
    }

    // 統計を計算
    const stats = calculateRestaurantStats(allReviews);

    // restaurants コレクションを更新
    const restaurantRef = doc(db, 'restaurants', placeId);
    await updateDoc(restaurantRef, {
      ...stats,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ レストランデータ同期完了 (クライアントサイド): ${placeId}`, stats);

    return {
      success: true,
      action: 'updated',
      placeId: placeId,
      stats: stats,
      message: `レストラン ${placeId} の統計が更新されました`
    };
  } catch (error) {
    console.error(`❌ レストランデータ同期エラー (クライアントサイド): ${placeId}`, error);
    throw error;
  }
};

/**
 * レビュー削除時の同期処理（クライアントサイド版）
 */
export const deleteReviewData = async (userId, placeId) => {
  try {
    console.log('🗑️ レビュー削除同期開始 (クライアントサイド):', {
      userId,
      placeId
    });

    // 1. ユーザーのレビューを削除（ドキュメントIDはplaceId）
    const reviewRef = doc(db, 'users', userId, 'postRestaurantInfo', placeId);
    await deleteDoc(reviewRef);

    // 2. restaurantsコレクションのレビューマップからユーザーのレビューを削除
    const restaurantRef = doc(db, 'restaurants', placeId);
    await updateDoc(restaurantRef, {
      [`reviews.${userId}`]: deleteField()
    });

    // 3. レストランデータを自動同期
    await syncRestaurantData(placeId, userId, null);

    console.log('✅ レビュー削除同期完了 (クライアントサイド)');

    return {
      success: true,
      placeId: placeId,
      message: 'レビューが削除され、レストランデータが自動同期されました'
    };
  } catch (error) {
    console.error('❌ レビュー削除同期エラー (クライアントサイド):', error);
    throw error;
  }
};

/**
 * ユーザープロフィール更新（クライアントサイド版）
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    console.log('👤 ユーザープロフィール更新開始 (クライアントサイド):', userId);

    // 1. プロフィールを更新
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    });

    // 2. displayNameが変更された場合、レビューのdisplayNameも一括更新
    if (profileData.displayName) {
      await updateUserDisplayNameInReviews(userId, profileData.displayName);
    }

    console.log('✅ ユーザープロフィール更新完了 (クライアントサイド)');

    return {
      success: true,
      userId: userId,
      updatedFields: Object.keys(profileData),
      message: 'プロフィールが更新され、関連データが自動同期されました'
    };
  } catch (error) {
    console.error('❌ ユーザープロフィール更新エラー (クライアントサイド):', error);
    throw error;
  }
};

/**
 * displayNameの一括更新（バッチ処理）
 */
export const updateUserDisplayNameInReviews = async (userId, newDisplayName) => {
  try {
    console.log(`🔄 displayName一括更新開始: ${userId} → ${newDisplayName}`);
    
    // ユーザーの全レビューを取得
    const reviewsSnapshot = await getDocs(
      collection(db, 'users', userId, 'postRestaurantInfo')
    );
    
    const batch = writeBatch(db);
    let updateCount = 0;
    
    reviewsSnapshot.docs.forEach(doc => {
      const reviewData = doc.data();
      if (reviewData.displayName !== newDisplayName) {
        batch.update(doc.ref, { 
          displayName: newDisplayName,
          updatedAt: serverTimestamp()
        });
        updateCount++;
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ displayName更新完了: ${updateCount}件のレビューを更新`);
    } else {
      console.log('ℹ️ 更新対象なし: 全レビューのdisplayNameは既に最新');
    }
    
    return {
      success: true,
      updatedCount: updateCount,
      message: `${updateCount}件のレビューのdisplayNameを更新しました`
    };
  } catch (error) {
    console.error(`❌ displayName更新エラー: ${error.message}`);
    throw error;
  }
};

/**
 * 特定レストランの手動同期用レビュー収集
 */
const getAllReviewsForRestaurant = async (placeId) => {
  console.log(`📋 レストラン ${placeId} の全レビュー収集開始...`);
  
  const users = await getDocs(collection(db, 'users'));
  const allReviews = [];
  
  for (const userDoc of users.docs) {
    const userReviews = await getDocs(
      collection(db, 'users', userDoc.id, 'postRestaurantInfo')
    );
    
    for (const reviewDoc of userReviews.docs) {
      const reviewData = reviewDoc.data();
      if (reviewData.placeId === placeId) {
        allReviews.push({
          id: reviewDoc.id,
          userId: userDoc.id,
          ...reviewData
        });
      }
    }
  }
  
  console.log(`📊 収集完了: ${allReviews.length}件のレビュー`);
  return allReviews;
};

/**
 * レストラン統計計算
 */
const calculateRestaurantStats = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      lastReviewedAt: null
    };
  }
  
  const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
  const averageRating = totalRating / reviews.length;
  
  // 最新のレビュー日時を取得
  const latestReview = reviews.reduce((latest, review) => {
    const reviewDate = review.timestamp?.toDate() || new Date(review.timestamp);
    const latestDate = latest?.toDate() || new Date(latest);
    return reviewDate > latestDate ? review.timestamp : latest;
  }, null);
  
  return {
    totalReviews: reviews.length,
    averageRating: parseFloat(averageRating.toFixed(2)),
    lastReviewedAt: latestReview
  };
};

/**
 * リアルタイム同期リスナー（開発用）
 */
export const setupRestaurantSyncListener = (placeId, onUpdate) => {
  console.log(`🔊 リアルタイム同期リスナー開始: ${placeId}`);
  
  const unsubscribe = onSnapshot(
    doc(db, 'restaurants', placeId),
    (doc) => {
      if (doc.exists()) {
        console.log(`📡 リアルタイム更新受信: ${placeId}`, doc.data());
        onUpdate(doc.data());
      }
    },
    (error) => {
      console.error(`❌ リアルタイム同期エラー: ${placeId}`, error);
    }
  );
  
  return unsubscribe;
};
