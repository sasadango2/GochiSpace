import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  updateUserProfile
} from "../utils/dataSync";
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
  PhotoCamera,
  Save,
  Preview
} from "@mui/icons-material";

const CATEGORIES = [
  "中華", "イタリアン", "和食", "スイーツ", "カレー", "ピザ", "ラーメン", "ハンバーガー",
  "丼", "定食", "寿司", "韓国料理", "焼肉", "パン", "エスニック料理"
];

function EditProfile() {
  const [user, loading] = useAuthState(auth);
  const [username, setUsername] = useState("");
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [icon, setIcon] = useState(null);
  const [iconFile, setIconFile] = useState(null);
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
    } else if (selectedCategories.length < 3) {
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
        message: "Cloud Functions により関連データが自動同期されます"
      });
      setPreviewDialog(true);
    } catch (error) {
      setProfileError("プロフィール更新の準備中にエラーが発生しました");
    }
  };

  const handleIconChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIconFile(file);
      setIcon(URL.createObjectURL(file));
    }
  };

  const uploadProfileImage = async () => {
    if (!iconFile || !user) return null;
    
    try {
      const imageRef = ref(storage, `profile-images/${user.uid}/${Date.now()}`);
      const snapshot = await uploadBytes(imageRef, iconFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("画像アップロードエラー:", error);
      throw new Error("画像のアップロードに失敗しました。");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setProfileError("ログインが必要です。");
      return;
    }
    
    if (selectedCategories.length !== 3) {
      setProfileError("嗜好は3つ選択してください。");
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

      // プロフィール画像をアップロード（ある場合）
      let profileImageUrl = icon;
      if (iconFile) {
        profileImageUrl = await uploadProfileImage();
      }

      // Firestoreにユーザー情報を保存（userIdは変更しない）
      const userDocRef = doc(db, "users", user.uid);
      const userData = {
        // userIdは変更しない - 既存の値を保持
        displayName: username.trim(), // displayNameのみ更新
        email: user.email,
        emailVerified: user.emailVerified,
        profileImage: profileImageUrl || "",
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
        profileImage: profileImageUrl || "",
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
      <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)' }}>
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
          <Card sx={{ boxShadow: 6, borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  {/* エラーメッセージ */}
                  {profileError && (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                      {profileError}
                    </Alert>
                  )}

                  {/* 成功メッセージ */}
                  {message && (
                    <Alert severity="success" sx={{ borderRadius: 2 }}>
                      {message}
                    </Alert>
                  )}

                  {/* プロフィール画像 */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      プロフィール画像
                    </Typography>
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Avatar
                        src={icon}
                        sx={{ 
                          width: 120, 
                          height: 120, 
                          mb: 2, 
                          border: '4px solid #fff',
                          boxShadow: 3
                        }}
                      >
                        <Person sx={{ fontSize: 60 }} />
                      </Avatar>
                      <IconButton
                        component="label"
                        sx={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          bgcolor: 'primary.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'primary.dark' }
                        }}
                      >
                        <PhotoCamera />
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handleIconChange}
                        />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* displayName入力 */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      表示名 (displayName)
                    </Typography>
                    <TextField
                      fullWidth
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="表示名を入力してください"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />
                    {username.trim() !== originalDisplayName && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Preview />}
                          onClick={handlePreviewImpact}
                        >
                          変更の影響を確認
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {/* 嗜好選択 */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      好きな料理ジャンル（3つ選択）
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      選択済み: {selectedCategories.length}/3
                    </Typography>
                    <Grid container spacing={1}>
                      {CATEGORIES.map((category) => (
                        <Grid item key={category}>
                          <Chip
                            label={category}
                            clickable
                            color={selectedCategories.includes(category) ? "primary" : "default"}
                            onClick={() => handleCategoryChange(category)}
                            sx={{
                              '&:hover': {
                                transform: 'scale(1.05)',
                                transition: 'transform 0.2s'
                              }
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  {/* 保存ボタン */}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={saving || selectedCategories.length !== 3}
                    startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      fontSize: '1.1rem',
                      background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #FE6B8B 60%, #FF8E53 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: 6
                      }
                    }}
                  >
                    {saving ? "保存中..." : "プロフィールを保存"}
                  </Button>
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
      >
        <DialogTitle>displayName変更の影響範囲</DialogTitle>
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
                <Typography>• ユーザープロフィール: {updateImpact.details.userProfile}件</Typography>
                <Typography>• レストランレビュー: {updateImpact.details.restaurantReviews}件</Typography>
                <Typography>• 投稿レストラン情報: {updateImpact.details.postRestaurantInfo}件</Typography>
                <Typography>• レビューデータ: {updateImpact.details.reviews}件</Typography>
              </Box>
              <Alert severity="info" sx={{ mt: 2 }}>
                この変更により、過去の投稿・レビューすべてに新しいdisplayNameが反映されます。
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>
            キャンセル
          </Button>
          <Button 
            onClick={() => {
              setPreviewDialog(false);
              handleSubmit({ preventDefault: () => {} });
            }}
            variant="contained"
          >
            実行する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EditProfile;
