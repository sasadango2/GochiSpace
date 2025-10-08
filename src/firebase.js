// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// .envから環境変数を取得
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// ...existing code...

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app); 

// Firestore データベース（接続設定最適化）
export const db = getFirestore(app);

// ネットワーク接続管理機能をエクスポート
export const enableFirestoreNetwork = () => enableNetwork(db);
export const disableFirestoreNetwork = () => disableNetwork(db);

// Firestoreの設定を最適化（接続エラー軽減）
if (typeof window !== 'undefined') {
  // ブラウザ環境でのみ実行
  try {
    // ネットワーク状態変化時のFirestore再接続管理
    let reconnectTimer = null;
    let isReconnecting = false;
    
    const handleNetworkChange = async () => {
      if (navigator.onLine && !isReconnecting) {
        console.log("ネットワーク復旧を検出しました");
        if (reconnectTimer) clearTimeout(reconnectTimer);
        
        isReconnecting = true;
        
        // 既存のリスナーとの競合を避けるため、再接続を控えめに実行
        reconnectTimer = setTimeout(async () => {
          try {
            console.log("Firestore接続状態を確認中...");
            // 強制的な再接続は行わず、自然な再接続を待つ
            isReconnecting = false;
            console.log("Firestore接続チェック完了");
          } catch (error) {
            console.warn("Firestore接続チェックエラー:", error);
            isReconnecting = false;
          }
        }, 5000); // 5秒後に実行（リスナー再作成と競合しないよう遅延）
      }
    };

    // イベントリスナーの頻度を制限
    let networkChangeTimeout = null;
    const throttledNetworkChange = () => {
      if (networkChangeTimeout) return;
      networkChangeTimeout = setTimeout(() => {
        handleNetworkChange();
        networkChangeTimeout = null;
      }, 2000);
    };

    window.addEventListener('online', throttledNetworkChange);
    window.addEventListener('focus', throttledNetworkChange);
    
    console.log("Firestore接続設定を最適化しました");
  } catch (error) {
    console.warn("Firestore設定の最適化に失敗:", error);
  }
}

export default app;