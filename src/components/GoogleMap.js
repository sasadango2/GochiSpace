import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { performMapSearch, detectSearchType, getRestaurantReviews } from '../utils/mapSearchUtils';
import { getMutualFollowReviewsByCategory, getAllMutualFollowReviews } from '../utils/mutualFollowReviews';
import { FOOD_CATEGORIES } from '../constants/categories';
import {
  Box,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Avatar,
  Rating,
  Divider
} from '@mui/material';
import { Search, Clear, Restaurant, Person } from '@mui/icons-material';

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
  
  // 新しい検索機能の状態
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('none');
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false); // true: 検索モード, false: レビューモード
  
  // レビュー詳細表示の状態
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRestaurantReviews, setSelectedRestaurantReviews] = useState([]);
  const [selectedRestaurantName, setSelectedRestaurantName] = useState('');
  const [loadingReviews, setLoadingReviews] = useState(false);

  // レビューデータを取得（相互フォローシステム使用）
  const fetchReviews = useCallback(async () => {
    if (!user) {
      setReviews([]);
      return;
    }

    try {
      let reviewsData = [];

      if (showMyReviews) {
        // 自分のレビューのみ表示
        if (categoryFilter) {
          // カテゴリー指定あり
          reviewsData = await getMutualFollowReviewsByCategory(user.uid, categoryFilter);
          // 自分のレビューのみにフィルタリング
          reviewsData = reviewsData.filter(review => review.userId === user.uid);
        } else {
          // 全カテゴリー
          reviewsData = await getAllMutualFollowReviews(user.uid);
          // 自分のレビューのみにフィルタリング
          reviewsData = reviewsData.filter(review => review.userId === user.uid);
        }
      } else {
        // 相互フォローユーザーのレビューを表示
        if (categoryFilter) {
          // カテゴリー指定あり
          reviewsData = await getMutualFollowReviewsByCategory(user.uid, categoryFilter);
        } else {
          // 全カテゴリー
          reviewsData = await getAllMutualFollowReviews(user.uid);
        }
      }

      setReviews(reviewsData);
    } catch (error) {
      console.error('レビュー取得エラー:', error);
      setReviews([]);
    }
  }, [showMyReviews, categoryFilter, user]);

  // 新しい検索機能
  const handleMapSearch = useCallback(async (searchText) => {
    if (!searchText.trim()) {
      setSearchResults([]);
      setSearchType('none');
      setSearchMode(false);
      return;
    }

    if (!user) {
      console.log('検索にはログインが必要です');
      return;
    }

    setIsSearching(true);
    setSearchMode(true);
    
    try {
      const type = detectSearchType(searchText);
      setSearchType(type);
      
      const results = await performMapSearch(searchText, user.uid, {
        category: categoryFilter,
        limit: 100
      });
      
      setSearchResults(results);
      console.log(`検索完了: ${results.length}件の結果`);
    } catch (error) {
      console.error('マップ検索エラー:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [categoryFilter, user]);

  // 検索フィルターの変更を監視
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleMapSearch(searchFilter);
    }, 500); // 500ms のデバウンス

    return () => clearTimeout(timeoutId);
  }, [searchFilter, handleMapSearch]);

  // 検索クリア
  const handleClearSearch = () => {
    setSearchFilter('');
    setSearchResults([]);
    setSearchType('none');
    setSearchMode(false);
  };

  // マーカークリック時の詳細レビュー表示
  const handleMarkerClick = async (restaurantLocation, restaurantName) => {
    if (!user) {
      console.log('ログインが必要です');
      return;
    }

    setLoadingReviews(true);
    setSelectedRestaurantName(restaurantName);
    setReviewDialogOpen(true);

    try {
      const detailedReviews = await getRestaurantReviews(restaurantLocation, user.uid);
      setSelectedRestaurantReviews(Array.isArray(detailedReviews) ? detailedReviews : []);
    } catch (error) {
      console.error('詳細レビュー取得エラー:', error);
      setSelectedRestaurantReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  // レビューダイアログを閉じる
  const handleCloseReviewDialog = () => {
    setReviewDialogOpen(false);
    setSelectedRestaurantReviews([]);
    setSelectedRestaurantName('');
  };

  // マップの初期化
  useEffect(() => {
    // DOM要素の準備を待つために少し遅延を追加
    const initializeMap = () => {
      const loader = new Loader({
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places']
      });

      loader.load().then(() => {
      //geolocationで現在地を取得
      navigator.geolocation.getCurrentPosition(position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // mapRef.currentがnullでないことと、DOM要素が準備されていることを確認
        if (mapRef.current && mapRef.current instanceof HTMLElement) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            center: { lat: userLat, lng: userLng },
            zoom: 10,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ]
          });
          setMap(mapInstance);
        } else {
          console.error('Map container not found');
        }
      }, error => {
        console.error('Geolocation error:', error);
        // geolocationが失敗した場合のデフォルト位置（東京）
        if (mapRef.current && mapRef.current instanceof HTMLElement) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            center: { lat: 35.6762, lng: 139.6503 }, // 東京駅
            zoom: 10,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ]
          });
          setMap(mapInstance);
        }
      });
    }).catch(error => {
      console.error('Google Maps API読み込みエラー:', error);
    });
    };

    // DOM要素が準備されるまで少し待つ
    setTimeout(initializeMap, 100);
  }, []);

  // レビューデータの初期取得
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // フィルタリングされたレビューを取得
  const getFilteredReviews = useCallback(() => {
    return reviews.filter(review => {
      // 検索フィルター（店名、ユーザー表示名）のみ
      // カテゴリーフィルタリングは既にfetchReviews()で行われている
      if (searchFilter) {
        const searchLower = searchFilter.toLowerCase();
        const matchesRestaurant = review.restaurantName?.toLowerCase().includes(searchLower);
        const matchesUserName = review.userDisplayName?.toLowerCase().includes(searchLower);
        if (!matchesRestaurant && !matchesUserName) {
          return false;
        }
      }
      
      return true;
    });
  }, [reviews, searchFilter]);

  // マーカーを更新（検索結果または通常のレビューを表示）
  useEffect(() => {
    if (!map) return;

    // 既存のマーカーを削除
    markers.forEach(marker => marker.setMap(null));
    const newMarkers = [];

    if (searchMode && searchResults.length > 0) {
      // 検索モード: 検索結果をマーカー表示
      searchResults.forEach((result, index) => {
        if (result.location) {
          const marker = new window.google.maps.Marker({
            position: result.location,
            map: map,
            title: result.name,
            icon: {
              url: searchType === 'user' 
                ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FF5722">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                `)
                : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FF5722">
                    <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
                  </svg>
                `),
              scaledSize: new window.google.maps.Size(32, 32)
            }
          });

          // 情報ウィンドウを作成
          const infoContent = searchType === 'user' 
            ? `
              <div style="padding: 8px; max-width: 300px;">
                <h3 style="margin: 0 0 8px 0; color: #FF5722;">${result.name}</h3>
                <p style="margin: 4px 0; color: #666;">カテゴリ: ${result.category}</p>
                <p style="margin: 4px 0; color: #666;">レビュー数: ${result.reviewCount}件</p>
                <p style="margin: 4px 0; color: #666;">レビューユーザー: ${result.reviewUsers.join(', ')}</p>
                ${result.address ? `<p style="margin: 4px 0; color: #666;">住所: ${result.address}</p>` : ''}
              </div>
            `
            : `
              <div style="padding: 8px; max-width: 300px;">
                <h3 style="margin: 0 0 8px 0; color: #FF5722;">${result.name}</h3>
                <p style="margin: 4px 0; color: #666;">カテゴリ: ${result.category}</p>
                ${result.address ? `<p style="margin: 4px 0; color: #666;">住所: ${result.address}</p>` : ''}
                ${result.description ? `<p style="margin: 4px 0; color: #666;">${result.description}</p>` : ''}
              </div>
            `;

          const infoWindow = new window.google.maps.InfoWindow({
            content: infoContent
          });

          marker.addListener('click', () => {
            if (selectedMarker) {
              selectedMarker.infoWindow.close();
            }
            infoWindow.open(map, marker);
            setSelectedMarker({ marker, infoWindow });
            
            // 詳細レビューを表示
            handleMarkerClick(result.location, result.name);
          });

          newMarkers.push(marker);
        }
      });
    } else {
      // 通常モード: レビューをマーカー表示
      const filteredReviews = getFilteredReviews();
      
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
          selectedMarker.infoWindow?.close();
        }
        infoWindow.open(map, marker);
        setSelectedMarker({ marker, infoWindow });
        
        // 詳細レビューを表示
        handleMarkerClick(group.location, group.restaurantName);
      });

        newMarkers.push(marker);
      });
    }

    setMarkers(newMarkers);
    // markersは状態更新の結果なので依存配列に含めない（無限ループ防止）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, searchMode, searchResults, searchType, selectedMarker, getFilteredReviews]);

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
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* フィルターコントロール */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
          backdropFilter: 'blur(10px)',
          borderRadius: { xs: 2, sm: 3 },
          border: '1px solid rgba(102, 126, 234, 0.2)',
          p: { xs: 1.5, sm: 2 },
          mb: { xs: 1, sm: 1.5 },
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.15)',
          flexShrink: 0
        }}
      >
        <Stack spacing={{ xs: 1, sm: 1.5 }}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 1, sm: 2 }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            {/* カテゴリーフィルター */}
            <FormControl sx={{ minWidth: { xs: '100%', sm: 180 } }}>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                size="small"
                displayEmpty
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: 2,
                  '& .MuiSelect-select': {
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    border: '2px solid rgba(102, 126, 234, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    border: '2px solid rgba(102, 126, 234, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    border: '2px solid #667eea',
                  }
                }}
              >
                <MenuItem value="" sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>
                  🍽️ すべてのカテゴリー
                </MenuItem>
                {FOOD_CATEGORIES?.map((cat) => (
                  <MenuItem key={cat} value={cat} sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>
                    🏷️ {cat}
                  </MenuItem>
                )) || []}
              </Select>
            </FormControl>

            {/* 検索フィルター */}
            <Box sx={{ position: 'relative', flexGrow: 1 }}>
              <TextField
                placeholder="🔍 店名・ユーザー名で検索（@でユーザー検索）"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 2,
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    '& fieldset': {
                      border: '2px solid rgba(102, 126, 234, 0.3)',
                    },
                    '&:hover fieldset': {
                      border: '2px solid rgba(102, 126, 234, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      border: '2px solid #667eea',
                    }
                  },
                  '& .MuiInputBase-input': {
                    py: 1,
                    fontSize: { xs: '0.8rem', sm: '0.9rem' }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <Tooltip title={
                      searchType === 'user' ? 'ユーザー検索中' : 
                      searchType === 'restaurant' ? '飲食店検索中' : 
                      '検索タイプ'
                    }>
                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                        {searchType === 'user' ? 
                          <Person sx={{ color: '#667eea', fontSize: 18 }} /> : 
                         searchType === 'restaurant' ? 
                          <Restaurant sx={{ color: '#FE6B8B', fontSize: 18 }} /> : 
                          <Search sx={{ color: '#999', fontSize: 18 }} />}
                      </Box>
                    </Tooltip>
                  ),
                  endAdornment: searchFilter && (
                    <Tooltip title="検索をクリア">
                      <IconButton
                        size="small"
                        onClick={handleClearSearch}
                        sx={{ 
                          mr: -1,
                          color: '#667eea',
                          '&:hover': { backgroundColor: 'rgba(102, 126, 234, 0.1)' }
                        }}
                      >
                        <Clear fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )
                }}
              />
              
              {/* 検索状態の表示 */}
              {isSearching && (
                <Box sx={{ 
                  mt: 0.5, 
                  p: 0.5, 
                  borderRadius: 1, 
                  backgroundColor: 'rgba(102, 126, 234, 0.1)',
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#667eea', 
                      fontWeight: 500,
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }}
                  >
                    🔄 検索中...
                  </Typography>
                </Box>
              )}
              
              {searchMode && !isSearching && (
                <Box sx={{ 
                  mt: 0.5, 
                  p: 0.5, 
                  borderRadius: 1, 
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  border: '1px solid rgba(76, 175, 80, 0.3)'
                }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#4caf50', 
                      fontWeight: 500,
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }}
                  >
                    ✅ {searchType === 'user' ? 'ユーザーレビュー' : '飲食店'}: {searchResults.length}件見つかりました
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>

          {/* 自分の投稿のみ表示とアクティブフィルター */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 1, sm: 2 }} 
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={showMyReviews}
                  onChange={(e) => setShowMyReviews(e.target.checked)}
                  disabled={!user}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#667eea',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#667eea',
                    },
                  }}
                />
              }
              label={
                <Typography sx={{ 
                  fontSize: { xs: '0.8rem', sm: '0.9rem' },
                  fontWeight: 500,
                  color: '#333'
                }}>
                  👤 自分の投稿のみ
                </Typography>
              }
            />
            
            {/* アクティブフィルターの表示 */}
            {(categoryFilter || searchFilter || showMyReviews || searchMode) && (
              <Box sx={{ 
                flex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                alignItems: 'center'
              }}>
                {searchMode && (
                  <Chip
                    label={`${searchType === 'user' ? '👤' : '🍽️'} ${searchResults.length}件`}
                    onDelete={handleClearSearch}
                    size="small"
                    sx={{
                      background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                      color: 'white',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.8)' }
                    }}
                  />
                )}
                {categoryFilter && (
                  <Chip
                    label={`🏷️ ${categoryFilter}`}
                    onDelete={() => setCategoryFilter('')}
                    size="small"
                    sx={{
                      background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                      color: 'white',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.8)' }
                    }}
                  />
                )}
                {searchFilter && !searchMode && (
                  <Chip
                    label={`🔍 ${searchFilter}`}
                    onDelete={() => setSearchFilter('')}
                    size="small"
                    sx={{
                      background: 'linear-gradient(45deg, #4caf50 30%, #8bc34a 90%)',
                      color: 'white',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.8)' }
                    }}
                  />
                )}
              </Box>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* マップ */}
      <Box
        id="google-map-container"
        ref={mapRef}
        sx={{
          width: '100%',
          flex: 1,
          minHeight: { xs: '300px', sm: '400px' },
          borderRadius: { xs: 1, sm: 2 },
          overflow: 'hidden',
          border: { xs: '1px solid #e0e0e0', sm: '2px solid #e0e0e0' },
          touchAction: 'manipulation' // モバイルタッチ最適化
        }}
      />

      {/* 統計情報 */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(102, 126, 234, 0.15)',
        borderRadius: { xs: 1.5, sm: 2 },
        p: { xs: 1, sm: 1.5 }, 
        mt: { xs: 0.5, sm: 1 },
        textAlign: 'center',
        flexShrink: 0
      }}>
        <Typography 
          variant="body2" 
          sx={{
            fontSize: { xs: '0.75rem', sm: '0.85rem' },
            fontWeight: 500,
            color: '#667eea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}
        >
          📊 表示中: {getFilteredReviews().length}件 / 全{reviews.length}件のレビュー
        </Typography>
      </Box>

      {/* レビュー詳細ダイアログ */}
      <Dialog
        open={reviewDialogOpen}
        onClose={handleCloseReviewDialog}
        maxWidth="md"
        fullWidth
        fullScreen={{ xs: true, sm: false }}
        PaperProps={{
          sx: { 
            maxHeight: { xs: '100vh', sm: '80vh' },
            m: { xs: 0, sm: 1 },
            borderRadius: { xs: 0, sm: 2 }
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Restaurant color="primary" />
            <Typography variant="h6" component="span">
              {selectedRestaurantName}
            </Typography>
            <Chip 
              label={`${selectedRestaurantReviews?.length || 0}件のレビュー`} 
              size="small" 
              color="primary" 
            />
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {loadingReviews ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <Typography>レビューを読み込み中...</Typography>
            </Box>
          ) : !selectedRestaurantReviews || selectedRestaurantReviews.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Typography color="text.secondary">
                相互フォローユーザーのレビューがありません
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {selectedRestaurantReviews?.map((review, index) => (
                <Paper key={review.id} elevation={1} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {(review.userDisplayName || review.userEmail || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {review.userDisplayName || review.userEmail || 'ユーザー'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {review.createdAt?.toDate?.()?.toLocaleDateString() || '日付不明'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Rating value={review.rating || 0} precision={1} readOnly size="small" />
                        <Typography variant="body2" color="text.secondary">
                          ({review.rating || 0}/5)
                        </Typography>
                        {review.category && (
                          <Chip label={review.category} size="small" variant="outlined" />
                        )}
                      </Box>
                      
                      {review.comment && (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {review.comment}
                        </Typography>
                      )}
                      
                      {review.restaurantAddress && (
                        <Typography variant="caption" color="text.secondary">
                          📍 {review.restaurantAddress}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  
                  {index < (selectedRestaurantReviews?.length || 0) - 1 && (
                    <Divider sx={{ mt: 2 }} />
                  )}
                </Paper>
              )) || []}
            </Stack>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseReviewDialog} variant="contained">
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GoogleMap;