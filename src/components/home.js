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
  AppBar,
  Toolbar,
  Avatar,
  Fade,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Badge,
  Chip
} from "@mui/material";
import {
  Logout,
  Restaurant,
  Notifications,
  CheckCircle,
  Pending
} from "@mui/icons-material";
import * as notificationSystem from "../utils/notificationSystem";
import Footer from "./Footer";

function Home() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
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
        const fetchDisplayName = async () => {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              setDisplayName(userDoc.data().displayName || "");
            }
          } catch (error) {
            console.error("Error fetching user display name:", error);
          }
        };
        fetchDisplayName();
      } else {
        // ユーザーがログアウトした場合のクリーンアップ
        setCurrentUserId("");
        setNotifications([]);
        setUnreadCount(0);
        setDisplayName("");
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

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ヘッダー - 固定 */}
      <AppBar 
        position="fixed" 
        sx={{ 
          background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
          zIndex: 1100 
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <Avatar sx={{ 
            mr: { xs: 1, sm: 2 }, 
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            width: { xs: 32, sm: 40 },
            height: { xs: 32, sm: 40 }
          }}>
            <Restaurant fontSize="small" />
          </Avatar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 'bold',
              fontSize: { xs: '1.1rem', sm: '1.25rem' }
            }}
          >
            GochiSpace
          </Typography>
          {displayName && (
            <Typography 
              variant="body2" 
              sx={{ 
                mr: { xs: 1, sm: 2 }, 
                fontWeight: 'medium',
                display: { xs: 'none', sm: 'block' }
              }}
            >
              {displayName}
            </Typography>
          )}
          <IconButton 
            color="inherit" 
            size="small"
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                notificationSystem.cleanupExpiredNotifications(currentUserId);
              }
            }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <Notifications fontSize="small" />
            </Badge>
          </IconButton>
          <IconButton color="inherit" onClick={logout} size="small">
            <Logout fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ - スクロール可能 */}
      <Box sx={{ 
        flex: 1,
        mt: { xs: '56px', sm: '64px' }, // ヘッダーの高さ分の余白
        mb: { xs: '64px', sm: '70px' }, // フッターの高さ分の余白
        overflow: 'auto'
      }}>
        <Container 
          maxWidth="sm" 
          sx={{ 
            px: { xs: 0.5, sm: 2 },
            py: { xs: 0.5, sm: 2 }
          }}
        >

        {/* 通知パネル - モバイル対応 */}
        {showNotifications && (
          <Card sx={{ 
            mb: { xs: 1, sm: 2 }, 
            maxHeight: { xs: 300, sm: 400 }, 
            overflow: 'auto',
            mx: { xs: 0, sm: 'auto' }
          }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
              >
                通知 ({unreadCount > 0 ? `${unreadCount}件未読` : '未読なし'})
              </Typography>
              {notifications.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                  通知はありません
                </Typography>
              ) : (
                <List 
                  dense 
                  sx={{ 
                    p: 0,
                    '& .MuiListItem-root': {
                      px: { xs: 1, sm: 2 },
                      py: { xs: 0.5, sm: 1 }
                    }
                  }}
                >
                  {notifications.map((notification) => (
                    <ListItem 
                      key={notification.id} 
                      sx={{ 
                        bgcolor: notification.read ? 'transparent' : 'action.hover',
                        borderRadius: 1,
                        mb: { xs: 0.5, sm: 1 },
                        border: notification.read ? 'none' : '1px solid',
                        borderColor: 'primary.light',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'flex-start' }
                      }}
                    >
                      <Box sx={{ 
                        flexGrow: 1,
                        mb: { xs: 1, sm: 0 },
                        mr: { xs: 0, sm: 1 }
                      }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography 
                                variant="body2"
                                sx={{
                                  fontSize: { xs: '0.875rem', sm: '1rem' },
                                  lineHeight: { xs: 1.3, sm: 1.5 }
                                }}
                              >
                                {notification.message}
                              </Typography>
                              {notification.metadata?.celebratory && <CheckCircle color="success" fontSize="small" />}
                              {notification.metadata?.actionRequired && <Pending color="warning" fontSize="small" />}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: { xs: 0.5, sm: 1 } }}>
                              <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {notification.fromDisplayName && `送信者: ${notification.fromDisplayName}`}
                              </Typography>
                              <br />
                              <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {new Date(notification.createdAt?.toDate()).toLocaleString()}
                              </Typography>
                              {notification.metadata?.category && (
                                <Chip 
                                  label={notification.metadata.category} 
                                  size="small" 
                                  sx={{ 
                                    ml: { xs: 0, sm: 1 },
                                    mt: { xs: 0.5, sm: 0 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                  }}
                                />
                              )}
                            </Box>
                          }
                        />
                      </Box>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: { xs: 'row', sm: 'column' }, 
                        gap: { xs: 1, sm: 1 },
                        justifyContent: { xs: 'space-around', sm: 'flex-start' }
                      }}>
                        {notification.type === "follow_request" && (
                          <Button 
                            variant="contained" 
                            size="small"
                            onClick={() => handleAcceptFollowFromNotification(notification.fromUserId, notification.id)}
                            sx={{ 
                              minWidth: { xs: 60, sm: 80 },
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              py: { xs: 0.25, sm: 0.5 }
                            }}
                          >
                            承認
                          </Button>
                        )}
                        {!notification.read && (
                          <Button 
                            variant="outlined" 
                            size="small"
                            onClick={() => handleMarkAsRead(notification.id)}
                            sx={{ 
                              minWidth: { xs: 60, sm: 80 },
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              py: { xs: 0.25, sm: 0.5 }
                            }}
                          >
                            既読
                          </Button>
                        )}
                        <Button 
                          variant="text" 
                          size="small"
                          color="error"
                          onClick={() => handleClearNotification(notification.id)}
                          sx={{ 
                            minWidth: { xs: 60, sm: 80 },
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            py: { xs: 0.25, sm: 0.5 }
                          }}
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
        )}
        
        {/* Google Map & アクションボタン */}
        <Fade in={true} timeout={1000}>
          <Box>
            <Card
              elevation={12}
              sx={{
                borderRadius: { xs: 2, sm: 4 },
                mb: { xs: 0.5, sm: 1 },
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <CardContent sx={{ 
                p: { xs: 0.25, sm: 1 },
                '&:last-child': {
                  pb: { xs: 0.25, sm: 1 }
                }
              }}>
                {/* <Typography 
                  variant="h5" 
                  gutterBottom 
                  color="primary" 
                  fontWeight="bold" 
                  textAlign="center"
                  sx={{
                    fontSize: { xs: '1.1rem', sm: '1.5rem' },
                    mb: { xs: 0.5, sm: 1 }
                  }}
                >
                  レビューマップ
                </Typography> */}
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  textAlign="center" 
                  sx={{ 
                    mb: { xs: 0.5, sm: 1 },
                    fontSize: { xs: '0.7rem', sm: '0.85rem' },
                    px: { xs: 0.25, sm: 0 }
                  }}
                >
                  投稿されたレビューを地図上で確認できます。
                </Typography>
                <Box sx={{
                  width: '100%',
                  height: { xs: 'calc(100vh - 160px)', sm: 'calc(100vh - 180px)' },
                  minHeight: { xs: 400, sm: 500 },
                  borderRadius: { xs: 1, sm: 2 },
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  '& > div': {
                    height: '100%',
                    borderRadius: { xs: 1, sm: 2 }
                  }
                }}>
                  <GoogleMap />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Fade>
        </Container>
      </Box>
      
      {/* フッター - 固定 */}
      <Footer />
    </Box>
  );
}

export default Home;
