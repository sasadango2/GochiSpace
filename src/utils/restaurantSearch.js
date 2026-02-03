/**
 * restaurantsコレクションを活用した高速検索ユーティリティ
 * 相互フォロー制限を維持しつつ、検索パフォーマンスを向上
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getMutualFollowUsers } from './mutualFollowReviews';

/**
 * restaurantsコレクションから飲食店を検索し、
 * 相互フォローユーザーのレビューのみを取得
 */
export const searchRestaurantsWithMutualReviews = async (searchText, currentUserId, options = {}) => {
  try {
    const { category, limit = 50 } = options;
    
    if (!searchText.trim() || !currentUserId) {
      return [];
    }

    console.log(`🔍 restaurants検索開始: "${searchText}"`);

    // 1. restaurantsコレクションから飲食店を検索
    const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
    let restaurants = restaurantsSnapshot.docs.map(doc => ({
      id: doc.id,  // placeId
      ...doc.data()
    }));

    // 飲食店名で絞り込み
    const searchLower = searchText.toLowerCase();
    restaurants = restaurants.filter(restaurant => 
      restaurant.name?.toLowerCase().includes(searchLower) ||
      restaurant.address?.toLowerCase().includes(searchLower)
    );

    // カテゴリーフィルター
    if (category) {
      restaurants = restaurants.filter(restaurant => 
        restaurant.categories?.includes(category) || restaurant.category === category
      );
    }

    console.log(`📊 restaurants検索結果: ${restaurants.length}件`);

    if (restaurants.length === 0) {
      return [];
    }

    // 2. 相互フォローユーザーIDリストを取得
    const mutualFollowUserIds = await getMutualFollowUsers(currentUserId);
    const allUserIds = [currentUserId, ...mutualFollowUserIds];
    console.log(`👥 相互フォローユーザー: ${allUserIds.length}人`);

    // 3. 各飲食店について、相互フォローユーザーのレビューのみを取得
    const results = [];
    
    for (const restaurant of restaurants.slice(0, limit)) {
      const placeId = restaurant.id;
      const mutualReviews = [];

      // 相互フォローユーザーのレビューのみを収集
      for (const userId of allUserIds) {
        try {
          const reviewsSnapshot = await getDocs(
            collection(db, 'users', userId, 'postRestaurantInfo')
          );

          const userReview = reviewsSnapshot.docs.find(doc => doc.id === placeId);
          
          if (userReview) {
            const reviewData = userReview.data();
            mutualReviews.push({
              id: userReview.id,
              userId: userId,
              ...reviewData
            });
          }
        } catch (error) {
          console.warn(`ユーザー ${userId} のレビュー取得エラー:`, error);
        }
      }

      // 相互フォローユーザーのレビューが存在する場合のみ結果に追加
      if (mutualReviews.length > 0) {
        results.push({
          id: placeId,
          name: restaurant.name,
          address: restaurant.address,
          location: restaurant.location,
          category: restaurant.category || restaurant.categories?.[0] || 'その他',
          reviewCount: mutualReviews.length,
          reviews: mutualReviews,
          // restaurants統計情報も含める
          totalReviewsAll: restaurant.totalReviews,
          averageRatingAll: restaurant.averageRating
        });
      }
    }

    console.log(`✅ 相互フォローフィルター後: ${results.length}件`);
    return results;

  } catch (error) {
    console.error('restaurants検索エラー:', error);
    return [];
  }
};

/**
 * カテゴリー別にrestaurantsコレクションから検索
 */
export const searchRestaurantsByCategory = async (category, currentUserId, options = {}) => {
  try {
    const { limit = 50 } = options;
    
    if (!category || !currentUserId) {
      return [];
    }

    console.log(`🔍 カテゴリー検索: ${category}`);

    // 1. restaurantsコレクションから該当カテゴリーの飲食店を取得
    const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
    let restaurants = restaurantsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(restaurant => 
        restaurant.categories?.includes(category) || restaurant.category === category
      );

    console.log(`📊 カテゴリー該当: ${restaurants.length}件`);

    if (restaurants.length === 0) {
      return [];
    }

    // 2. 相互フォローユーザーIDリストを取得
    const mutualFollowUserIds = await getMutualFollowUsers(currentUserId);
    const allUserIds = [currentUserId, ...mutualFollowUserIds];

    // 3. 相互フォローユーザーのレビューのみを取得
    const results = [];
    
    for (const restaurant of restaurants.slice(0, limit)) {
      const placeId = restaurant.id;
      const mutualReviews = [];

      for (const userId of allUserIds) {
        try {
          const reviewsSnapshot = await getDocs(
            collection(db, 'users', userId, 'postRestaurantInfo')
          );

          const userReview = reviewsSnapshot.docs.find(doc => doc.id === placeId);
          
          if (userReview) {
            const reviewData = userReview.data();
            // カテゴリーが一致するか再確認
            if (reviewData.category === category) {
              mutualReviews.push({
                id: userReview.id,
                userId: userId,
                ...reviewData
              });
            }
          }
        } catch (error) {
          console.warn(`ユーザー ${userId} のレビュー取得エラー:`, error);
        }
      }

      if (mutualReviews.length > 0) {
        results.push({
          id: placeId,
          name: restaurant.name,
          address: restaurant.address,
          location: restaurant.location,
          category: category,
          reviewCount: mutualReviews.length,
          reviews: mutualReviews
        });
      }
    }

    console.log(`✅ 相互フォローフィルター後: ${results.length}件`);
    return results;

  } catch (error) {
    console.error('カテゴリー検索エラー:', error);
    return [];
  }
};
