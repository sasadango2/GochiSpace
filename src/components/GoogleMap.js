import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Typography,
  Paper
} from '@mui/material';

function GoogleMap() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [user] = useAuthState(auth);
  
  // フィルター状態
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showMyReviews, setShowMyReviews] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const categories = [
    "和食", "洋食", "中華", "イタリアン", "フレンチ", "焼肉", "寿司", 
    "ラーメン", "カフェ", "居酒屋", "ファストフード", "デザート", "その他"
  ];

  // レビューデータを取得
  const fetchReviews = useCallback(async () => {
    try {
      let reviewQuery = query(
        collection(db, 'reviews'),
        orderBy('createdAt', 'desc')
      );

      // ユーザーフィルター
      if (showMyReviews && user) {
        reviewQuery = query(
          collection(db, 'reviews'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(reviewQuery);
      const reviewsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setReviews(reviewsData);
    } catch (error) {
      console.error('レビュー取得エラー:', error);
    }
  }, [showMyReviews, user]);

  // マップの初期化
  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places']
    });

    loader.load().then(() => {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 35.6762, lng: 139.6503 }, // 東京駅
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
      setMap(mapInstance);
    }).catch(error => {
      console.error('Google Maps API読み込みエラー:', error);
    });
  }, []);

  // レビューデータの初期取得
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // フィルタリングされたレビューを取得
  const getFilteredReviews = useCallback(() => {
    return reviews.filter(review => {
      // カテゴリーフィルター
      if (categoryFilter && review.category !== categoryFilter) {
        return false;
      }
      
      // 検索フィルター（店名、ユーザーメール、ユーザー表示名）
      if (searchFilter) {
        const searchLower = searchFilter.toLowerCase();
        const matchesRestaurant = review.restaurantName?.toLowerCase().includes(searchLower);
        const matchesUserEmail = review.userEmail?.toLowerCase().includes(searchLower);
        const matchesUserName = review.userDisplayName?.toLowerCase().includes(searchLower);
        if (!matchesRestaurant && !matchesUserEmail && !matchesUserName) {
          return false;
        }
      }
      
      return true;
    });
  }, [reviews, categoryFilter, searchFilter]);

  // マーカーを更新（同じ店舗の複数レビューをグループ化）
  useEffect(() => {
    if (!map) return;

    // 既存のマーカーを削除
    markers.forEach(marker => marker.setMap(null));

    const filteredReviews = getFilteredReviews();
    const newMarkers = [];

    // 店舗ごとにレビューをグループ化
    const restaurantGroups = {};
    filteredReviews.forEach(review => {
      if (review.restaurantLocation) {
        const key = `${review.restaurantLocation.lat}_${review.restaurantLocation.lng}`;
        if (!restaurantGroups[key]) {
          restaurantGroups[key] = {
            restaurantName: review.restaurantName,
            location: review.restaurantLocation,
            reviews: []
          };
        }
        restaurantGroups[key].reviews.push(review);
      }
    });

    // グループごとにマーカーを作成
    Object.values(restaurantGroups).forEach(group => {
      const primaryReview = group.reviews[0]; // 代表レビュー
      const reviewCount = group.reviews.length;
      
      const marker = new window.google.maps.Marker({
        position: {
          lat: group.location.lat,
          lng: group.location.lng
        },
        map: map,
        title: `${group.restaurantName} (${reviewCount}件のレビュー)`,
        icon: {
          url: getCategoryIcon(primaryReview.category, reviewCount),
          scaledSize: new window.google.maps.Size(35, 35)
        }
      });

      // マーカークリック時の情報ウィンドウ（複数レビュー対応）
      const infoWindow = new window.google.maps.InfoWindow({
        content: createMultiReviewInfoWindowContent(group)
      });

      marker.addListener('click', () => {
        if (selectedMarker) {
          selectedMarker.close();
        }
        infoWindow.open(map, marker);
        setSelectedMarker(infoWindow);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, getFilteredReviews]);

  // カテゴリーに応じたアイコンを取得（レビュー数バッジ付き）
  const getCategoryIcon = (category, reviewCount = 1) => {
    const iconMap = {
      "和食": "#FF6B6B",
      "洋食": "#4ECDC4", 
      "中華": "#FFE66D",
      "イタリアン": "#FF8A80",
      "フレンチ": "#CE93D8",
      "焼肉": "#FFAB91",
      "寿司": "#80DEEA",
      "ラーメン": "#FFCC02",
      "カフェ": "#A8E6CF",
      "居酒屋": "#BCAAA4",
      "ファストフード": "#FFD54F",
      "デザート": "#F8BBD9",
      "その他": "#B0BEC5"
    };
    
    const color = iconMap[category] || "#888888";
    const categoryText = category.length > 2 ? category.substring(0, 2) : category;
    const badgeColor = reviewCount > 1 ? "#FF4444" : "transparent";
    const badgeText = reviewCount > 1 ? reviewCount : "";
    
    return `data:image/svg+xml;charset=UTF-8,%3csvg width='35' height='35' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='17.5' cy='17.5' r='15' fill='${encodeURIComponent(color)}'/%3e%3ctext x='17.5' y='22' text-anchor='middle' fill='white' font-size='10' font-weight='bold'%3e${encodeURIComponent(categoryText)}%3c/text%3e${reviewCount > 1 ? `%3ccircle cx='28' cy='7' r='6' fill='${encodeURIComponent(badgeColor)}'/%3e%3ctext x='28' y='10' text-anchor='middle' fill='white' font-size='8' font-weight='bold'%3e${badgeText}%3c/text%3e` : ''}%3c/svg%3e`;
  };

  // 複数レビュー用の情報ウィンドウコンテンツを作成
  const createMultiReviewInfoWindowContent = (restaurantGroup) => {
    const { restaurantName, reviews } = restaurantGroup;
    const reviewCount = reviews.length;
    
    // レビューを評価順（高い順）でソート
    const sortedReviews = [...reviews].sort((a, b) => b.rating - a.rating);
    
    let reviewsHtml = '';
    sortedReviews.forEach((review, index) => {
      const userName = review.userDisplayName || review.userEmail?.split('@')[0] || 'ユーザー';
      const createDate = review.createdAt?.toDate?.()?.toLocaleDateString() || '日付不明';
      
      reviewsHtml += `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0; ${index === sortedReviews.length - 1 ? 'border-bottom: none;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <strong style="color: #2196F3; font-size: 14px;">👤 ${userName}</strong>
            <span style="color: #666; font-size: 12px;">${createDate}</span>
          </div>
          <div style="margin: 5px 0;">
            <span style="color: #FF9800; font-size: 16px;">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
            <span style="margin-left: 5px; color: #666; font-size: 12px;">${review.rating}/5</span>
            <span style="margin-left: 10px; background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; font-size: 11px;">${review.category}</span>
          </div>
          <p style="margin: 5px 0; color: #333; font-size: 13px; line-height: 1.4;">${review.comment}</p>
          ${review.imageUrl ? `<img src="${review.imageUrl}" style="width: 100%; max-width: 200px; height: auto; margin-top: 5px; border-radius: 8px; border: 1px solid #ddd;" />` : ''}
        </div>
      `;
    });
    
    return `
      <div style="max-width: 350px; max-height: 400px; padding: 15px; font-family: Arial, sans-serif;">
        <div style="border-bottom: 2px solid #2196F3; padding-bottom: 10px; margin-bottom: 15px;">
          <h3 style="margin: 0; color: #1976d2; font-size: 18px;">📍 ${restaurantName}</h3>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
            <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
              ${reviewCount}件のレビュー
            </span>
            <span style="margin-left: 10px; color: #FF9800;">
              平均評価: ${(reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)}★
            </span>
          </p>
        </div>
        <div style="max-height: 280px; overflow-y: auto; padding-right: 5px;">
          ${reviewsHtml}
        </div>
        <div style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
          <span style="color: #999; font-size: 11px;">📱 上下にスクロールして全てのレビューを確認</span>
        </div>
      </div>
    `;
  };

  return (
    <Box>
      {/* フィルターコントロール */}
      <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
          表示フィルター
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {/* カテゴリーフィルター */}
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>カテゴリー</InputLabel>
              <Select
                value={categoryFilter}
                label="カテゴリー"
                onChange={(e) => setCategoryFilter(e.target.value)}
                size="small"
              >
                <MenuItem value="">すべて</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 検索フィルター */}
            <TextField
              label="店名またはユーザー名で検索"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              size="small"
              sx={{ flexGrow: 1 }}
            />
          </Stack>

          <Box>
            {/* 自分の投稿のみ表示 */}
            <FormControlLabel
              control={
                <Switch
                  checked={showMyReviews}
                  onChange={(e) => setShowMyReviews(e.target.checked)}
                  disabled={!user}
                />
              }
              label="自分の投稿のみ表示"
            />
            
            {/* アクティブフィルターの表示 */}
            <Box sx={{ mt: 1 }}>
              {(categoryFilter || searchFilter || showMyReviews) && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {categoryFilter && (
                    <Chip
                      label={`カテゴリー: ${categoryFilter}`}
                      onDelete={() => setCategoryFilter('')}
                      size="small"
                      color="primary"
                    />
                  )}
                  {searchFilter && (
                    <Chip
                      label={`検索: ${searchFilter}`}
                      onDelete={() => setSearchFilter('')}
                      size="small"
                      color="primary"
                    />
                  )}
                  {showMyReviews && (
                    <Chip
                      label="自分の投稿のみ"
                      onDelete={() => setShowMyReviews(false)}
                      size="small"
                      color="primary"
                    />
                  )}
                </Stack>
              )}
            </Box>
          </Box>
        </Stack>
      </Paper>

      {/* マップ */}
      <Box
        ref={mapRef}
        sx={{
          width: '100%',
          height: '500px',
          borderRadius: 2,
          overflow: 'hidden',
          border: '2px solid #e0e0e0'
        }}
      />

      {/* 統計情報 */}
      <Paper elevation={2} sx={{ p: 2, mt: 2, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          表示中のレビュー数: {getFilteredReviews().length}件 / 全{reviews.length}件
        </Typography>
      </Paper>
    </Box>
  );
}

export default GoogleMap;