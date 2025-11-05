import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  CircularProgress,
  Typography,
  
} from '@mui/material';
import { People } from '@mui/icons-material';
import { getMutualFollowUsers } from '../utils/mutualFollowReviews';
import { getUserProfile } from '../utils/firebaseTest';

/**
 * FollowExchangeUserList
 * - 表示: 相互フォローユーザーを取得して一覧表示する小コンポーネント
 * - props:
 *   - onUserSelect(userProfile) : ユーザー選択時に呼ばれる (optional)
 */
export default function FollowExchangeUserList({ onUserSelect }) {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 開いたときに読み込む
    if (open) {
      fetchMutualUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchMutualUsers = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const ids = await getMutualFollowUsers(user.uid);
      // ドキュメントIDの配列 -> 各プロファイルを取得
      const profiles = [];
      for (const id of ids) {
        try {
          const p = await getUserProfile(id);
          if (p) profiles.push({ id, ...p });
        } catch (e) {
          console.warn('プロフィール取得失敗', id, e);
        }
      }
      setUsers(profiles);
    } catch (err) {
      console.error('相互フォローユーザー取得エラー', err);
      setError('相互フォローユーザーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => setOpen(prev => !prev);

  const handleSelect = (profile) => {
    if (onUserSelect) {
      onUserSelect(profile);
    } else {
      // デフォルト動作: プロフィールページへ遷移（存在すれば）
      navigate(`/user/${profile.id}`);
    }
    // 閉じる
    setOpen(false);
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Button
        variant="contained"
        startIcon={<People />}
        onClick={handleToggle}
        sx={{ borderRadius: 2 }}
      >
        相互フォローユーザー
        {loading ? (
          <CircularProgress size={18} sx={{ ml: 1 }} />
        ) : null}
      </Button>

      {open && (
        <Card sx={{ mt: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              相互フォローユーザー一覧
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Typography color="error">{error}</Typography>
            ) : users.length === 0 ? (
              <Typography color="text.secondary">相互フォローのユーザーはいません</Typography>
            ) : (
              <List>
                {users.map(u => (
                  <ListItem key={u.id} button onClick={() => handleSelect(u)}>
                    <ListItemAvatar>
                      <Avatar src={u.photoURL || ''}>{(u.displayName || u.userId || '').charAt(0)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={u.displayName || u.userId || u.id}
                      secondary={u.userId ? `@${u.userId}` : u.email}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
