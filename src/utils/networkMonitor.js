/**
 * ネットワーク接続監視ユーティリティ
 * Firestoreの接続エラーを軽減するためのネットワーク状態管理
 */
import React from 'react';

class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.init();
  }

  init() {
    // オンライン/オフライン状態の監視
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // ページの可視性変化を監視（バックグラウンド復帰時の接続チェック）
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  handleOnline() {
    console.log('ネットワーク接続が復旧しました');
    this.isOnline = true;
    this.notifyListeners('online');
  }

  handleOffline() {
    console.log('ネットワーク接続が切断されました');
    this.isOnline = false;
    this.notifyListeners('offline');
  }

  handleVisibilityChange() {
    if (!document.hidden && navigator.onLine) {
      // ページが表示状態になり、オンラインの場合
      console.log('ページが表示状態になりました - 接続状態をチェック');
      this.checkConnection();
    }
  }

  async checkConnection() {
    try {
      // 簡単な接続テスト
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors'
      });
      if (this.isOnline !== true) {
        this.isOnline = true;
        this.notifyListeners('reconnected');
      }
    } catch (error) {
      if (this.isOnline !== false) {
        this.isOnline = false;
        this.notifyListeners('connection-lost');
      }
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event, this.isOnline);
      } catch (error) {
        console.error('Network listener error:', error);
      }
    });
  }

  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      effectiveType: navigator.connection?.effectiveType || 'unknown',
      downlink: navigator.connection?.downlink || 0,
      rtt: navigator.connection?.rtt || 0
    };
  }
}

// シングルトンインスタンス
const networkMonitor = new NetworkMonitor();

export default networkMonitor;

/**
 * ネットワーク状態変化を監視するReactフック
 */
export const useNetworkStatus = (callback) => {
  React.useEffect(() => {
    const removeListener = networkMonitor.addListener(callback);
    return removeListener;
  }, [callback]);

  return networkMonitor.getConnectionStatus();
};
