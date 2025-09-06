import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
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
  CardContent
} from "@mui/material";
import {
  Logout,
  Person,
  RateReview,
  Restaurant
} from "@mui/icons-material";

function Home() {
  const navigate = useNavigate();

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
          <Button color="inherit" onClick={logout} startIcon={<Logout />}>
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Fade in={true} timeout={1000}>
          <Box>
            {/* Google Map */}
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
