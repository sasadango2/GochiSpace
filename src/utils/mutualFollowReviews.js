import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 相互フォローユーザーのカテゴリー別レビューを取得
 * @param {string} currentUserId - 現在のユーザーID
 * @param {string} category - カテゴリー名（例：「和食」）
 * @returns {Promise<Array>} レビューの配列
 */
export const getMutualFollowReviewsByCategory = async (currentUserId, category) => {
  try {
    // 1. 相互フォローユーザーを取得
    const mutualFollowUsers = await getMutualFollowUsers(currentUserId);
    console.log(`相互フォローユーザー: ${mutualFollowUsers.length}人`);

    // 2. 相互フォローユーザー（自分を含む）のレビューを取得
    const allUserIds = [currentUserId, ...mutualFollowUsers];
    const allReviews = [];

    for (const userId of allUserIds) {
      try {
        const userReviews = await getUserReviewsByCategory(userId, category);
        allReviews.push(...userReviews);
      } catch (error) {
        console.warn(`ユーザー ${userId} のレビュー取得エラー:`, error);
      }
    }

    // 3. 作成日時でソート（新しい順）
    allReviews.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    console.log(`カテゴリー「${category}」のレビュー: ${allReviews.length}件`);
    return allReviews;

  } catch (error) {
    console.error('相互フォローレビュー取得エラー:', error);
    return [];
  }
};

/**
 * 相互フォローユーザーのIDリストを取得
 * @param {string} currentUserId - 現在のユーザーID
 * @returns {Promise<Array<string>>} 相互フォローユーザーIDの配列
 */
const getMutualFollowUsers = async (currentUserId) => {
  try {
    // 自分がフォローしているユーザーを取得
    const myFollowsRef = collection(db, 'users', currentUserId, 'follows');
    const myFollowsQuery = query(myFollowsRef, where('status', '==', 'accepted'));
    const myFollowsSnapshot = await getDocs(myFollowsQuery);

    const mutualUsers = [];

    for (const followDoc of myFollowsSnapshot.docs) {
      const targetUserId = followDoc.data().targetUserId;
      
      try {
        // 相手も自分をフォローしているかチェック
        const theirFollowsRef = collection(db, 'users', targetUserId, 'follows');
        const theirFollowsQuery = query(
          theirFollowsRef, 
          where('targetUserId', '==', currentUserId),
          where('status', '==', 'accepted')
        );
        const theirFollowsSnapshot = await getDocs(theirFollowsQuery);

        // 相互フォローの場合
        if (!theirFollowsSnapshot.empty) {
          mutualUsers.push(targetUserId);
        }
      } catch (error) {
        console.warn(`ユーザー ${targetUserId} の相互フォローチェックエラー:`, error);
      }
    }

    return mutualUsers;
  } catch (error) {
    console.error('相互フォローユーザー取得エラー:', error);
    return [];
  }
};

/**
 * 指定ユーザーの指定カテゴリーのレビューを取得
 * @param {string} userId - ユーザーID
 * @param {string} category - カテゴリー名
 * @returns {Promise<Array>} レビューの配列
 */
const getUserReviewsByCategory = async (userId, category) => {
  try {
    const reviewsRef = collection(db, 'users', userId, 'postRestaurantInfo');
    const reviewsQuery = query(reviewsRef, where('category', '==', category));
    const reviewsSnapshot = await getDocs(reviewsQuery);

    const reviews = reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        restaurantName: data.restaurantName,
        rating: data.rating,
        comment: data.comment,
        displayName: data.displayName,
        userId: data.userId,
        category: data.category,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        restaurantAddress: data.restaurantAddress,
        restaurantLocation: data.restaurantLocation,
        placeId: data.placeId
      };
    });

    console.log(`ユーザー ${userId} の「${category}」レビュー: ${reviews.length}件`);
    return reviews;

  } catch (error) {
    console.error(`ユーザー ${userId} のレビュー取得エラー:`, error);
    return [];
  }
};

/**
 * 全カテゴリーの相互フォローレビューを取得
 * @param {string} currentUserId - 現在のユーザーID
 * @returns {Promise<Array>} 全レビューの配列
 */
export const getAllMutualFollowReviews = async (currentUserId) => {
  try {
    // 1. 相互フォローユーザーを取得
    const mutualFollowUsers = await getMutualFollowUsers(currentUserId);
    console.log(`相互フォローユーザー: ${mutualFollowUsers.length}人`);

    // 2. 相互フォローユーザー（自分を含む）の全レビューを取得
    const allUserIds = [currentUserId, ...mutualFollowUsers];
    const allReviews = [];

    for (const userId of allUserIds) {
      try {
        const userReviews = await getAllUserReviews(userId);
        allReviews.push(...userReviews);
      } catch (error) {
        console.warn(`ユーザー ${userId} のレビュー取得エラー:`, error);
      }
    }

    // 3. 作成日時でソート（新しい順）
    allReviews.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    console.log(`全レビュー: ${allReviews.length}件`);
    return allReviews;

  } catch (error) {
    console.error('全相互フォローレビュー取得エラー:', error);
    return [];
  }
};

/**
 * 指定ユーザーの全レビューを取得
 * @param {string} userId - ユーザーID
 * @returns {Promise<Array>} レビューの配列
 */
const getAllUserReviews = async (userId) => {
  try {
    const reviewsRef = collection(db, 'users', userId, 'postRestaurantInfo');
    const reviewsSnapshot = await getDocs(reviewsRef);

    const reviews = reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        restaurantName: data.restaurantName,
        rating: data.rating,
        comment: data.comment,
        displayName: data.displayName,
        userId: data.userId,
        category: data.category,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        restaurantAddress: data.restaurantAddress,
        restaurantLocation: data.restaurantLocation,
        placeId: data.placeId
      };
    });

    console.log(`ユーザー ${userId} の全レビュー: ${reviews.length}件`);
    return reviews;

  } catch (error) {
    console.error(`ユーザー ${userId} のレビュー取得エラー:`, error);
    return [];
  }
};

/**
 * 相互フォローユーザー数を取得
 * @param {string} currentUserId - 現在のユーザーID
 * @returns {Promise<number>} 相互フォローユーザー数
 */
export const getMutualFollowUsersCount = async (currentUserId) => {
  try {
    const mutualUsers = await getMutualFollowUsers(currentUserId);
    return mutualUsers.length;
  } catch (error) {
    console.error('相互フォローユーザー数取得エラー:', error);
    return 0;
  }
};
