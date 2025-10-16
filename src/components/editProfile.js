import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc } from "firebase/firestore";
import { 
  updateUserProfile
} from "../utils/dataSync";
import { FOOD_CATEGORIES, MAX_CATEGORIES } from "../constants/categories";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  AppBar,
  Toolbar,
  Avatar,
  Fade,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import {
  ArrowBack,
  Person,
  Save,
  Preview
} from "@mui/icons-material";
import Footer from "./Footer";

function EditProfile() {
  const [user, loading] = useAuthState(auth);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [icon, setIcon] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [previewDialog, setPreviewDialog] = useState(false);
  const [updateImpact, setUpdateImpact] = useState(null);
  const navigate = useNavigate();

  const loadUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const displayName = userData.displayName || userData.userId || "";
        setUsername(displayName);
        setOriginalDisplayName(displayName);
        setSelectedCategories(userData.preferences || []);
        setIcon(userData.profileImage || null);
        setUserId(userData.userId || user.uid); // FirestoreからuserIdを取得
      }
    } catch (error) {
      console.error("プロフィール読み込みエラー:", error);
      setProfileError("プロフィール情報の読み込みに失敗しました。");
    }
  }, [user]);

  // ユーザー情報を読み込み
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  const handleCategoryChange = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== category));
    } else if (selectedCategories.length < MAX_CATEGORIES) {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  // displayName変更の影響をプレビュー
  const handlePreviewImpact = async () => {
    if (!user || username.trim() === originalDisplayName) {
      setProfileError("displayNameに変更がありません");
      return;
    }

    try {
      // Cloud Functions による自動同期なので詳細な事前チェックは不要
      setUpdateImpact({ 
        reviewsToUpdate: "自動計算", 
        restaurantsToUpdate: "自動更新",
        message: "Cloud Functions により関連データが自動同期されます",
        details: {
          userProfile: "自動計算",
          restaurantReviews: "自動計算", 
          postRestaurantInfo: "自動計算",
          reviews: "自動計算"
        }
      });
      setPreviewDialog(true);
    } catch (error) {
      setProfileError("プロフィール更新の準備中にエラーが発生しました");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setProfileError("ログインが必要です。");
      return;
    }
    
    if (selectedCategories.length !== MAX_CATEGORIES) {
      setProfileError(`嗜好は${MAX_CATEGORIES}つ選択してください。`);
      return;
    }
    
    if (!username.trim()) {
      setProfileError("displayNameを入力してください。");
      return;
    }

    setSaving(true);
    setProfileError("");
    setMessage("");

    try {
      // displayNameが変更された場合はCloud Functions による自動同期を使用
      if (username.trim() !== originalDisplayName) {
        console.log("displayName変更検出 - Cloud Functions による自動同期を開始");
        await updateUserProfile(user.uid, { displayName: username.trim() });
        console.log("displayName更新完了 - 関連レビューは自動同期されます");
      }

      // Firestoreにユーザー情報を保存（userIdは変更しない）
      const userDocRef = doc(db, "users", user.uid);
      const userData = {
        // userIdは変更しない - 既存の値を保持
        displayName: username.trim(), // displayNameのみ更新
        email: user.email,
        emailVerified: user.emailVerified,
        profileImage: icon || "",
        preferences: selectedCategories,
        updatedAt: new Date()
      };

      // 新規作成の場合はcreatedAtとuserIdも追加
      const existingDoc = await getDoc(userDocRef);
      if (!existingDoc.exists()) {
        userData.createdAt = new Date();
        userData.userId = user.uid; // 新規作成時のみuserIdを設定
        userData.firebaseUid = user.uid;
        userData.reviewCount = 0;
        userData.totalRating = 0;
        userData.favoriteCategories = [];
      } else {
        // 既存ユーザーの場合、userIdは既存値を保持
        const existingData = existingDoc.data();
        userData.userId = existingData.userId || user.uid;
        userData.firebaseUid = existingData.firebaseUid || user.uid;
      }

      // Cloud Functions 対応のプロフィール更新処理
      const profileData = {
        displayName: username.trim(),
        email: user.email,
        emailVerified: user.emailVerified,
        profileImage: icon || "",
        preferences: selectedCategories
      };

      // updateUserProfile を使用して自動同期
      const result = await updateUserProfile(user.uid, profileData);
      
      if (result.success) {
        if (username.trim() !== originalDisplayName) {
          setMessage(`プロフィールが保存されました！displayNameを「${username.trim()}」に更新し、関連データもCloud Functionsで自動同期されます。`);
        } else {
          setMessage("プロフィールが保存されました！");
        }
        setOriginalDisplayName(username.trim());
        
        setTimeout(() => {
          navigate("/home");
        }, 2000);
      } else {
        throw new Error(result.message || "更新に失敗しました");
      }

    } catch (error) {
      console.error("プロフィール保存エラー:", error);
      setProfileError(`保存に失敗しました: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* ヘッダー */}
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate("/home")}>
            <ArrowBack />
          </IconButton>
          <Avatar sx={{ mx: 2, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
            <Person />
          </Avatar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            プロフィール編集
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Fade in timeout={800}>
          <Card sx={{ 
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)', 
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <CardContent sx={{ p: 4 }}>
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  {/* エラーメッセージ */}
                  {profileError && (
                    <Alert 
                      severity="error" 
                      sx={{ 
                        borderRadius: 3,
                        boxShadow: '0 4px 20px rgba(244, 67, 54, 0.2)',
                        border: '1px solid rgba(244, 67, 54, 0.2)'
                      }}
                    >
                      {profileError}
                    </Alert>
                  )}

                  {/* 成功メッセージ */}
                  {message && (
                    <Alert 
                      severity="success" 
                      sx={{ 
                        borderRadius: 3,
                        boxShadow: '0 4px 20px rgba(76, 175, 80, 0.2)',
                        border: '1px solid rgba(76, 175, 80, 0.2)'
                      }}
                    >
                      {message}
                    </Alert>
                  )}

                  {/* ユーザー情報表示 */}
                  <Box 
                    sx={{ 
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: 3,
                      p: 3,
                      color: 'white',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%)',
                        borderRadius: 3,
                        zIndex: 1
                      }
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 2 }}>
                      {/* <Avatar
                        src={icon}
                        sx={{ 
                          width: 100, 
                          height: 100, 
                          mx: 'auto',
                          mb: 2,
                          border: '4px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)',
                          backgroundColor: 'rgba(255, 255, 255, 0.2)'
                        }}
                      >
                        <Person sx={{ fontSize: 50, color: 'white' }} />
                      </Avatar> */}
                      
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontWeight: 'bold', 
                          mb: 1,
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }}
                      >
                        ユーザー情報
                      </Typography>
                      
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 2,
                          maxWidth: 400,
                          mx: 'auto'
                        }}
                      >
                        <Box
                          sx={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 2,
                            p: 2,
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              opacity: 0.8, 
                              mb: 0.5,
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}
                          >
                            ユーザーID
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              wordBreak: 'break-all'
                            }}
                          >
                            {userId || user?.uid || 'ユーザーIDを取得できませんでした'}
                          </Typography>
                        </Box>
                        
                        <Box
                          sx={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 2,
                            p: 2,
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              opacity: 0.8, 
                              mb: 0.5,
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}
                          >
                            表示名
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '1.1rem'
                            }}
                          >
                            {username || 'ユーザーネームを取得できませんでした'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* displayName入力 */}
                  <Box 
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 20%, #764ba2 80%)',
                      borderRadius: 4,
                      p: 3,
                      color: 'white',
                      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <Typography 
                      variant="h6" 
                      gutterBottom
                      sx={{ 
                        fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        textAlign: 'center'
                      }}
                    >
                      表示名の設定
                    </Typography>
                    <TextField
                      fullWidth
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="表示名を入力してください"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(10px)',
                          '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'white',
                            borderWidth: '2px'
                          }
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(0, 0, 0, 0.6)'
                        }
                      }}
                    />
                    {username.trim() !== originalDisplayName && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Preview />}
                          onClick={handlePreviewImpact}
                          sx={{
                            borderRadius: 3,
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                            color: 'white',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                            '&:hover': {
                              borderColor: 'white',
                              backgroundColor: 'rgba(255, 255, 255, 0.15)',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                              transition: 'all 0.3s ease'
                            }
                          }}
                        >
                          変更の影響を確認
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {/* 嗜好選択 */}
                  <Box 
                    sx={{
                      background: 'linear-gradient(135deg, #764ba2 20%, #667eea 80%)',
                      borderRadius: 4,
                      p: 3,
                      color: 'white',
                      boxShadow: '0 8px 32px rgba(118, 75, 162, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <Typography 
                      variant="h6" 
                      gutterBottom
                      sx={{ 
                        fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        textAlign: 'center'
                      }}
                    >
                      好きな料理ジャンル（{MAX_CATEGORIES}つ選択）
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        mb: 2, 
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: 3,
                        p: 1.5,
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      選択済み: {selectedCategories.length}/{MAX_CATEGORIES}
                    </Typography>
                    <Grid container spacing={1}>
                      {FOOD_CATEGORIES.map((category) => (
                        <Grid item key={category}>
                          <Chip
                            label={category}
                            clickable
                            onClick={() => handleCategoryChange(category)}
                            sx={{
                              backgroundColor: selectedCategories.includes(category) 
                                ? 'rgba(255, 255, 255, 0.95)' 
                                : 'rgba(255, 255, 255, 0.2)',
                              color: selectedCategories.includes(category) 
                                ? '#667eea' 
                                : 'white',
                              border: selectedCategories.includes(category) 
                                ? '2px solid rgba(255, 255, 255, 0.8)' 
                                : '1px solid rgba(255, 255, 255, 0.3)',
                              fontWeight: selectedCategories.includes(category) 
                                ? 'bold' 
                                : 'normal',
                              backdropFilter: 'blur(10px)',
                              borderRadius: 3,
                              boxShadow: selectedCategories.includes(category)
                                ? '0 4px 15px rgba(102, 126, 234, 0.3)'
                                : '0 2px 8px rgba(0, 0, 0, 0.1)',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                transition: 'all 0.3s ease',
                                backgroundColor: selectedCategories.includes(category) 
                                  ? 'white' 
                                  : 'rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)'
                              }
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  {/* 保存ボタン */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={saving || selectedCategories.length !== MAX_CATEGORIES}
                      startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                      sx={{
                        py: 2.5,
                        px: 8,
                        borderRadius: 4,
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
                        minWidth: 280,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a67d8 0%, #6c63ff 100%)',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 16px 48px rgba(102, 126, 234, 0.6)',
                          transition: 'all 0.3s ease'
                        },
                        '&:disabled': {
                          background: 'rgba(102, 126, 234, 0.3)',
                          color: 'rgba(255, 255, 255, 0.5)',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      {saving ? "保存中..." : "プロフィールを保存"}
                    </Button>
                  </Box>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Fade>
      </Container>

      {/* 影響範囲プレビューダイアログ */}
      <Dialog 
        open={previewDialog} 
        onClose={() => setPreviewDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 16px 48px rgba(102, 126, 234, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '16px 16px 0 0'
        }}>
          displayName変更の影響範囲
        </DialogTitle>
        <DialogContent>
          {updateImpact && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {updateImpact.message}
              </Typography>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                更新対象の詳細:
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography>• ユーザープロフィール: {updateImpact.details?.userProfile || "計算中"}件</Typography>
                <Typography>• レストランレビュー: {updateImpact.details?.restaurantReviews || "計算中"}件</Typography>
                <Typography>• 投稿レストラン情報: {updateImpact.details?.postRestaurantInfo || "計算中"}件</Typography>
                <Typography>• レビューデータ: {updateImpact.details?.reviews || "計算中"}件</Typography>
              </Box>
              <Alert 
                severity="info" 
                sx={{ 
                  mt: 2,
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(33, 150, 243, 0.2)',
                  border: '1px solid rgba(33, 150, 243, 0.2)'
                }}
              >
                この変更により、過去の投稿・レビューすべてに新しいdisplayNameが反映されます。
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button 
            onClick={() => setPreviewDialog(false)}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1,
              color: '#667eea',
              border: '1px solid #667eea',
              '&:hover': {
                backgroundColor: 'rgba(102, 126, 234, 0.1)'
              }
            }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={() => {
              setPreviewDialog(false);
              handleSubmit({ preventDefault: () => {} });
            }}
            variant="contained"
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a67d8 0%, #6c63ff 100%)',
                boxShadow: '0 6px 25px rgba(102, 126, 234, 0.4)'
              }
            }}
          >
            実行する
          </Button>
        </DialogActions>
      </Dialog>
      {/* フッター用のスペーサー */}
      <Box sx={{ height: 80 }} />
      
      {/* フッター */}
      <Footer />
    </Box>
  );
}

export default EditProfile;
