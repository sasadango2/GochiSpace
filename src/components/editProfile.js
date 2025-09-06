import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  CircularProgress
} from "@mui/material";
import {
  ArrowBack,
  Person,
  PhotoCamera,
  Restaurant,
  Save
} from "@mui/icons-material";

const CATEGORIES = [
  "中華", "イタリアン", "和食", "スイーツ", "カレー", "ピザ", "ラーメン", "ハンバーガー",
  "丼", "定食", "寿司", "韓国料理", "焼肉", "パン", "エスニック料理"
];

function EditProfile() {
  const [user, loading] = useAuthState(auth);
  const [username, setUsername] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [icon, setIcon] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const navigate = useNavigate();

  const loadUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUsername(userData.displayName || userData.userId || "");
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
      setProfileError("ユーザーネームを入力してください。");
      return;
    }

    setSaving(true);
    setProfileError("");
    setMessage("");

    try {
      // プロフィール画像をアップロード（ある場合）
      let profileImageUrl = icon;
      if (iconFile) {
        profileImageUrl = await uploadProfileImage();
      }

      // Firestoreにユーザー情報を保存
      const userDocRef = doc(db, "users", user.uid);
      const userData = {
        userId: username.trim(),
        firebaseUid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: username.trim(),
        profileImage: profileImageUrl || "",
        preferences: selectedCategories,
        updatedAt: new Date()
      };

      // 新規作成の場合はcreatedAtも追加
      const existingDoc = await getDoc(userDocRef);
      if (!existingDoc.exists()) {
        userData.createdAt = new Date();
        userData.reviewCount = 0;
        userData.totalRating = 0;
        userData.favoriteCategories = [];
      }

      await setDoc(userDocRef, userData, { merge: true });
      
      setMessage("プロフィールが保存されました！");
      setTimeout(() => {
        navigate("/home");
      }, 2000);
      
    } catch (error) {
      console.error("保存エラー:", error);
      setProfileError("保存に失敗しました: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ログイン状態をチェック
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="error" gutterBottom>
              ログインが必要です
            </Typography>
            <Button variant="contained" onClick={() => navigate("/auth")}>
              ログイン画面へ
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
            プロフィール編集
          </Typography>
          {/* ユーザーID表示 */}
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            ID: {user.uid.substring(0, 8)}...
          </Typography>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ */}
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Fade in={true} timeout={1000}>
          <Card
            elevation={12}
            sx={{
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              {/* ユーザー情報表示 */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  ログイン情報
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ユーザーID: {user.uid}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  メールアドレス: {user.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  メール認証: {user.emailVerified ? '✅ 認証済み' : '❌ 未認証'}
                </Typography>
              </Box>

              {/* メッセージ表示 */}
              {message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {message}
                </Alert>
              )}
              {profileError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {profileError}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                  {/* アイコン設定 */}
                  <Box textAlign="center">
                    <Avatar
                      src={icon}
                      sx={{
                        width: 120,
                        height: 120,
                        margin: '0 auto 16px',
                        bgcolor: 'primary.main'
                      }}
                    >
                      {!icon && <Restaurant fontSize="large" />}
                    </Avatar>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="icon-upload"
                      type="file"
                      onChange={handleIconChange}
                    />
                    <label htmlFor="icon-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<PhotoCamera />}
                        sx={{ borderRadius: 2 }}
                        disabled={saving}
                      >
                        アイコンを選択
                      </Button>
                    </label>
                  </Box>

                  {/* ユーザーネーム */}
                  <TextField
                    label="ユーザーネーム"
                    fullWidth
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={saving}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  {/* 嗜好設定 */}
                  <Box>
                    <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
                      嗜好設定（3つ選択してください）
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      選択済み: {selectedCategories.length}/3
                    </Typography>
                    <Grid container spacing={1} mt={1}>
                      {CATEGORIES.map((cat) => (
                        <Grid item key={cat}>
                          <Chip
                            label={cat}
                            onClick={() => handleCategoryChange(cat)}
                            color={selectedCategories.includes(cat) ? "primary" : "default"}
                            variant={selectedCategories.includes(cat) ? "filled" : "outlined"}
                            disabled={
                              saving || (!selectedCategories.includes(cat) && selectedCategories.length >= 3)
                            }
                            sx={{
                              borderRadius: 2,
                              '&:hover': {
                                backgroundColor: selectedCategories.includes(cat) 
                                  ? 'primary.dark' 
                                  : 'action.hover'
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
                    fullWidth
                    startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                    disabled={saving}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                      boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #FE6B8B 60%, #FF8E53 100%)',
                      },
                      '&:disabled': {
                        background: 'grey.300',
                      }
                    }}
                  >
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
}

export default EditProfile;