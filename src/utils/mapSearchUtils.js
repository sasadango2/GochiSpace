/**
 * マップ検索用ユーティリティ関数
 * 飲食店検索とユーザー名検索の機能を提供
 * 統合データ同期システムに対応
 */
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * restaurantsコレクションから飲食店を検索
 */
export const searchRestaurants = async (searchText, options = {}) => {
  try {
    const { category, limit = 50 } = options;
    
    // 基本クエリ
    let restaurantQuery = collection(db, 'restaurants');
    
    const querySnapshot = await getDocs(restaurantQuery);
    let restaurants = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // フィルタリング
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      restaurants = restaurants.filter(restaurant => 
        restaurant.name?.toLowerCase().includes(searchLower) ||
        restaurant.address?.toLowerCase().includes(searchLower) ||
        restaurant.description?.toLowerCase().includes(searchLower)
      );
    }

    if (category) {
      restaurants = restaurants.filter(restaurant => 
        restaurant.category === category
      );
    }

    // 制限数でカット
    restaurants = restaurants.slice(0, limit);

    console.log(`飲食店検索結果: ${restaurants.length}件`);
    return restaurants;
  } catch (error) {
    console.error('飲食店検索エラー:', error);
    return [];
  }
};

/**
 * 相互フォローユーザーを取得
 */
export const getMutualFollowUsers = async (currentUserId) => {
  try {
    if (!currentUserId) {
      return [];
    }

    // 1. 自分がフォローしているユーザーを取得
    const myFollowsSnapshot = await getDocs(
      query(
        collection(db, 'users', currentUserId, 'follows'),
        where('status', '==', 'accepted')
      )
    );

    const myFollowIds = myFollowsSnapshot.docs.map(doc => doc.data().targetUserId);

    if (myFollowIds.length === 0) {
      return [];
    }

    // 2. 相互フォローユーザーを特定
    const mutualFollowUsers = [];
    
    for (const followId of myFollowIds) {
      try {
        // 相手が自分をフォローしているかチェック
        const theirFollowSnapshot = await getDocs(
          query(
            collection(db, 'users', followId, 'follows'),
            where('targetUserId', '==', currentUserId),
            where('status', '==', 'accepted')
          )
        );

        if (theirFollowSnapshot.size > 0) {
          // 相互フォロー確認 - ユーザー情報を取得
          const userDocRef = doc(db, 'users', followId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            mutualFollowUsers.push({
              id: followId,
              ...userData
            });
          }
        }
      } catch (error) {
        console.warn(`ユーザー ${followId} の相互フォローチェックエラー:`, error);
      }
    }

    console.log(`相互フォローユーザー: ${mutualFollowUsers.length}人`);
    return mutualFollowUsers;
  } catch (error) {
    console.error('相互フォローユーザー取得エラー:', error);
    return [];
  }
};

/**
 * 指定した飲食店の全レビューを取得（相互フォローユーザーのみ）
 * 統合データ同期システムを使用
 */
export const getRestaurantReviews = async (restaurantLocation, currentUserId) => {
  try {
    if (!restaurantLocation || !currentUserId) {
      return [];
    }

    // 1. 相互フォローユーザーを取得
    const mutualUsers = await getMutualFollowUsers(currentUserId);
    const allUserIds = [currentUserId, ...mutualUsers.map(user => user.id)];

    // 2. 統合データ同期システムを使用してレビューを取得
    // レストランの位置情報からplace_idを特定する必要がある場合の処理
    // 実際の実装では、位置情報からplace_idを逆引きするか、
    // マーカークリック時にplace_idを渡すように修正することを推奨
    
    const allReviews = [];
    
    for (const userId of allUserIds) {
      try {
        // postRestaurantInfoサブコレクションからレビューを取得
        const userReviewsSnapshot = await getDocs(collection(db, 'users', userId, 'postRestaurantInfo'));
        
        userReviewsSnapshot.docs.forEach(doc => {
          const reviewData = doc.data();
          
          // 位置情報が一致するレビューを抽出
          if (reviewData.restaurantLocation && 
              Math.abs(reviewData.restaurantLocation.lat - restaurantLocation.lat) < 0.0001 &&
              Math.abs(reviewData.restaurantLocation.lng - restaurantLocation.lng) < 0.0001) {
            
            // ユーザー情報を追加
            const userInfo = mutualUsers.find(user => user.id === userId) || 
                             (userId === currentUserId ? { id: currentUserId, displayName: '自分' } : null);
            
            allReviews.push({
              id: doc.id,
              userId: userId,
              displayName: userInfo?.displayName || userInfo?.email || 'ユーザー',
              userEmail: userInfo?.email,
              ...reviewData
            });
          }
        });
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

    console.log(`該当飲食店のレビュー: ${allReviews.length}件（相互フォローユーザーのみ）`);
    return allReviews;
  } catch (error) {
    console.error('飲食店レビュー取得エラー:', error);
    return [];
  }
};

/**
 * usersコレクションからユーザーを検索し、そのレビューした飲食店を取得
 * 相互フォロー関係にあるユーザーのみを対象とする
 */
export const searchRestaurantsByUser = async (searchText, currentUserId, options = {}) => {
  try {
    const { limit = 50 } = options;
    
    if (!searchText.trim() || !currentUserId) {
      console.log('検索テキストまたはユーザーIDが不正です');
      return [];
    }

    const searchLower = searchText.toLowerCase();
    console.log(`ユーザー検索開始: "${searchText}", currentUserId: ${currentUserId}`);
    
    // 1. 相互フォローユーザーを取得
    const mutualUsers = await getMutualFollowUsers(currentUserId);
    console.log(`相互フォローユーザー取得結果: ${mutualUsers.length}人`);
    
    // デバッグ: 相互フォローユーザーの詳細を表示
    mutualUsers.forEach(user => {
      console.log(`相互フォローユーザー: ${user.displayName || user.email} (ID: ${user.id})`);
    });
    
    // 2. 検索対象ユーザーを相互フォロー関係から絞り込み
    const matchingUsers = mutualUsers.filter(user => 
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );

    if (matchingUsers.length === 0) {
      console.log('該当する相互フォローユーザーが見つかりませんでした');
      // 相互フォロー関係がない場合でも、全ユーザーから検索してデバッグ
      console.log('デバッグ: 全ユーザーからの検索を試行します');
      
      // 全ユーザーを検索してデバッグ
      const allUsersSnapshot = await getDocs(collection(db, 'users'));
      const allUsers = allUsersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const allMatchingUsers = allUsers.filter(user => 
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
      
      console.log(`デバッグ: 全ユーザーから ${allMatchingUsers.length}人が該当`);
      allMatchingUsers.forEach(user => {
        console.log(`該当ユーザー: ${user.displayName || user.email} (ID: ${user.id})`);
      });
      
      return [];
    }

    console.log(`該当相互フォローユーザー: ${matchingUsers.length}人`);
    matchingUsers.forEach(user => {
      console.log(`該当ユーザー: ${user.displayName || user.email} (ID: ${user.id})`);
    });

    // 3. 各ユーザーのpostRestaurantInfoサブコレクションからレビューを取得
    const allRestaurants = [];
    const restaurantMap = new Map(); // 重複除去用

    for (const user of matchingUsers) {
      try {
        console.log(`ユーザー ${user.displayName || user.email} (${user.id}) のレビューを検索中...`);
        
        // postRestaurantInfoサブコレクションからレビューを取得
        const reviewsSnapshot = await getDocs(
          collection(db, 'users', user.id, 'postRestaurantInfo')
        );
        
        console.log(`${user.displayName || user.email}: postRestaurantInfoサブコレクションから ${reviewsSnapshot.docs.length}件のドキュメントを取得`);
        
        // データが見つからない場合は、reviewsサブコレクションも確認
        if (reviewsSnapshot.docs.length === 0) {
          console.log(`${user.displayName || user.email}: postRestaurantInfoが空のため、reviewsサブコレクションを確認中...`);
          const legacyReviewsSnapshot = await getDocs(
            collection(db, 'users', user.id, 'reviews')
          );
          console.log(`${user.displayName || user.email}: reviewsサブコレクションから ${legacyReviewsSnapshot.docs.length}件のドキュメントを取得`);
          
          // reviewsサブコレクションからも処理
          for (const reviewDoc of legacyReviewsSnapshot.docs) {
            const reviewData = reviewDoc.data();
            console.log(`${user.displayName || user.email}: レビューデータ`, reviewData);
            
            if (reviewData.restaurantLocation && reviewData.restaurantName) {
              const key = `${reviewData.restaurantLocation.lat}_${reviewData.restaurantLocation.lng}`;
              
              if (!restaurantMap.has(key)) {
                const restaurantInfo = {
                  id: `review_${reviewDoc.id}`,
                  name: reviewData.restaurantName,
                  location: reviewData.restaurantLocation,
                  address: reviewData.restaurantAddress || '',
                  category: reviewData.category || 'その他',
                  reviewCount: 1,
                  reviewUsers: [user.displayName || user.email],
                  reviews: [{ ...reviewData, userId: user.id, userName: user.displayName || user.email }]
                };
                
                restaurantMap.set(key, restaurantInfo);
                allRestaurants.push(restaurantInfo);
                console.log(`レストラン追加: ${restaurantInfo.name} at ${key}`);
              } else {
                // 既存の飲食店に追加情報をマージ
                const existing = restaurantMap.get(key);
                existing.reviewCount += 1;
                if (!existing.reviewUsers.includes(user.displayName || user.email)) {
                  existing.reviewUsers.push(user.displayName || user.email);
                }
                existing.reviews.push({ ...reviewData, userId: user.id, userName: user.displayName || user.email });
                console.log(`既存レストランに追加: ${existing.name} (${existing.reviewCount}件目)`);
              }
            }
          }
        }
        
        for (const reviewDoc of reviewsSnapshot.docs) {
          const reviewData = reviewDoc.data();
          console.log(`${user.displayName || user.email}: レビューデータ`, reviewData);
          
          // レビューに含まれる飲食店情報を取得
          if (reviewData.restaurantLocation && reviewData.restaurantName) {
            const key = `${reviewData.restaurantLocation.lat}_${reviewData.restaurantLocation.lng}`;
            
            if (!restaurantMap.has(key)) {
              const restaurantInfo = {
                id: `review_${reviewDoc.id}`,
                name: reviewData.restaurantName,
                location: reviewData.restaurantLocation,
                address: reviewData.restaurantAddress || '',
                category: reviewData.category || 'その他',
                reviewCount: 1,
                reviewUsers: [user.displayName || user.email],
                reviews: [{ ...reviewData, userId: user.id, userName: user.displayName || user.email }]
              };
              
              restaurantMap.set(key, restaurantInfo);
              allRestaurants.push(restaurantInfo);
              console.log(`レストラン追加: ${restaurantInfo.name} at ${key}`);
            } else {
              // 既存の飲食店に追加情報をマージ
              const existing = restaurantMap.get(key);
              existing.reviewCount += 1;
              if (!existing.reviewUsers.includes(user.displayName || user.email)) {
                existing.reviewUsers.push(user.displayName || user.email);
              }
              existing.reviews.push({ ...reviewData, userId: user.id, userName: user.displayName || user.email });
              console.log(`既存レストランに追加: ${existing.name} (${existing.reviewCount}件目)`);
            }
          } else {
            console.log(`${user.displayName || user.email}: レビューに飲食店情報が不完全`, reviewData);
          }
        }
      } catch (error) {
        console.warn(`ユーザー ${user.id} のレビュー取得エラー:`, error);
      }
    }

    // 4. レビュー数順でソート
    allRestaurants.sort((a, b) => b.reviewCount - a.reviewCount);
    
    // 制限数でカット
    const limitedRestaurants = allRestaurants.slice(0, limit);

    console.log(`相互フォローユーザーレビュー飲食店検索結果: ${limitedRestaurants.length}件（合計: ${allRestaurants.length}件）`);
    limitedRestaurants.forEach(restaurant => {
      console.log(`結果: ${restaurant.name} (${restaurant.reviewCount}件のレビュー) - ユーザー: ${restaurant.reviewUsers.join(', ')}`);
    });
    
    return limitedRestaurants;
  } catch (error) {
    console.error('相互フォローユーザーレビュー飲食店検索エラー:', error);
    return [];
  }
};

/**
 * 検索タイプを自動判定
 */
export const detectSearchType = (searchText) => {
  if (!searchText.trim()) {
    return 'none';
  }

  // @記号で始まる場合はユーザー検索
  if (searchText.startsWith('@')) {
    return 'user';
  }

  // メールアドレス形式の場合はユーザー検索
  if (searchText.includes('@') && searchText.includes('.')) {
    return 'user';
  }

  // それ以外は飲食店検索
  return 'restaurant';
};

/**
 * デバッグ用: 全ユーザーからユーザー検索して飲食店を取得（相互フォロー制限なし）
 */
export const searchRestaurantsByUserDebug = async (searchText, currentUserId, options = {}) => {
  try {
    const { limit = 50 } = options;
    
    if (!searchText.trim()) {
      return [];
    }

    const searchLower = searchText.toLowerCase();
    console.log(`デバッグモード: 全ユーザーから検索 "${searchText}"`);
    
    // 全ユーザーを取得
    const allUsersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = allUsersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`全ユーザー数: ${allUsers.length}人`);
    
    // 検索対象ユーザーを絞り込み
    const matchingUsers = allUsers.filter(user => 
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );

    console.log(`該当ユーザー: ${matchingUsers.length}人`);
    matchingUsers.forEach(user => {
      console.log(`該当ユーザー: ${user.displayName || user.email} (ID: ${user.id})`);
    });

    if (matchingUsers.length === 0) {
      return [];
    }

    // 各ユーザーのレビューを取得
    const allRestaurants = [];
    const restaurantMap = new Map();

    for (const user of matchingUsers) {
      try {
        console.log(`${user.displayName || user.email}: レビュー検索中...`);
        
        // postRestaurantInfoとreviewsの両方を確認
        const collections = ['postRestaurantInfo', 'reviews'];
        
        for (const collectionName of collections) {
          const reviewsSnapshot = await getDocs(
            collection(db, 'users', user.id, collectionName)
          );
          
          console.log(`${user.displayName || user.email}: ${collectionName}から ${reviewsSnapshot.docs.length}件`);
          
          for (const reviewDoc of reviewsSnapshot.docs) {
            const reviewData = reviewDoc.data();
            
            if (reviewData.restaurantLocation && reviewData.restaurantName) {
              const key = `${reviewData.restaurantLocation.lat}_${reviewData.restaurantLocation.lng}`;
              
              if (!restaurantMap.has(key)) {
                const restaurantInfo = {
                  id: `review_${reviewDoc.id}`,
                  name: reviewData.restaurantName,
                  location: reviewData.restaurantLocation,
                  address: reviewData.restaurantAddress || '',
                  category: reviewData.category || 'その他',
                  reviewCount: 1,
                  reviewUsers: [user.displayName || user.email],
                  reviews: [{ ...reviewData, userId: user.id, userName: user.displayName || user.email }]
                };
                
                restaurantMap.set(key, restaurantInfo);
                allRestaurants.push(restaurantInfo);
                console.log(`レストラン追加: ${restaurantInfo.name}`);
              } else {
                const existing = restaurantMap.get(key);
                existing.reviewCount += 1;
                if (!existing.reviewUsers.includes(user.displayName || user.email)) {
                  existing.reviewUsers.push(user.displayName || user.email);
                }
                existing.reviews.push({ ...reviewData, userId: user.id, userName: user.displayName || user.email });
              }
            }
          }
        }
      } catch (error) {
        console.warn(`ユーザー ${user.id} のレビュー取得エラー:`, error);
      }
    }

    // レビュー数順でソート
    allRestaurants.sort((a, b) => b.reviewCount - a.reviewCount);
    const limitedRestaurants = allRestaurants.slice(0, limit);

    console.log(`デバッグモード検索結果: ${limitedRestaurants.length}件`);
    return limitedRestaurants;
  } catch (error) {
    console.error('デバッグユーザー検索エラー:', error);
    return [];
  }
};

/**
 * 統合検索関数
 */
export const performMapSearch = async (searchText, currentUserId, options = {}) => {
  const searchType = detectSearchType(searchText);
  
  console.log(`検索タイプ: ${searchType}, 検索文字列: "${searchText}"`);
  
  switch (searchType) {
    case 'user':
      const userText = searchText.startsWith('@') ? searchText.slice(1) : searchText;
      
      // デバッグモードの切り替え（検索文字列に"debug"が含まれている場合）
      if (searchText.toLowerCase().includes('debug')) {
        console.log('デバッグモードで検索実行');
        return await searchRestaurantsByUserDebug(userText.replace(/debug/gi, '').trim(), currentUserId, options);
      } else {
        console.log('通常モードで検索実行');
        return await searchRestaurantsByUser(userText, currentUserId, options);
      }
    
    case 'restaurant':
      return await searchRestaurants(searchText, options);
    
    default:
      return [];
  }
};
