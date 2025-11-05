import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  AppBar,
  Toolbar,
  Avatar,
  Fade,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Stack
} from "@mui/material";
import {
  ArrowBack,
  Search,
  Person,
  FollowTheSigns,
  Cancel
} from "@mui/icons-material";
import {
  searchUsersByUserId,
  getUserReviewsIfMutual
} from "../utils/firebaseTest";
import * as notificationSystem from "../utils/notificationSystem";
import Footer from "./Footer";
import FollowExchangeUserList from "./followExchangeUserList";

function UserIdSearch() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  
  // 検索関連の状態
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // プロフィール関連の状態
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [followStatus, setFollowStatus] = useState({
    iFollowThem: false,
    theyFollowMe: false,
    isMutual: false,
    myFollowStatus: "none",
    theirFollowStatus: "none",
    action: "send_request",
    buttonText: "フォローする",
    description: ""
  });

  // 現在のユーザーIDを設定
  useEffect(() => {
    if (user) {
      setCurrentUserId(user.uid);
    }
  }, [user]);

  // ユーザー検索
  const handleSearch = async () => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      // ユーザー検索（userIdで部分一致）
      const users = await searchUsersByUserId(searchText);
      setSearchResults(users);
    } catch (error) {
      console.error("検索エラー:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ユーザー選択時
  const handleUserSelect = async (selectedUser) => {
    if (!currentUserId) {
      console.error("ユーザーがログインしていません");
      return;
    }

    try {
      setProfile(selectedUser);
      
      // フォロー状態を取得
      const status = await notificationSystem.getDetailedFollowStatus(currentUserId, selectedUser.id);
      setFollowStatus(status);
      
      // 相互フォローの場合はレビューも取得
      if (status.isMutual) {
        const userReviews = await getUserReviewsIfMutual(currentUserId, selectedUser.id);
        setReviews(userReviews);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error("ユーザー選択エラー:", error);
    }
  };

  // フォローアクション（新しい統合システム）
  const handleFollowAction = async (userId) => {
    if (!currentUserId) {
      alert("ログインが必要です");
      return;
    }

    try {
      const result = await notificationSystem.handleFollowAction(currentUserId, userId);
      
      // フォロー状態を更新
      const newStatus = await notificationSystem.getDetailedFollowStatus(currentUserId, userId);
      setFollowStatus(newStatus);
      
      // 成功メッセージを表示
      alert(result.message);

      // 相互フォローが成立した場合、レビューを取得
      if (newStatus.isMutual) {
        const userReviews = await getUserReviewsIfMutual(currentUserId, userId);
        setReviews(userReviews);
      }
    } catch (error) {
      console.error("フォローアクションエラー:", error);
      alert(error.message || "フォロー処理に失敗しました");
    }
  };

  // フォロー解除
  const handleUnfollow = async (userId) => {
    if (!currentUserId) {
      alert("ログインが必要です");
      return;
    }

    try {
      const result = await notificationSystem.unfollowUser(currentUserId, userId);
      const newStatus = await notificationSystem.getDetailedFollowStatus(currentUserId, userId);
      setFollowStatus(newStatus);
      setReviews([]); // レビューも非表示
      alert(result.message);
    } catch (error) {
      console.error("フォロー解除エラー:", error);
      alert("フォロー解除に失敗しました");
    }
  };

  // Enterキーでの検索
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* ヘッダー */}
      <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Avatar sx={{ mr: 2, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
            <Person />
          </Avatar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            ユーザー検索
          </Typography>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Fade in={true} timeout={1000}>
          <Box>
            {/* 相互フォローユーザー一覧ボタン */}
            <FollowExchangeUserList onUserSelect={handleUserSelect} />
            {/* 検索フォーム */}
            <Card
              elevation={12}
              sx={{
                borderRadius: 4,
                mb: 4,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom color="primary" fontWeight="bold" textAlign="center">
                  ユーザー検索
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                  ユーザー名で検索してフォローしましょう
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="ユーザーIDを入力"
                    fullWidth
                    sx={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                      borderRadius: 1,
                      '& .MuiOutlinedInput-root': { borderRadius: 2 }
                    }}
                  />
                  <Button 
                    variant="contained" 
                    onClick={handleSearch} 
                    size="large"
                    disabled={isSearching || !searchText.trim()}
                    startIcon={<Search />}
                    sx={{
                      borderRadius: 2,
                      minWidth: 120,
                      background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #4CAF50 60%, #8BC34A 100%)',
                      }
                    }}
                  >
                    {isSearching ? "検索中..." : "検索"}
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* ユーザー検索結果表示 */}
            {searchResults.length > 0 && (
              <Card sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    検索結果 ({searchResults.length}件)
                  </Typography>
                  <List>
                    {searchResults.map(searchUser => (
                      <ListItem key={searchUser.id} disablePadding>
                        <ListItemButton onClick={() => handleUserSelect(searchUser)}>
                          <ListItemText 
                            primary={searchUser.displayName || searchUser.id} 
                            secondary={searchUser.userId}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* プロフィール表示・フォロー/解除 */}
            {profile && (
              <Card sx={{ my: 2, p: 2 }}>
                <Typography variant="h6">プロフィール</Typography>
                <Typography>ユーザーID: {profile.userId || profile.id}</Typography>
                <Typography>表示名: {profile.displayName || "未設定"}</Typography>
                <Typography>好み: {profile.preferences && profile.preferences.join(", ")}</Typography>
                <Box sx={{ mt: 2 }}>
                  {currentUserId === profile.id ? (
                    <Typography color="text.secondary">自分のプロフィールです</Typography>
                  ) : followStatus.isMutual ? (
                    <Button 
                      variant="outlined" 
                      color="error" 
                      startIcon={<Cancel />} 
                      onClick={() => handleUnfollow(profile.id)}
                    >
                      フォロー解除
                    </Button>
                  ) : followStatus.iFollowThem ? (
                    <Button variant="outlined" disabled>
                      フォローリクエスト送信済み
                    </Button>
                  ) : (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      startIcon={<FollowTheSigns />} 
                      onClick={() => handleFollowAction(profile.id)}
                    >
                      フォロー
                    </Button>
                  )}
                  
                  {followStatus.isMutual && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      ✓ 相互フォロー中
                    </Typography>
                  )}
                </Box>
              </Card>
            )}

            {/* レビュー表示 */}
            {reviews.length > 0 && (
              <Card sx={{ my: 2, p: 2 }}>
                <Typography variant="h6">レビュー一覧</Typography>
                <List>
                  {reviews.map((review, idx) => (
                    <ListItem key={idx} divider>
                      <ListItemText
                        primary={review.name || review.restaurantId || "店舗"}
                        secondary={
                          <Stack spacing={1}>
                            <Typography>評価: {review.rating}</Typography>
                            <Typography>コメント: {review.comment}</Typography>
                            <Typography>投稿日時: {review.createdAt}</Typography>
                            <Typography>ユーザー: {review.userId}</Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Card>
            )}

            {/* 検索結果なしの場合 */}
            {searchText && searchResults.length === 0 && !isSearching && (
              <Card sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Typography variant="h6" color="text.secondary">
                    検索結果が見つかりませんでした
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    別のキーワードで検索してみてください
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        </Fade>
      </Container>
      
      {/* フッター用のスペーサー */}
      <Box sx={{ height: 80 }} />
      
      {/* フッター */}
      <Footer />
    </Box>
  );
}

export default UserIdSearch;