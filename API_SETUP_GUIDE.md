# Google Places API (New) 設定ガイド

## 🚨 **重要**: Legacy Places APIから新しいAPIへの移行が必要

現在のエラー: "You're calling a legacy API, which is not enabled for your project"

## 📋 **必要な設定手順**

### 1. Google Cloud Console での API有効化

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクト「gochispace-4a3c1」を選択
3. 左側メニューから「APIとサービス」→「ライブラリ」をクリック
4. 以下のAPIを検索して有効化：
   - **Places API (New)** ✅ **← これが最重要**
   - Maps JavaScript API（既に有効化済み）
   - Geocoding API（オプション）

### 2. APIキーの権限確認

1. 「APIとサービス」→「認証情報」をクリック
2. 現在のAPIキー「AIzaSyD85fm5G3UXqifxJqNXEm3Heafwogwhuqc」をクリック
3. 「APIの制限」セクションで以下が有効になっているか確認：
   - ✅ Places API (New)
   - ✅ Maps JavaScript API

### 3. 課金アカウントの確認

新しいPlaces API (New)は課金対象です：
- [課金](https://console.cloud.google.com/billing) ページで有効なクレジットカードが登録されているか確認
- 無料クレジット ($300) または有効な支払い方法が必要

## 🔧 **コード変更内容**

Legacy Places APIから新しいAPIに変更：

**Before (Legacy):**
```javascript
const service = new window.google.maps.places.PlacesService(map);
service.textSearch(request, callback);
```

**After (New API):**
```javascript
const { Place } = await window.google.maps.importLibrary("places");
const { places } = await Place.searchByText(request);
```

## 📊 **API料金について**

- **Text Search (New)**: $32/1000リクエスト
- **月額無料枠**: $200相当（新規ユーザー）
- **開発用途**: 1日50-100リクエスト程度なら無料枠内

## 🔗 **参考リンク**

- [Places API (New) 公式ドキュメント](https://developers.google.com/maps/documentation/places/web-service/overview)
- [料金ページ](https://developers.google.com/maps/billing/gmp-billing)
- [マイグレーションガイド](https://developers.google.com/maps/deprecations)

## ⚠️ **注意事項**

1. Legacy Places APIは2024年末に完全廃止予定
2. 新しいAPIは高精度だが、わずかに料金が高い
3. APIキー設定後、反映まで数分かかる場合があります

## 🧪 **テスト手順**

1. 上記設定完了後、アプリを再読み込み
2. 「渋谷 カフェ」で検索テスト
3. Console で「新しいPlaces APIで検索開始」ログを確認
4. エラーが解消されているか確認
