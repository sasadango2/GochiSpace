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
  Notifications
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
    else if (path === "/reviewpost") setValue(2);
  }, [location.pathname]);

  // ナビゲーション処理
  const handleNavigation = (event, newValue) => {
    setValue(newValue);
    
    switch (newValue) {
      case 0: // ホーム
        navigate("/home");
        break;
      case 1: // 検索
        // ユーザー検索機能は後で実装
        const searchQuery = prompt("検索するユーザー名を入力してください:");
        if (searchQuery) {
          console.log("検索:", searchQuery);
        }
        break;
      case 2: // 投稿
        navigate("/reviewpost");
        break;
      case 3: // 通知
        alert("通知機能は準備中です");
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
        backfaceVisibility: 'hidden'
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={handleNavigation}
        showLabels
        sx={{
          height: 70,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 0',
            '&.Mui-selected': {
              color: '#667eea'
            }
          }
        }}
      >
        <BottomNavigationAction 
          label="ホーム" 
          icon={<Home />}
        />
        <BottomNavigationAction 
          label="検索" 
          icon={<Search />}
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
                width: 40,
                height: 40,
                color: 'white'
              }}
            >
              <Add />
            </Box>
          }
        />
        <BottomNavigationAction 
          label="通知" 
          icon={
            <Badge badgeContent={0} color="error">
              <Notifications />
            </Badge>
          }
        />
      </BottomNavigation>
    </Paper>
  );
}

export default Footer;
