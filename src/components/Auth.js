import React, { useState } from "react";
import { auth, db } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FOOD_CATEGORIES, MAX_CATEGORIES } from "../constants/categories";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Avatar,
  Divider,
  IconButton,
  InputAdornment,
  Card,
  CardContent,
  Fade,
  Alert,
  Chip,
  Grid
} from "@mui/material";
import {
  Login,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Restaurant,
  Person,
  PersonAdd
} from "@mui/icons-material";

function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const navigate = useNavigate();

  // カテゴリー選択
  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else if (prev.length < MAX_CATEGORIES) {
        return [...prev, category];
      }
      return prev;
    });
  };

  // ユーザー登録
  const handleRegister = async () => {
    setLoading(true);
    setError("");
    
    try {
      // バリデーション
      if (!email || !password || !userId) {
        throw new Error("全ての項目を入力してください");
      }
      
      if (password.length < 6) {
        throw new Error("パスワードは6文字以上で入力してください");
      }
      
      if (userId.length < 3) {
        throw new Error("ユーザーIDは3文字以上で入力してください");
      }

      console.log("🚀 ユーザー登録開始");

      // Firebase Authenticationでユーザー作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // プロフィール更新
      await updateProfile(user, {
        displayName: userId
      });

      // Firestoreにユーザー情報保存
      const userData = {
        userId: userId,
        displayName: userId, // displayNameとしてuserIdを使用
        firebaseUid: user.uid,
        email: email,
        emailVerified: false,
        profileImage: "",
        preferences: [
          selectedCategories[0] || "",
          selectedCategories[1] || "",
          selectedCategories[2] || ""
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, "users", user.uid), userData);

      // メール認証送信
      await sendEmailVerification(user);

      setMessage("アカウントが作成されました！確認メールを送信しました。");
      
      // 3秒後にログイン画面に切り替え
      setTimeout(() => {
        setIsRegister(false);
        resetForm();
      }, 3000);

    } catch (error) {
      console.error("❌ 登録エラー:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        setError("このメールアドレスは既に使用されています");
      } else if (error.code === 'auth/weak-password') {
        setError("パスワードが弱すぎます");
      } else if (error.code === 'auth/invalid-email') {
        setError("無効なメールアドレス形式です");
      } else {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  // ログイン
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        setError("メールアドレスが認証されていません。メールをチェックして認証を完了してください。");
        setLoading(false);
        return;
      }
      
      setMessage("ログイン成功！");
      navigate("/home");
      
    } catch (error) {
      console.error("❌ ログインエラー:", error);
      
      if (error.code === 'auth/invalid-credential') {
        setError("メールアドレスまたはパスワードが間違っています");
      } else {
        setError("ログインに失敗しました");
      }
    }
    setLoading(false);
  };

  // フォームリセット
  const resetForm = () => {
    setEmail("");
    setPassword("");
    setUserId("");
    setSelectedCategories([]);
    setError("");
    setMessage("");
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2
      }}
    >
      <Container maxWidth="sm">
        <Fade in={true} timeout={1000}>
          <Card
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <CardContent sx={{ p: 0 }}>
              {/* ヘッダー */}
              <Box
                sx={{
                  background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                  p: 4,
                  textAlign: 'center',
                  color: 'white'
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    width: 80,
                    height: 80,
                    margin: '0 auto 16px',
                    fontSize: '2rem'
                  }}
                >
                  <Restaurant fontSize="large" />
                </Avatar>
                <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom>
                  GochiSpace
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  美味しい発見をシェアしよう
                </Typography>
              </Box>

              {/* フォーム */}
              <Box sx={{ p: 4 }}>
                <Typography 
                  variant="h5" 
                  component="h2" 
                  gutterBottom 
                  textAlign="center"
                  color="primary"
                  fontWeight="bold"
                >
                  {isRegister ? "新規アカウント作成" : "ログイン"}
                </Typography>

                {/* メッセージ表示 */}
                {message && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {message}
                  </Alert>
                )}

                {/* エラー表示 */}
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                <Stack spacing={3} mt={3}>
                  {/* ユーザーID（登録時のみ） */}
                  {isRegister && (
                    <TextField
                      label="ユーザーID"
                      fullWidth
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="半角英数字3文字以上"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person color="action" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}

                  {/* メールアドレス */}
                  <TextField
                    type="email"
                    label="メールアドレス"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  {/* パスワード */}
                  <TextField
                    type={showPassword ? 'text' : 'password'}
                    label="パスワード"
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? "6文字以上" : ""}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleClickShowPassword} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  {/* カテゴリー選択（登録時のみ） */}
                  {isRegister && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        好きなカテゴリーを選択（最大{MAX_CATEGORIES}つ）
                      </Typography>
                      <Typography variant="body2" color="grey.600" gutterBottom>
                        選択済み: {selectedCategories.length}/{MAX_CATEGORIES}
                      </Typography>
                      <Grid container spacing={1}>
                        {FOOD_CATEGORIES.map((category) => (
                          <Grid item xs={6} sm={4} key={category}>
                            <Chip
                              label={category}
                              onClick={() => handleCategoryChange(category)}
                              color={selectedCategories.includes(category) ? "primary" : "default"}
                              variant={selectedCategories.includes(category) ? "filled" : "outlined"}
                              sx={{
                                width: '100%',
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: selectedCategories.includes(category) 
                                    ? 'primary.dark' 
                                    : 'grey.100'
                                }
                              }}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* 送信ボタン */}
                  <Button
                    onClick={isRegister ? handleRegister : handleLogin}
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    startIcon={isRegister ? <PersonAdd /> : <Login />}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #FE6B8B 60%, #FF8E53 100%)',
                      }
                    }}
                  >
                    {loading ? "処理中..." : (isRegister ? "アカウント作成" : "ログイン")}
                  </Button>

                  <Divider sx={{ my: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      または
                    </Typography>
                  </Divider>

                  {/* 画面切り替えボタン */}
                  <Button
                    onClick={() => {
                      setIsRegister(!isRegister);
                      resetForm();
                    }}
                    variant="text"
                    fullWidth
                    sx={{ borderRadius: 2, py: 1.5, fontSize: '1rem' }}
                  >
                    {isRegister 
                      ? "既にアカウントをお持ちの方はこちら" 
                      : "新規アカウント作成はこちら"
                    }
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
}

export default Auth;