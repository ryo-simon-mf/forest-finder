# 作業ログ - Forest Finder

## 2026-01-29

### Phase 1: 環境構築
- Next.js 14 + TypeScript + Tailwind CSS プロジェクト初期化
- ESLint + Prettier 設定
- ディレクトリ構造作成（components, hooks, lib, types, services）

### Phase 2: PWA基盤構築
- next-pwa パッケージ導入
- manifest.ts 作成（アプリ名、テーマカラー等）
- PWAアイコン生成スクリプト作成（192x192, 512x512, apple-touch-icon）
- iOS Safari用メタタグ追加（layout.tsx）
- Service Worker 自動生成設定

### Phase 3: GPS機能実装
- `useGeolocation` カスタムフック作成
- Geolocation API による現在地取得
- 位置情報許可UI（LocationPermission コンポーネント）
- エラーハンドリング（拒否/タイムアウト/取得不可）
- watchPosition による継続的な位置追跡

### Phase 4: 地図表示
- Leaflet / React-Leaflet 導入
- 国土地理院タイル表示
- 現在地マーカー（青い円）
- 動的インポートによるSSR回避（MapWrapper）

### Phase 5: 森林データ取得
- OpenStreetMap (Overpass API) から東京都の森林データ取得
- 取得条件: `landuse=forest`, `natural=wood`
- 東京都を5地域に分割してAPI負荷軽減
- CSVファイルとして保存（6,663件）
- 逆ジオコーディングで住所追加（国土地理院API）
  - 200ms間隔でAPI呼び出し（負荷軽減）
  - 100件ごとに進捗保存（中断対応）
  - 住所取得成功: 6,659件
- JSONに変換してアプリに組み込み

### Phase 6: 距離計算
- Haversine式による2点間距離計算
- km/m 自動切り替え表示
- 最寄り森林の検出・表示

### 追加機能
- 地図スタイル切替（水彩/ダーク/標準/淡色）
- 森林マーカーに住所表示
- 最寄り森林マーカーを強調表示（黄色ボーダー）

---

## 2026-02-04

### GitHub Pages デプロイ
- GitHub CLI（gh）をインストール
- リポジトリ作成: https://github.com/ryo-simon-mf/forest-finder
- Next.js 静的エクスポート設定（`output: 'export'`）
- GitHub Actions ワークフロー作成（自動デプロイ）
- 公開URL: https://ryo-simon-mf.github.io/forest-finder/

### 地図タイル修正
- Stadia Maps が認証エラー（401）を出したため変更
- 認証不要のタイルに置き換え:
  - 国土地理院（標準・淡色）
  - OpenStreetMap
  - CARTO（ダーク）

### コンパス機能（スマホの向き表示）
- Device Orientation API でコンパス方位を取得
- `useDeviceOrientation` カスタムフック作成
- 現在地マーカーに視野範囲（扇形）を表示
- iOS用のコンパス許可ボタン追加
- Android: `deviceorientationabsolute` イベントを優先使用
- 方角デバッグ表示（🧭 XX°）

---

## ファイル構成

```
forest-finder/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # PWAメタタグ
│   │   ├── manifest.ts     # PWAマニフェスト
│   │   └── page.tsx        # メインページ
│   ├── components/
│   │   ├── LocationPermission.tsx  # 位置情報許可UI
│   │   ├── LocationDisplay.tsx     # 位置情報表示
│   │   ├── Map.tsx                 # 地図コンポーネント
│   │   └── MapWrapper.tsx          # 動的インポートラッパー
│   ├── hooks/
│   │   ├── useGeolocation.ts       # GPS取得フック
│   │   ├── useForestSearch.ts      # 森林検索フック
│   │   └── useDeviceOrientation.ts # コンパス方位取得フック
│   ├── lib/
│   │   └── distance.ts             # 距離計算ユーティリティ
│   ├── services/
│   │   ├── forestService.ts        # Overpass API（未使用）
│   │   └── localForestService.ts   # ローカルデータ検索
│   ├── types/
│   │   ├── geolocation.ts          # 位置情報型定義
│   │   └── forest.ts               # 森林データ型定義
│   └── data/
│       └── tokyo-forests.json      # 東京都森林データ
├── data/
│   ├── tokyo-forests.csv                # 元データ
│   └── tokyo-forests-with-address.csv   # 住所付きデータ
├── scripts/
│   ├── generate-icons.mjs          # PWAアイコン生成
│   ├── fetch-tokyo-forests.mjs     # 森林データ取得
│   ├── fetch-addresses.mjs         # 住所取得
│   └── csv-to-json.mjs             # CSV→JSON変換
└── public/
    └── icons/                      # PWAアイコン
```

---

## Git コミット履歴

```
34c73d3 fix: 方角のずれを修正・デバッグ表示追加
9f422cc fix: 方向表示を見やすく改善
58f7dc1 feat: スマホの向きを地図に反映する機能を追加
4fb176e fix: 地図タイルを認証不要のものに変更
2854270 ci: GitHub Pages デプロイ設定
470c298 docs: Phase 11 AR機能をTODOに追加
1d9ad26 docs: 作業ログを追加
59ba78c Phase 5-6: 森林データ・距離計算・地図スタイル切替
8904e1a Phase 4: 地図表示機能の実装
87307a4 Phase 1-4: 環境構築、PWA、GPS、地図表示まで実装
```

---

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 地図 | Leaflet / React-Leaflet |
| 地図タイル | 国土地理院 / OpenStreetMap / CARTO |
| PWA | next-pwa |
| 森林データ | OpenStreetMap (Overpass API) |
| 住所データ | 国土地理院 逆ジオコーディングAPI |
| コンパス | Device Orientation API |
| デプロイ | GitHub Pages + GitHub Actions |

---

## 残タスク

- [ ] Phase 7: UI/UX改善
- [ ] Phase 8: オフライン対応
- [ ] Phase 9: テスト・最適化
- [x] Phase 10: デプロイ（GitHub Pages）
- [ ] Phase 11: AR機能
- [ ] 他県の森林データ追加（神奈川、埼玉、千葉など）
- [ ] コンパス方角のずれ調査・修正
