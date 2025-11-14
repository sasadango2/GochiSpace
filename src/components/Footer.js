import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import {
  BottomNavigation,
  BottomNavigationAction,
  Badge,
  Paper,
  Box
} from "@mui/material";
import {
  Home,
  Search,
  Add,
  AccountBox,
} from "@mui/icons-material";

function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user] = useAuthState(auth);
  const [value, setValue] = useState(0);

  // 現在のパスに基づいてアクティブなタブを設定
  useEffect(() => {
    const path = location.pathname;
    if (path === "/home") setValue(0);
    else if (path === "/userIdSearch") setValue(1);
    else if (path === "/reviewpost") setValue(2);
  }, [location.pathname]);

  // ナビゲーション処理(画面遷移)
  const handleNavigation = (event, newValue) => {
    setValue(newValue);
    
    switch (newValue) {
      case 0: // ホーム
        navigate("/home");
        break;
      case 1: // 検索
        navigate("/userIdSearch");
        break;
      case 2: // 投稿
        navigate("/reviewpost");
        break;
      case 3: // マイプロフィール
        navigate("/editProfile");
        break;
      default:
        break;
    }
  };

  // デバッグ用ログ
  console.log("Footer render - user:", user, "location:", location.pathname);

  // ログインしていない場合は表示しない
  if (!user) {
    console.log("Footer: ユーザーが未ログインのため非表示");
    return null;
  }

  console.log("Footer: 表示中");

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1100,
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        width: '100%',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        borderTopLeftRadius: { xs: 12, sm: 0 },
        borderTopRightRadius: { xs: 12, sm: 0 }
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={handleNavigation}
        showLabels
        sx={{
          height: { xs: 64, sm: 70 },
          borderTopLeftRadius: { xs: 12, sm: 0 },
          borderTopRightRadius: { xs: 12, sm: 0 },
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: { xs: '4px 0', sm: '6px 0' },
            fontSize: { xs: '0.7rem', sm: '0.8rem' },
            '&.Mui-selected': {
              color: '#667eea'
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              marginTop: { xs: 2, sm: 4 }
            }
          }
        }}
      >
        <BottomNavigationAction 
          label="ホーム" 
          icon={<Home sx={{ fontSize: { xs: 20, sm: 24 } }} />}
        />
        <BottomNavigationAction 
          label="ユーザー検索" 
          icon={<Search sx={{ fontSize: { xs: 20, sm: 24 } }} />}
        />
        <BottomNavigationAction 
          label="投稿" 
          icon={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#667eea',
                borderRadius: '50%',
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                color: 'white'
              }}
            >
              <Add sx={{ fontSize: { xs: 18, sm: 20 } }} />
            </Box>
          }
        />
        <BottomNavigationAction 
          label="マイプロフィール" 
          icon={
            <Badge badgeContent={0} color="error">
              <AccountBox sx={{ fontSize: { xs: 20, sm: 24 } }} />
            </Badge>
          }
        />
      </BottomNavigation>
    </Paper>
  );
}

export default Footer;
