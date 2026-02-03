// Firebase接続状況を確認するためのテストコンポーネント
import React, { useState, useEffect } from 'react';
import { 
  testFirebaseConnection, 
  checkAllCollections, 
  getDatabaseStats,
  watchReviews 
} from '../utils/firebaseTest';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';

function FirebaseTestPanel() {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [collections, setCollections] = useState(null);
  const [stats, setStats] = useState(null);
  const [liveReviews, setLiveReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Firebase接続テスト
  const testConnection = async () => {
    setLoading(true);
    try {
      const result = await testFirebaseConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ success: false, error: error.message });
    }
    setLoading(false);
  };

  // 全コレクション確認
  const checkCollections = async () => {
    setLoading(true);
    try {
      const result = await checkAllCollections();
      setCollections(result);
    } catch (error) {
      console.error("コレクション確認エラー:", error);
    }
    setLoading(false);
  };

  // 統計情報取得
  const getStats = async () => {
    setLoading(true);
    try {
      const result = await getDatabaseStats();
      setStats(result);
    } catch (error) {
      console.error("統計取得エラー:", error);
    }
    setLoading(false);
  };

  // リアルタイム監視開始
  const startWatching = () => {
    const unsubscribe = watchReviews((reviews) => {
      setLiveReviews(reviews);
    });
    
    // コンポーネントがアンマウントされたら監視停止
    return () => unsubscribe();
  };

  // 全テスト実行
  const runAllTests = async () => {
    await testConnection();
    await checkCollections();
    await getStats();
    startWatching();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom color="primary">
        🔍 Firebase接続テストパネル
      </Typography>
      
      <Grid container spacing={3}>
        {/* 操作ボタン */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              テスト実行
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="contained" 
                onClick={testConnection}
                disabled={loading}
              >
                接続テスト
              </Button>
              <Button 
                variant="contained" 
                onClick={checkCollections}
                disabled={loading}
              >
                コレクション確認
              </Button>
              <Button 
                variant="contained" 
                onClick={getStats}
                disabled={loading}
              >
                統計情報取得
              </Button>
              <Button 
                variant="contained" 
                onClick={runAllTests}
                disabled={loading}
                color="secondary"
              >
                全テスト実行
              </Button>
              {loading && <CircularProgress size={24} />}
            </Box>
          </Paper>
        </Grid>

        {/* 接続状況 */}
        {connectionStatus && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                🔗 接続状況
              </Typography>
              {connectionStatus.success ? (
                <Alert severity="success">
                  Firebase接続成功！
                  <br />
                  テストドキュメントID: {connectionStatus.testDocId}
                </Alert>
              ) : (
                <Alert severity="error">
                  接続エラー: {connectionStatus.error}
                </Alert>
              )}
            </Paper>
          </Grid>
        )}

        {/* コレクション情報 */}
        {collections && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                📁 コレクション情報
              </Typography>
              {Object.entries(collections).map(([name, info]) => (
                <Box key={name} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>{name}</strong>: {info.exists ? (
                      <span style={{ color: 'green' }}>
                        ✅ {info.count}件のドキュメント
                      </span>
                    ) : (
                      <span style={{ color: 'red' }}>
                        ❌ {info.error}
                      </span>
                    )}
                  </Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
        )}

        {/* 統計情報 */}
        {stats && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                📊 データベース統計
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="h4" color="primary">
                    {stats.userCount}
                  </Typography>
                  <Typography variant="body2">ユーザー数</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="h4" color="secondary">
                    {stats.reviewCount}
                  </Typography>
                  <Typography variant="body2">レビュー数</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="h4" color="success.main">
                    {stats.averageRating?.toFixed(1)}
                  </Typography>
                  <Typography variant="body2">平均評価</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="h4" color="warning.main">
                    {Object.keys(stats.categoryStats || {}).length}
                  </Typography>
                  <Typography variant="body2">カテゴリー数</Typography>
                </Grid>
              </Grid>

              {/* カテゴリー別統計 */}
              {stats.categoryStats && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    カテゴリー別レビュー数:
                  </Typography>
                  {Object.entries(stats.categoryStats).map(([category, count]) => (
                    <Typography key={category} variant="body2">
                      {category}: {count}件
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* リアルタイムレビュー */}
        {liveReviews.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                📝 最新レビュー（リアルタイム）
              </Typography>
              <List>
                {liveReviews.slice(0, 5).map((review, index) => (
                  <React.Fragment key={review.id}>
                    <ListItem>
                      <ListItemText
                        primary={review.restaurantName}
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              評価: {'★'.repeat(review.rating)} ({review.rating}/5)
                            </Typography>
                            <Typography variant="body2">
                              カテゴリー: {review.category}
                            </Typography>
                            <Typography variant="body2">
                              投稿者: {review.userEmail}
                            </Typography>
                            <Typography variant="caption">
                              {review.createdAt?.toDate?.()?.toLocaleString() || ''}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < Math.min(liveReviews.length, 5) - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default FirebaseTestPanel;
