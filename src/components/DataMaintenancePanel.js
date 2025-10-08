/**
 * データベースメンテナンス用ユーティリティ
 * データ整合性チェックと修復機能
 */

import React, { useState } from 'react';
import { 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  LinearProgress,
  Alert,
  Chip
} from '@mui/material';
import { 
  performDataIntegrityCheck, 
  getAllReviewsForRestaurant,
  calculateRestaurantStats 
} from '../utils/dataSync';

function DataMaintenancePanel() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleIntegrityCheck = async () => {
    setChecking(true);
    setError(null);
    setResult(null);

    try {
      const checkResult = await performDataIntegrityCheck();
      setResult(checkResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 600, margin: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🔧 データベースメンテナンス
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          データの整合性をチェックし、必要に応じて修復します。
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleIntegrityCheck}
            disabled={checking}
            fullWidth
          >
            {checking ? 'チェック中...' : 'データ整合性チェック実行'}
          </Button>
        </Box>

        {checking && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              データベースを解析しています...
            </Typography>
          </Box>
        )}

        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ✅ データ整合性チェック完了
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Chip 
                label={`${result.processed}件のデータを修正`} 
                color="primary" 
                size="small" 
              />
            </Box>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            ❌ エラーが発生しました: {error}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary">
          ⚠️ このツールは管理者のみが使用してください。
          大量のデータがある場合、処理に時間がかかる可能性があります。
        </Typography>
      </CardContent>
    </Card>
  );
}

export default DataMaintenancePanel;
