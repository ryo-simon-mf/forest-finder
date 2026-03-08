# Forest Finder - プロジェクトガイド

## プロジェクト概要

GPSで現在地を取得し、近くの森林・コンビニ・駅を検知して距離を表示するWebアプリケーション。
PWA（Progressive Web App）としてiOS/Androidでもネイティブアプリのように動作。

**最終更新:** 2026-03-08

## 現在のステータス

- 森林（`/`）、国土数値情報森林（`/kokudo`）、コンビニ（`/konbini`）、駅（`/station`）の4ページ稼働
- AnimatedPolyline（経路アニメーション）実装済み
- OSRMルーティング経路表示実装済み
- 地図UI改善（現在地ボタン、森林マーカー色分け、吹き出し豆知識）実装済み
- GitHub Pages + Cloudflare Pages デプロイ済み

## 対応プラットフォーム

| プラットフォーム | 対応方法 |
|-----------------|---------|
| Web | Chrome, Safari, Firefox, Edge |
| iOS | Safari → ホーム画面に追加でアプリ化 |
| Android | Chrome → インストール可能なPWA |

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **地図ライブラリ**: Leaflet / React-Leaflet
- **データソース**: OpenStreetMap (Overpass API), 国土地理院データ
- **GPS**: Web Geolocation API
- **PWA**: next-pwa / Service Worker
- **デプロイ**: GitHub Pages + Cloudflare Pages（同時デプロイ）

## ディレクトリ構造

```
forest-finder/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # 森林ファインダー（メイン）
│   │   ├── kokudo/       # 国土数値情報版
│   │   ├── konbini/      # コンビニファインダー
│   │   ├── station/      # 駅ファインダー
│   │   └── manifest.ts   # PWA マニフェスト
│   ├── components/       # UIコンポーネント
│   ├── hooks/            # カスタムフック
│   ├── lib/              # ユーティリティ関数
│   ├── types/            # TypeScript型定義
│   └── services/         # 外部API連携
├── public/
│   ├── data/             # POIデータ (JSON)
│   ├── icons/            # PWAアイコン各サイズ
│   └── sw.js             # Service Worker
├── docs/                 # ドキュメント・レポート
├── conversation_summaries/
└── work_logs/
```

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run lint     # ESLint実行
npm run test     # テスト実行
```

## コーディング規約

- コンポーネントは関数コンポーネントで記述
- 型定義は `types/` ディレクトリに集約
- API呼び出しは `services/` ディレクトリに集約
- カスタムフックは `hooks/` ディレクトリに配置

## 環境変数

```
# .env.local
NEXT_PUBLIC_GSI_API_KEY=    # 国土地理院API（必要な場合）
```

## デプロイ設定

- `DEPLOY_TARGET=github` で GitHub Pages 用ビルド（basePath: `/forest-finder`）
- Cloudflare Pages: Framework: None, Build: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`, Output: `out`
- Cloudflare Pages の Preview branch は **None** に設定済み（`gh-pages` ブランチのビルド失敗を防止）
- デプロイ手順:
  1. `git push origin master` → Cloudflare Pages 自動デプロイ
  2. `rm -rf .next && DEPLOY_TARGET=github npm run build` → `npx gh-pages -d out` → GitHub Pages デプロイ

## 必須要件：POIデータの住所表示

**すべてのPOIエントリには住所を表示すること。** データソースに関わらず、住所が未設定の場合は国土地理院の逆ジオコーディングAPI（`mreversegeocoder.gsi.go.jp`）で座標から住所を自動取得する。

- **表示箇所**: 画面下部の最寄りPOIオーバーレイ（マーカーPopupは現在無効化中）
- **住所未取得時**: 「住所取得中...」をLoadingDotsアニメーション付きで表示
- **実装**: `src/lib/reverseGeocode.ts` で逆ジオコーディング、`useForestSearch` の `resolveAddress` で単体オンデマンド解決
- **住所解決方式**: バッチ処理ではなく、表示中の森林（最寄り or ユーザー選択）のみオンデマンドで解決
- **新しいデータソースを追加する際も、住所表示が必ず動作することを確認すること**

## POIタイプ別設定

| POI | ルート | テーマカラー | データファイル | アイコン |
|-----|--------|------------|--------------|---------|
| 森林 | `/` | 緑 `rgba(27, 172, 83, 1)` | `japan-forests.json` | 🌲 |
| 国土森林 | `/kokudo` | 緑 | `kokudo-forests.json` | 🌲 |
| コンビニ | `/konbini` | 青 `rgba(59, 130, 246, 1)` | `konbini-23ku.json` | 🏪 |
| 駅 | `/station` | 赤 `rgba(239, 68, 68, 1)` | `stations-23ku.json` | 🚉 |

## 注意事項

- GPSは HTTPS 環境でのみ動作
- 国土地理院データは日本国内のみ対応
- iOS/Android両方での動作確認必須
- 大容量JSONは `public/data/` に配置し `fetch()` で読み込み（webpack importは使わない）
- Cloudflare Pagesのファイルサイズ上限は25MB

## PWA対応要件

- manifest.json の設定（アプリ名、アイコン、テーマカラー）
- Service Worker の登録（オフラインキャッシュ）
- アイコン各サイズの用意（192x192, 512x512）
- iOS Safari 用メタタグ（apple-touch-icon, apple-mobile-web-app-capable）
- Android インストールプロンプト対応
- スプラッシュスクリーン設定

## 過去に解決した技術課題

### 地図の自動センタリング問題
- **問題**: GPS更新のたびにMapUpdaterが地図をGPS位置にスナップバックし、パン操作が無効化された
- **解決**: MapUpdaterを初回ロードと新ルート表示時のみセンタリングするように変更。「現在地に戻る」ボタンを追加

### ズームインで森林マーカーが消える問題
- **問題**: 検索半径がズームに連動して縮小し、既に発見した森林が消えた
- **解決**: ラチェット方式 `setMapRadius((prev) => Math.max(prev, quantized))` で半径が縮小しないようにした

### パン先の森林が表示されない問題
- **問題**: GPS位置基準の検索のみで、地図をパンした先の森林が表示されなかった
- **解決**: BoundsWatcherの`moveend`イベントで`searchAt`を呼び出し、パン先の森林をマージ追加

### 住所表示が遅い・反映されない問題
- **問題**: (1) バッチ住所解決が全森林を対象にしてAPI過負荷 (2) マージ処理で住所付き森林が上書きされた (3) selectedForestが独立stateで住所更新が反映されなかった
- **解決**:
  1. バッチ→単体オンデマンド方式に変更（`resolveAddress`で1件ずつ解決）
  2. マージ時に`if (!existingMap.has(f.id))`で既存森林を保持
  3. `selectedForestId`（IDのみ保持）→ `forestResult.forests.find()`で最新オブジェクトを参照

### Cloudflare Pages gh-pagesブランチのビルド失敗
- **問題**: `npx gh-pages`がgh-pagesブランチにpush → Cloudflareがビルド試行 → package.jsonなしでエラー
- **解決**: Preview branchを「None」に設定し、masterブランチのみ自動デプロイ

## 地図UI設計メモ

- **現在地ボタン**: MapContainer外にfixed配置（Leafletのoverflow:hiddenを回避するため）
- **マーカーPopup**: 現在コメントアウトで無効化中
- **森林マーカー色**: 最寄り=テーマ緑、それ以外=薄緑 `#8fd4a4`
- **吹き出し（ForestTipBubble）**: 5秒表示/15秒非表示サイクル、シャッフル表示、fade+translateYアニメーション
- **下部カード**: 固定高さ140px、住所は区/市/郡/町/村で改行

## 次のステップ

- [ ] トップページにPOI切り替えタブの追加検討
- [ ] 実機テスト（iOS/Android）
- [ ] コンビニ・駅ページのPWAマニフェスト対応
