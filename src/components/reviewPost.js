import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { saveReviewData } from "../utils/dataSync";
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
  Rating,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Paper,
  CircularProgress,
  Alert,
  Chip
} from "@mui/material";
import {
  ArrowBack,
  RateReview,
  Search,
  Send,
  Restaurant,
  LocationOn
} from "@mui/icons-material";

function ReviewPost() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  
  // フォーム状態
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("");

  
  // Google Places API関連
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  
  // 投稿状態
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // カテゴリーオプション
  const categories = [
    "和食", "洋食", "中華", "イタリアン", "フレンチ", "焼肉", "寿司", 
    "ラーメン", "カフェ", "居酒屋", "ファストフード", "デザート", "その他"
  ];

  // Google Maps API の初期化
  useEffect(() => {
    let isMounted = true;
    
    const initializeGoogleMaps = async () => {
      try {
        // 既にAPIが読み込まれている場合はスキップ
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log("✅ Google Maps API 既に読み込み済み");
          setMapsLoaded(true);
          return;
        }

        console.log("📍 Google Maps API 初期化開始...");

        // 既存のスクリプトタグをチェック
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          console.log("🔄 既存のAPIスクリプトを検出、読み込み待機中...");
          // 既存のスクリプトの読み込み完了を待つ
          existingScript.addEventListener('load', () => {
            if (isMounted && window.google && window.google.maps && window.google.maps.places) {
              console.log("✅ 既存スクリプトからAPI読み込み完了");
              setMapsLoaded(true);
            }
          });
          return;
        }

        // 新しいスクリプトを作成
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places&language=ja&region=JP`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          if (isMounted) {
            console.log("✅ Google Maps API 読み込み完了");
            setMapsLoaded(true);
          }
        };
        
        script.onerror = (error) => {
          if (isMounted) {
            console.error("❌ Google Maps API 読み込みエラー:", error);
            setError("Google Maps APIの読み込みに失敗しました。ページを再読み込みしてください。");
          }
        };

        document.head.appendChild(script);

      } catch (error) {
        if (isMounted) {
          console.error("❌ API初期化エラー:", error);
          setError("地図機能の初期化に失敗しました。ページを再読み込みしてください。");
        }
      }
    };

    initializeGoogleMaps();

    // クリーンアップ関数
    return () => {
      isMounted = false;
    };
  }, []);

  // 飲食店検索（新しいPlaces API対応）
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("検索キーワードを入力してください");
      return;
    }

    // Google Maps APIが読み込まれているかチェック
    if (!mapsLoaded || !window.google || !window.google.maps) {
      setError("Google Maps APIが読み込まれていません。ページを再読み込みしてください。");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("🔍 新しいPlaces APIで検索開始:", searchQuery.trim());

      // 新しいPlaces API (Text Search)を使用
      const { Place } = await window.google.maps.importLibrary("places");
      
      // Text Search用のリクエスト
      const request = {
        textQuery: searchQuery.trim(),
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'priceLevel', 'types'],
        language: 'ja',
        region: 'JP',
        locationBias: {
          center: { lat: 35.6762, lng: 139.6503 }, // 東京駅を中心
          radius: 50000 // 50km圏内
        },
        includedType: 'restaurant', // レストランのみに限定
        maxResultCount: 20
      };

      console.log("� 検索リクエスト:", request);

      // 新しいAPIでの検索実行
      const { places } = await Place.searchByText(request);
      
      console.log("✅ 検索完了:", places);
      
      if (places && places.length > 0) {
        // 結果を古いAPI形式に変換（座標は数値として保存）
        const convertedResults = places.map(place => ({
          place_id: place.id,
          name: place.displayName?.text || place.displayName,
          formatted_address: place.formattedAddress,
          vicinity: place.formattedAddress,
          geometry: {
            location: {
              lat: place.location?.lat || 0,
              lng: place.location?.lng || 0
            }
          },
          // 互換性のための関数版も保持
          getLatLng: () => ({
            lat: place.location?.lat || 0,
            lng: place.location?.lng || 0
          }),
          rating: place.rating,
          price_level: place.priceLevel,
          types: place.types || ['restaurant']
        }));

        setSearchResults(convertedResults);
        console.log("📍 変換済み検索結果:", convertedResults);
      } else {
        setSearchResults([]);
        setError("検索結果が見つかりませんでした。別のキーワードで試してください。");
      }
      
    } catch (error) {
      setLoading(false);
      console.error("❌ 検索エラー:", error);
      
      if (error.message?.includes('importLibrary')) {
        setError("新しいPlaces APIライブラリの読み込みに失敗しました。");
      } else if (error.message?.includes('quota')) {
        setError("API使用量の制限に達しました。しばらく待ってから再試行してください。");
      } else if (error.message?.includes('permission') || error.message?.includes('denied')) {
        setError("APIアクセスが拒否されました。APIキーの設定を確認してください。");
      } else {
        setError("検索中にエラーが発生しました。もう一度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  };

  // 店舗選択
  const handleSelectRestaurant = (restaurant) => {
    try {
      console.log("🏪 選択された店舗:", restaurant);
      
      // 必要なデータが揃っているかチェック
      if (!restaurant.place_id || !restaurant.name || !restaurant.geometry) {
        setError("店舗情報が不完全です。別の店舗を選択してください。");
        return;
      }
      
      // 座標データの検証
      let hasValidLocation = false;
      if (restaurant.geometry.location) {
        if (typeof restaurant.geometry.location.lat === 'number' && 
            typeof restaurant.geometry.location.lng === 'number') {
          hasValidLocation = true;
        } else if (typeof restaurant.geometry.location.lat === 'function' && 
                   typeof restaurant.geometry.location.lng === 'function') {
          hasValidLocation = true;
        }
      }
      
      if (!hasValidLocation) {
        setError("店舗の位置情報が不正です。別の店舗を選択してください。");
        return;
      }
      
      setSelectedRestaurant(restaurant);
      setSearchResults([]);
      setSearchQuery("");
      setError(""); // エラーをクリア
      
      console.log("✅ 店舗選択完了:", restaurant.name);
    } catch (error) {
      console.error("❌ 店舗選択エラー:", error);
      setError("店舗の選択に失敗しました。もう一度お試しください。");
    }
  };

  // 投稿処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setError("ログインが必要です");
      return;
    }
    
    if (!selectedRestaurant) {
      setError("店舗を選択してください");
      return;
    }

    // 店舗データの完整性チェック
    if (!selectedRestaurant.place_id || !selectedRestaurant.name || !selectedRestaurant.geometry) {
      setError("選択された店舗の情報が不完全です。もう一度店舗を選択してください。");
      return;
    }
    
    if (!comment.trim()) {
      setError("コメントを入力してください");
      return;
    }
    
    if (rating === 0) {
      setError("評価を選択してください");
      return;
    }
    
    if (!category) {
      setError("カテゴリを選択してください");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      console.log("📝 レビュー投稿開始...");
      
      // 座標データの安全な取得
      let restaurantLat = 0;
      let restaurantLng = 0;
      
      console.log("🔍 selectedRestaurant.geometry:", selectedRestaurant.geometry);
      console.log("🔍 selectedRestaurant.geometry.location:", selectedRestaurant.geometry.location);
      console.log("🔍 lat type:", typeof selectedRestaurant.geometry.location.lat);
      console.log("🔍 lng type:", typeof selectedRestaurant.geometry.location.lng);
      
      if (selectedRestaurant.geometry && selectedRestaurant.geometry.location) {
        // 新しいAPIの場合（数値として保存されている）
        if (typeof selectedRestaurant.geometry.location.lat === 'number') {
          restaurantLat = selectedRestaurant.geometry.location.lat;
          restaurantLng = selectedRestaurant.geometry.location.lng;
          console.log("✅ 数値として座標取得:", { lat: restaurantLat, lng: restaurantLng });
        }
        // 古いAPIまたは関数の場合
        else if (typeof selectedRestaurant.geometry.location.lat === 'function') {
          try {
            restaurantLat = selectedRestaurant.geometry.location.lat();
            restaurantLng = selectedRestaurant.geometry.location.lng();
            console.log("✅ 関数呼び出しで座標取得:", { lat: restaurantLat, lng: restaurantLng });
          } catch (funcError) {
            console.error("❌ 関数呼び出しエラー:", funcError);
          }
        }
        // getLatLng関数がある場合
        else if (selectedRestaurant.getLatLng && typeof selectedRestaurant.getLatLng === 'function') {
          try {
            const latLng = selectedRestaurant.getLatLng();
            restaurantLat = latLng.lat;
            restaurantLng = latLng.lng;
            console.log("✅ getLatLng関数で座標取得:", { lat: restaurantLat, lng: restaurantLng });
          } catch (funcError) {
            console.error("❌ getLatLng呼び出しエラー:", funcError);
          }
        }
      }

      // 座標が有効な数値かチェック
      if (typeof restaurantLat !== 'number' || typeof restaurantLng !== 'number' || 
          isNaN(restaurantLat) || isNaN(restaurantLng)) {
        setError("店舗の位置情報を取得できませんでした。別の店舗を選択してください。");
        return;
      }

      console.log("📍 最終座標データ:", { lat: restaurantLat, lng: restaurantLng });

      // レビューデータをFirestoreに保存（統合同期システム使用）
      const reviewData = {
        category: category,
        comment: comment.trim(),
        rating: rating,
        restaurantAddress: selectedRestaurant.formatted_address || "",
        restaurantLocation: {
          lat: Number(restaurantLat),
          lng: Number(restaurantLng)
        },
        restaurantName: selectedRestaurant.name,
        
        // セキュリティルール必須フィールド
        userId: user.uid,
        userEmail: user.email,
        restaurantId: selectedRestaurant.place_id,
        isPublic: true,
        isDeleted: false,
        
        // 追加情報
        userDisplayName: user.displayName || user.email.split('@')[0] || "user"
      };

      // Firestore保存前の最終データ検証
      console.log("📋 投稿データ:", reviewData);
      console.log("🔍 座標データ型チェック:", {
        latType: typeof reviewData.restaurantLocation.lat,
        lngType: typeof reviewData.restaurantLocation.lng,
        latValue: reviewData.restaurantLocation.lat,
        lngValue: reviewData.restaurantLocation.lng
      });

      // 統合保存システムを使用（二重保存を排除）
      const result = await saveReviewData(user.uid, selectedRestaurant, reviewData);
      
      if (result.success) {
        console.log("✅ 統合レビュー保存完了");
        alert("レストラン情報が投稿されました！");
        navigate("/home");
      } else {
        throw new Error(result.message || "保存に失敗しました");
      }
      
    } catch (err) {
      console.error("❌ 投稿エラー:", err);
      
      // エラーの種類に応じた詳細メッセージ
      if (err.code === 'permission-denied') {
        setError("レストラン情報の投稿権限がありません。");
      } else if (err.code === 'storage/unauthorized') {
        setError("画像のアップロード権限がありません。");
      } else if (err.code === 'storage/quota-exceeded') {
        setError("ストレージの容量が不足しています。");
      } else if (err.message?.includes('network')) {
        setError("ネットワークエラーが発生しました。接続を確認してください。");
      } else {
        setError("投稿に失敗しました。もう一度お試しください。");
      }
    } finally {
      setSubmitting(false);
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
            <RateReview />
          </Avatar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            レビュー投稿
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
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}
              
              <form onSubmit={handleSubmit}>
                <Stack spacing={4}>
                  {/* 店舗検索 */}
                  <Box>
                    <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
                      飲食店検索
                    </Typography>
                    {selectedRestaurant ? (
                      <Paper 
                        sx={{ 
                          p: 2, 
                          bgcolor: 'primary.light', 
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        <LocationOn />
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {selectedRestaurant.name}
                          </Typography>
                          <Typography variant="body2">
                            {selectedRestaurant.formatted_address}
                          </Typography>
                        </Box>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          sx={{ ml: 'auto', borderColor: 'white', color: 'white' }}
                          onClick={() => setSelectedRestaurant(null)}
                        >
                          変更
                        </Button>
                      </Paper>
                    ) : (
                      <Box>
                        <TextField
                          label="飲食店名を入力して検索"
                          fullWidth
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton onClick={handleSearch} edge="end" disabled={loading}>
                                  {loading ? <CircularProgress size={20} /> : <Search />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            }
                          }}
                        />
                        
                        {/* 検索結果リスト */}
                        {searchResults.length > 0 && (
                          <Paper sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}>
                            <List>
                              {searchResults.map((restaurant, index) => (
                                <ListItem key={index} disablePadding>
                                  <ListItemButton onClick={() => handleSelectRestaurant(restaurant)}>
                                    <Restaurant sx={{ mr: 2 }} />
                                    <ListItemText
                                      primary={restaurant.name}
                                      secondary={restaurant.formatted_address}
                                    />
                                    {restaurant.rating && (
                                      <Chip 
                                        label={`★${restaurant.rating}`} 
                                        size="small" 
                                        color="primary"
                                      />
                                    )}
                                  </ListItemButton>
                                </ListItem>
                              ))}
                            </List>
                          </Paper>
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* カテゴリー選択 */}
                  <FormControl fullWidth>
                    <InputLabel>カテゴリー</InputLabel>
                    <Select
                      value={category}
                      label="カテゴリー"
                      onChange={(e) => setCategory(e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      {categories.map((cat) => (
                        <MenuItem key={cat} value={cat}>
                          {cat}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* コメント入力 */}
                  <TextField
                    label="一言コメント"
                    multiline
                    rows={4}
                    fullWidth
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="お店の感想を教えてください..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  {/* 評価 */}
                  <Box>
                    <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
                      星5段階評価
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Rating
                        value={rating}
                        onChange={(event, newValue) => setRating(newValue)}
                        size="large"
                      />
                      <Typography variant="body1" color="text.secondary">
                        {rating > 0 ? `${rating}点` : "評価を選択してください"}
                      </Typography>
                    </Box>
                  </Box>


                  {/* 投稿ボタン */}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={submitting ? <CircularProgress size={20} /> : <Send />}
                    disabled={submitting || !selectedRestaurant || !comment.trim() || rating === 0 || !category}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                      boxShadow: '0 3px 5px 2px rgba(76, 175, 80, .3)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #4CAF50 60%, #8BC34A 100%)',
                      },
                      '&:disabled': {
                        background: '#ccc',
                      }
                    }}
                  >
                    {submitting ? "投稿中..." : "レストラン情報を投稿"}
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

export default ReviewPost;