import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import GoogleMap from "./GoogleMap";
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  AppBar,
  Toolbar,
  Avatar,
  Fade,
  Card,
  CardContent,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Badge,
  Chip
} from "@mui/material";
import {
  Logout,
  Person,
  RateReview,
  Restaurant,
  Notifications,
  FollowTheSigns,
  Cancel,
  CheckCircle,
  Pending
} from "@mui/icons-material";
import {
  searchUsersByDisplayName,
  getUserReviewsIfMutual
} from "../utils/firebaseTest";
import * as notificationSystem from "../utils/notificationSystem";

function Home() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState(null);
  const [userDisplayName, setUserDisplayName] = useState("");
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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationWatcher = useRef(null);

  useEffect(() => {
    // 認証状態の変化を監視
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        
        // 初回通知読み込み
        notificationSystem.getNotifications(user.uid, { unreadOnly: false, limit: 20 })
          .then(notifs => {
            setNotifications(notifs);
            const unread = notifs.filter(n => !n.read).length;
            setUnreadCount(unread);
          });

        // 既存のリスナーがあれば先にクリーンアップ
        if (notificationWatcher.current) {
          try {
            notificationWatcher.current();
            notificationWatcher.current = null;
          } catch (error) {
            console.warn("既存リスナーのクリーンアップエラー:", error);
          }
        }

        // 少し待ってからリアルタイム通知監視を開始（Target ID競合回避）
        setTimeout(() => {
          const unsubscribe = notificationSystem.watchNotifications(
            user.uid,
            (notifs) => {
              setNotifications(notifs);
              const unread = notifs.filter(n => !n.read).length;
              setUnreadCount(unread);
            },
            {
              maxRetries: 5, // 最大5回リトライ
              baseDelay: 1000 // 基本遅延1秒
            }
          );
          notificationWatcher.current = unsubscribe;
        }, 500); // 500ms遅延でTarget ID競合を回避

        // 期限切れ通知の削除（起動時に一度実行）
        notificationSystem.cleanupExpiredNotifications(user.uid);
        
        // ユーザーのディスプレイネームを取得
        const fetchUserDisplayName = async () => {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              setUserDisplayName(userDoc.data().displayName || "");
            }
          } catch (error) {
            console.error("Error fetching user display name:", error);
          }
        };
        fetchUserDisplayName();
      } else {
        // ユーザーがログアウトした場合のクリーンアップ
        setCurrentUserId("");
        setNotifications([]);
        setUnreadCount(0);
        setUserDisplayName("");
        if (notificationWatcher.current) {
          notificationWatcher.current();
          notificationWatcher.current = null;
        }
      }
    });
    
    // クリーンアップ関数
    return () => {
      authUnsubscribe(); // 認証状態リスナーを解除
      if (notificationWatcher.current) {
        notificationWatcher.current();
        notificationWatcher.current = null;
      }
    };
  }, []); // 空の依存配列でコンポーネントマウント時のみ実行

  // 検索
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    
    try {
      // ユーザー検索のみ（displayNameで部分一致）
      const users = await searchUsersByDisplayName(searchText);
      setSearchResults(users);
    } catch (error) {
      console.error("検索エラー:", error);
    }
  };

  // ユーザー選択時
  const handleUserSelect = async (user) => {
    try {
      setProfile(user);
      const status = await notificationSystem.getDetailedFollowStatus(currentUserId, user.id);
      setFollowStatus(status);
      
      if (status.isMutual) {
        const reviews = await getUserReviewsIfMutual(currentUserId, user.id);
        setReviews(reviews);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error("ユーザー選択エラー:", error);
    }
  };

  // フォローアクション（新しい統合システム）
  const handleFollowAction = async (userId) => {
    try {
      const result = await notificationSystem.handleFollowAction(currentUserId, userId);
      
      // フォロー状態を更新
      const newStatus = await notificationSystem.getDetailedFollowStatus(currentUserId, userId);
      setFollowStatus(newStatus);
      
      // 成功メッセージを表示
      alert(result.message);

      // 相互フォローが成立した場合、レビューを取得
      if (newStatus.isMutual) {
        const reviews = await getUserReviewsIfMutual(currentUserId, userId);
        setReviews(reviews);
      }
    } catch (error) {
      console.error("フォローアクションエラー:", error);
      alert(error.message || "フォロー処理に失敗しました");
    }
  };

  // フォロー解除
  const handleUnfollow = async (userId) => {
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

  // 通知クリア
  const handleClearNotification = async (notificationId) => {
    if (!auth.currentUser) return;
    
    try {
      const result = await notificationSystem.clearNotification(auth.currentUser.uid, notificationId);
      if (!result.success) {
        console.log("通知の削除をスキップしました:", result.message);
      }
    } catch (error) {
      console.error("Error clearing notification:", error);
    }
  };

  // 通知を既読にする
  const handleMarkAsRead = async (notificationId) => {
    if (!auth.currentUser) return;
    
    try {
      const result = await notificationSystem.markNotificationAsRead(auth.currentUser.uid, notificationId);
      if (!result.success) {
        console.log("通知の既読化をスキップしました:", result.message);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // 通知からフォロー承認
  const handleAcceptFollowFromNotification = async (fromUserId, notificationId) => {
    if (!auth.currentUser) return;
    
    try {
      await notificationSystem.acceptFollowRequest(auth.currentUser.uid, fromUserId);
      await handleMarkAsRead(notificationId);
    } catch (error) {
      console.error("Error accepting follow from notification:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const myprofile = () => {
    navigate("/editprofile");
  };

  const reviewpost = () => {
    navigate("/reviewpost");
  };

  return (
    <Box sx={{ minHeight: '50vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* ヘッダー */}
      <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)' }}>
        <Toolbar>
          <Avatar sx={{ mr: 2, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
            <Restaurant />
          </Avatar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            GochiSpace
          </Typography>
          {userDisplayName && (
            <Typography variant="body1" sx={{ mr: 2, fontWeight: 'medium' }}>
              こんにちは、{userDisplayName}さん
            </Typography>
          )}
          <IconButton 
            color="inherit" 
            onClick={() => {
              setShowNotifications(!showNotifications);
              // 通知パネルを開いた時に期限切れ通知をクリーンアップ
              if (!showNotifications) {
                notificationSystem.cleanupExpiredNotifications(currentUserId);
              }
            }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>
          <Button color="inherit" onClick={logout} startIcon={<Logout />}>
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      {/* ユーザー検索 */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3, color: 'white', fontWeight: 'bold' }}>
          ユーザー検索
        </Typography>
        <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
          <TextField
            label="ユーザー名を入力"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="displayNameまたはemail@example.com"
            sx={{ width: 400, mr: 2, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 1 }}
          />
          <Button variant="contained" onClick={handleSearch} size="large">
            検索
          </Button>
        </Box>

        {/* ユーザー検索結果表示 */}
        {searchResults.length > 0 && (
          <Card sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                検索結果 ({searchResults.length}件)
              </Typography>
              <List>
                {searchResults.map(user => (
                  <ListItem key={user.id} disablePadding>
                    <ListItemButton onClick={() => handleUserSelect(user)}>
                      <ListItemText 
                        primary={user.displayName || user.id} 
                        secondary={user.email}
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
            <Typography>ユーザーID: {profile.id}</Typography>
            <Typography>表示名: {profile.displayName || "未設定"}</Typography>
            <Typography>メール: {profile.email}</Typography>
            <Typography>好み: {profile.preference && profile.preference.join(", ")}</Typography>
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
                      <>
                        <Typography>評価: {review.rating}</Typography>
                        <Typography>コメント: {review.comment}</Typography>
                        <Typography>投稿日時: {review.createdAt}</Typography>
                        <Typography>ユーザー: {review.userId}</Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        )}

        {/* 通知パネル */}
        {showNotifications && (
          <Card sx={{ mb: 2, maxHeight: 400, overflow: 'auto' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                通知 ({unreadCount > 0 ? `${unreadCount}件未読` : '未読なし'})
              </Typography>
              {notifications.length === 0 ? (
                <Typography color="text.secondary">通知はありません</Typography>
              ) : (
                <List dense>
                  {notifications.map((notification) => (
                    <ListItem 
                      key={notification.id} 
                      sx={{ 
                        bgcolor: notification.read ? 'transparent' : 'action.hover',
                        borderRadius: 1,
                        mb: 1,
                        border: notification.read ? 'none' : '1px solid',
                        borderColor: 'primary.light'
                      }}
                    >
                      <Box sx={{ flexGrow: 1 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">
                                {notification.message}
                              </Typography>
                              {notification.metadata?.celebratory && <CheckCircle color="success" />}
                              {notification.metadata?.actionRequired && <Pending color="warning" />}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {notification.fromUserDisplayName && `送信者: ${notification.fromUserDisplayName}`}
                              </Typography>
                              <br />
                              <Typography variant="caption" color="text.secondary">
                                {new Date(notification.createdAt?.toDate()).toLocaleString()}
                              </Typography>
                              {notification.metadata?.category && (
                                <Chip 
                                  label={notification.metadata.category} 
                                  size="small" 
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Box>
                          }
                        />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {notification.type === "follow_request" && (
                          <Button 
                            variant="contained" 
                            size="small"
                            onClick={() => handleAcceptFollowFromNotification(notification.fromUserId, notification.id)}
                            sx={{ minWidth: 80 }}
                          >
                            承認
                          </Button>
                        )}
                        {!notification.read && (
                          <Button 
                            variant="outlined" 
                            size="small"
                            onClick={() => handleMarkAsRead(notification.id)}
                            sx={{ minWidth: 80 }}
                          >
                            既読
                          </Button>
                        )}
                        <Button 
                          variant="text" 
                          size="small"
                          color="error"
                          onClick={() => handleClearNotification(notification.id)}
                          sx={{ minWidth: 80 }}
                        >
                          削除
                        </Button>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}        {/* Google Map & アクションボタン */}
        <Fade in={true} timeout={1000}>
          <Box>
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
                  レビューマップ
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                  投稿されたレビューを地図上で確認できます。フィルター機能でカテゴリーや投稿者で絞り込めます。
                </Typography>
                <GoogleMap />
              </CardContent>
            </Card>

            {/* アクションボタン */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={myprofile}
                startIcon={<Person />}
                sx={{
                  borderRadius: 3,
                  py: 2,
                  px: 4,
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                  minWidth: 200,
                  '&:hover': {
                    background: 'linear-gradient(45deg, #2196F3 60%, #21CBF3 100%)',
                  }
                }}
              >
                マイプロフィール
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={reviewpost}
                startIcon={<RateReview />}
                sx={{
                  borderRadius: 3,
                  py: 2,
                  px: 4,
                  background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                  boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
                  minWidth: 200,
                  '&:hover': {
                    background: 'linear-gradient(45deg, #4CAF50 60%, #8BC34A 100%)',
                  }
                }}
              >
                レビュー投稿
              </Button>
            </Stack>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}

export default Home;
