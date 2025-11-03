import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  doc, 
  getDoc,
  updateDoc,
  onSnapshot
} from "firebase/firestore";

/**
 * 通知システム - フォロー関連の詳細通知管理
 */

/**
 * フォローボタン押下時の包括的処理
 * データベース状態を確認して適切な通知を生成
 */
export const handleFollowAction = async (myUserId, targetUserId) => {
  if (myUserId === targetUserId) {
    throw new Error("自分をフォローすることはできません");
  }

  try {
    // 1. 現在のフォロー状態を確認
    const currentStatus = await getDetailedFollowStatus(myUserId, targetUserId);
    console.log("現在のフォロー状態:", currentStatus);

    // 2. 状態に応じた処理を実行
    switch (currentStatus.action) {
      case "send_request":
        return await sendFollowRequest(myUserId, targetUserId);
      
      case "accept_request":
        return await acceptFollowRequest(myUserId, targetUserId);
      
      case "already_following":
        throw new Error("既にフォロー中です");
      
      case "already_mutual":
        throw new Error("既に相互フォロー中です");
      
      default:
        throw new Error("不明なフォロー状態です");
    }
  } catch (error) {
    console.error("フォローアクション処理エラー:", error);
    throw error;
  }
};

/**
 * 詳細なフォロー状態を取得
 */
export const getDetailedFollowStatus = async (myUserId, targetUserId) => {
  try {
    // 自分 → 相手のフォロー状態
    const myFollowSnap = await getDocs(query(
      collection(db, "users", myUserId, "follows"),
      where("targetUserId", "==", targetUserId)
    ));

    // 相手 → 自分のフォロー状態
    const theirFollowSnap = await getDocs(query(
      collection(db, "users", targetUserId, "follows"),
      where("targetUserId", "==", myUserId)
    ));

    const iFollowThem = myFollowSnap.size > 0;
    const theyFollowMe = theirFollowSnap.size > 0;

    let myFollowStatus = "none";
    let theirFollowStatus = "none";

    if (iFollowThem) {
      myFollowStatus = myFollowSnap.docs[0].data().status || "pending";
    }

    if (theyFollowMe) {
      theirFollowStatus = theirFollowSnap.docs[0].data().status || "pending";
    }

    // アクションを決定
    let action = "send_request";
    let buttonText = "フォローする";
    let description = "";

    if (iFollowThem && theyFollowMe && myFollowStatus === "accepted" && theirFollowStatus === "accepted") {
      // 相互フォロー状態
      action = "already_mutual";
      buttonText = "相互フォロー中";
      description = "お互いにフォローしています";
    } else if (iFollowThem && myFollowStatus === "pending") {
      // フォローリクエスト送信済み
      action = "already_following";
      buttonText = "リクエスト送信済み";
      description = "フォローリクエストを送信済みです";
    } else if (theyFollowMe && theirFollowStatus === "pending") {
      // 相手からフォローリクエストを受けている
      action = "accept_request";
      buttonText = "フォローバック";
      description = "この人があなたをフォローリクエスト中です";
    } else if (theyFollowMe && theirFollowStatus === "accepted") {
      // 相手が自分をフォローしている（自分は相手をフォローしていない）
      action = "send_request";
      buttonText = "フォローバック";
      description = "この人があなたをフォローしています";
    }

    return {
      iFollowThem,
      theyFollowMe,
      myFollowStatus,
      theirFollowStatus,
      isMutual: iFollowThem && theyFollowMe && myFollowStatus === "accepted" && theirFollowStatus === "accepted",
      action,
      buttonText,
      description
    };
  } catch (error) {
    console.error("フォロー状態取得エラー:", error);
    return {
      iFollowThem: false,
      theyFollowMe: false,
      myFollowStatus: "none",
      theirFollowStatus: "none",
      isMutual: false,
      action: "send_request",
      buttonText: "フォローする",
      description: ""
    };
  }
};

/**
 * フォローリクエスト送信
 */
export const sendFollowRequest = async (myUserId, targetUserId) => {
  try {
    // ユーザー情報を取得して通知に含める
    const myUserDoc = await getDoc(doc(db, "users", myUserId));
    const myUserData = myUserDoc.exists() ? myUserDoc.data() : {};
    const myDisplayName = myUserData.displayName || myUserData.email || "Unknown User";

    // フォロー関係を作成
    await addDoc(collection(db, "users", myUserId, "follows"), {
      targetUserId,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 詳細な通知を作成
    const notification = {
      type: "follow_request",
      fromUserId: myUserId,
      fromDisplayName: myDisplayName,
      fromUserEmail: myUserData.email || "",
      message: `${myDisplayName}さんからフォローリクエストが届きました`,
      read: false,
      createdAt: new Date(),
      // 通知の有効期限（30日後）
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      // 通知メタデータ
      metadata: {
        actionRequired: true,
        category: "social",
        priority: "normal"
      }
    };

    await addDoc(collection(db, "users", targetUserId, "notifications"), notification);

    console.log(`フォローリクエストを送信: ${myDisplayName} → ${targetUserId}`);
    
    return {
      success: true,
      action: "follow_request_sent",
      message: `${myDisplayName}さんにフォローリクエストを送信しました`,
      notification
    };
  } catch (error) {
    console.error("フォローリクエスト送信エラー:", error);
    throw error;
  }
};

/**
 * フォローリクエスト承認（フォローバック）
 */
export const acceptFollowRequest = async (myUserId, fromUserId) => {
  try {
    // ユーザー情報を取得
    const myUserDoc = await getDoc(doc(db, "users", myUserId));
    const fromUserDoc = await getDoc(doc(db, "users", fromUserId));
    
    const myUserData = myUserDoc.exists() ? myUserDoc.data() : {};
    const fromUserData = fromUserDoc.exists() ? fromUserDoc.data() : {};
    
    const myDisplayName = myUserData.displayName || myUserData.email || "Unknown User";
    const fromDisplayName = fromUserData.displayName || fromUserData.email || "Unknown User";

    // 1. 自分のフォロー関係を作成（フォローバック）
    await addDoc(collection(db, "users", myUserId, "follows"), {
      targetUserId: fromUserId,
      status: "accepted",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 2. 相手のフォロー状態をacceptedに更新
    const fromUserFollowSnap = await getDocs(query(
      collection(db, "users", fromUserId, "follows"),
      where("targetUserId", "==", myUserId)
    ));

    // 既存のpendingステータスを削除して新しいacceptedステータスを作成
    const deletePromises = [];
    fromUserFollowSnap.forEach(docu => deletePromises.push(deleteDoc(docu.ref)));
    await Promise.all(deletePromises);

    await addDoc(collection(db, "users", fromUserId, "follows"), {
      targetUserId: myUserId,
      status: "accepted",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 3. 元のフォローリクエスト通知を削除
    const requestNotifications = await getDocs(query(
      collection(db, "users", myUserId, "notifications"),
      where("type", "==", "follow_request"),
      where("fromUserId", "==", fromUserId)
    ));

    const deleteNotificationPromises = [];
    requestNotifications.forEach(docu => deleteNotificationPromises.push(deleteDoc(docu.ref)));
    await Promise.all(deleteNotificationPromises);

    // 4. 承認通知を送信
    const acceptNotification = {
      type: "follow_accepted",
      fromUserId: myUserId,
      fromDisplayName: myDisplayName,
      fromUserEmail: myUserData.email || "",
      message: `${myDisplayName}さんがあなたのフォローリクエストを承認しました！相互フォローになりました🎉`,
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7日後に期限切れ
      metadata: {
        actionRequired: false,
        category: "social",
        priority: "high",
        celebratory: true // お祝いの通知
      }
    };

    await addDoc(collection(db, "users", fromUserId, "notifications"), acceptNotification);

    console.log(`フォローリクエスト承認: ${myDisplayName} ↔ ${fromDisplayName} (相互フォロー成立)`);
    
    return {
      success: true,
      action: "follow_accepted",
      message: `${fromDisplayName}さんとの相互フォローが成立しました！`,
      isMutual: true,
      notification: acceptNotification
    };
  } catch (error) {
    console.error("フォローリクエスト承認エラー:", error);
    throw error;
  }
};

/**
 * フォロー解除
 */
export const unfollowUser = async (myUserId, targetUserId) => {
  try {
    // ユーザー情報を取得
    const myUserDoc = await getDoc(doc(db, "users", myUserId));
    
    const myUserData = myUserDoc.exists() ? myUserDoc.data() : {};
    
    const myDisplayName = myUserData.displayName || myUserData.email || "Unknown User";

    // 自分のフォロー関係を削除
    const myFollowSnap = await getDocs(query(
      collection(db, "users", myUserId, "follows"),
      where("targetUserId", "==", targetUserId)
    ));

    const deletePromises = [];
    myFollowSnap.forEach(docu => deletePromises.push(deleteDoc(docu.ref)));
    await Promise.all(deletePromises);

    // フォロー解除通知を送信（オプション）
    const unfollowNotification = {
      type: "unfollowed",
      fromUserId: myUserId,
      fromDisplayName: myDisplayName,
      message: `${myDisplayName}さんがフォローを解除しました`,
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3日後に期限切れ
      metadata: {
        actionRequired: false,
        category: "social",
        priority: "low"
      }
    };

    await addDoc(collection(db, "users", targetUserId, "notifications"), unfollowNotification);

    console.log(`フォロー解除: ${myDisplayName} → ${targetUserId}`);
    
    return {
      success: true,
      action: "unfollowed",
      message: "フォローを解除しました",
      notification: unfollowNotification
    };
  } catch (error) {
    console.error("フォロー解除エラー:", error);
    throw error;
  }
};

/**
 * 通知の一覧取得（フィルタ機能付き）
 */
export const getNotifications = async (userId, options = {}) => {
  try {
    const {
      limit = 50,
      unreadOnly = false,
      category = null,
      includeExpired = false
    } = options;

    let notificationsQuery = query(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc")
    );

    // 期限切れの通知を除外
    if (!includeExpired) {
      // Firestoreの制限で複数のwhere条件とorderByを組み合わせる場合は
      // インデックスが必要になるため、クライアントサイドでフィルタリング
    }

    const notificationsSnap = await getDocs(notificationsQuery);
    let notifications = notificationsSnap.docs.map(docu => ({
      id: docu.id,
      ...docu.data()
    }));

    // クライアントサイドフィルタリング
    const now = new Date();
    notifications = notifications.filter(notification => {
      // 期限切れチェック
      if (!includeExpired && notification.expiresAt && notification.expiresAt.toDate() < now) {
        return false;
      }

      // 未読のみフィルタ
      if (unreadOnly && notification.read) {
        return false;
      }

      // カテゴリフィルタ
      if (category && notification.metadata?.category !== category) {
        return false;
      }

      return true;
    });

    // 制限数でカット
    if (limit) {
      notifications = notifications.slice(0, limit);
    }

    console.log(`通知取得: ${notifications.length}件 (ユーザー: ${userId})`);
    
    return notifications;
  } catch (error) {
    console.error("通知取得エラー:", error);
    return [];
  }
};

/**
 * 通知をリアルタイム監視（堅牢なエラーハンドリング版）
 */
export const watchNotifications = (userId, callback, options = {}) => {
  const maxRetries = options.maxRetries || 5;
  const baseDelay = options.baseDelay || 1000;
  let retryCount = 0;
  let unsubscribe = null;
  let isActive = true;

  const createListener = () => {
    if (!isActive) return () => {}; // 既に非アクティブの場合は何もしない

    try {
      const notificationsQuery = query(
        collection(db, "users", userId, "notifications"),
        orderBy("createdAt", "desc")
      );

      unsubscribe = onSnapshot(notificationsQuery, 
        (snapshot) => {
          try {
            if (!isActive) return; // 非アクティブなら処理しない

            const notifications = snapshot.docs.map(docu => ({
              id: docu.id,
              ...docu.data()
            }));

            // 期限切れ通知を除外
            const now = new Date();
            const validNotifications = notifications.filter(notification => {
              return !notification.expiresAt || notification.expiresAt.toDate() > now;
            });

            console.log(`リアルタイム通知更新: ${validNotifications.length}件`);
            retryCount = 0; // 成功時はリトライカウントをリセット
            if (callback && isActive) callback(validNotifications);
          } catch (dataError) {
            console.error("通知データ処理エラー:", dataError);
            if (callback && isActive) callback([]);
          }
        },
        (error) => {
          if (!isActive) return; // 非アクティブなら処理しない

          console.error(`通知監視エラー (試行 ${retryCount + 1}/${maxRetries}):`, {
            code: error.code,
            message: error.message,
            name: error.name
          });
          
          // エラータイプを詳細に分類
          const isRetriableError = (
            error.code === 'unavailable' || 
            error.code === 'permission-denied' ||
            error.code === 'cancelled' ||
            error.code === 'deadline-exceeded' ||
            error.message.includes('network') ||
            error.message.includes('QUIC') ||
            error.message.includes('NAME_NOT_RESOLVED') ||
            error.message.includes('NETWORK_CHANGED') ||
            error.message.includes('WebChannelConnection') ||
            error.message.includes('transport errored')
          );

          // 非リトライ対象エラー（Target ID競合など）
          const isNonRetriableError = (
            error.code === 'already-exists' ||
            error.message.includes('Target ID already exists') ||
            error.code === 'invalid-argument' ||
            error.code === 'failed-precondition'
          );

          if (isNonRetriableError) {
            console.warn("非リトライ対象エラーのため監視を停止:", {
              code: error.code,
              message: error.message
            });
            if (callback && isActive) callback([]);
            return;
          }

          if (retryCount < maxRetries && isRetriableError) {
            retryCount++;
            // 指数バックオフ + ジッター
            const jitter = Math.random() * 1000;
            const retryDelay = Math.min(baseDelay * Math.pow(2, retryCount) + jitter, 30000);
            
            console.log(`${Math.round(retryDelay)}ms後にリトライします... (${retryCount}/${maxRetries})`);

            setTimeout(() => {
              if (!isActive) return;
              
              if (unsubscribe) {
                try {
                  unsubscribe();
                } catch (e) {
                  console.warn("前のリスナー解除エラー:", e);
                }
                unsubscribe = null; // 明示的にnullに設定
              }
              
              // 少し待ってからリスナーを再作成
              setTimeout(() => {
                if (isActive) createListener();
              }, 100);
            }, retryDelay);
          } else {
            // リトライ回数超過または致命的エラー
            console.error("通知監視を停止します:", {
              finalError: error,
              retryCount,
              maxRetries
            });
            if (callback && isActive) callback([]);
          }
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("通知監視開始エラー:", error);
      
      // 初期化エラーでもリトライを試行
      if (retryCount < maxRetries && isActive) {
        retryCount++;
        const retryDelay = baseDelay * retryCount;
        console.log(`初期化エラーのため${retryDelay}ms後にリトライします...`);
        
        setTimeout(() => {
          if (isActive) createListener();
        }, retryDelay);
      }
      
      return () => {}; // 空の関数を返す
    }
  };

  // リスナーを開始
  createListener();
  
  // カスタムクリーンアップ関数を返す
  return () => {
    isActive = false;
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("リスナー解除エラー:", error);
      }
      unsubscribe = null;
    }
  };
};

/**
 * 通知を既読にする
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    const notificationRef = doc(db, "users", userId, "notifications", notificationId);
    
    // ドキュメントの存在確認
    const notificationDoc = await getDoc(notificationRef);
    if (!notificationDoc.exists()) {
      console.log(`通知が見つかりません: ${notificationId}`);
      return { success: false, message: "通知が見つかりません" };
    }

    await updateDoc(notificationRef, {
      read: true,
      readAt: new Date()
    });

    console.log(`通知既読: ${notificationId}`);
    return { success: true };
  } catch (error) {
    console.error("通知既読エラー:", error);
    // エラーを投げずに失敗を返す
    return { success: false, error: error.message };
  }
};

/**
 * 期限切れ通知の削除
 */
export const cleanupExpiredNotifications = async (userId) => {
  try {
    const now = new Date();
    const notificationsSnap = await getDocs(query(
      collection(db, "users", userId, "notifications"),
      where("expiresAt", "<", now)
    ));

    const deletePromises = [];
    notificationsSnap.forEach(docu => deletePromises.push(deleteDoc(docu.ref)));
    
    await Promise.all(deletePromises);
    
    console.log(`期限切れ通知削除: ${notificationsSnap.size}件`);
    return { success: true, deletedCount: notificationsSnap.size };
  } catch (error) {
    console.error("期限切れ通知削除エラー:", error);
    throw error;
  }
};

/**
 * 通知を削除する
 */
export const clearNotification = async (userId, notificationId) => {
  try {
    const notificationRef = doc(db, "users", userId, "notifications", notificationId);
    
    // ドキュメントの存在確認
    const notificationDoc = await getDoc(notificationRef);
    if (!notificationDoc.exists()) {
      console.log(`削除対象の通知が見つかりません: ${notificationId}`);
      return { success: false, message: "通知が見つかりません" };
    }

    await deleteDoc(notificationRef);
    console.log("通知削除完了:", notificationId);
    return { success: true };
  } catch (error) {
    console.error("通知削除エラー:", error);
    // エラーを投げずに失敗を返す
    return { success: false, error: error.message };
  }
};
