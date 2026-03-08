# Forest Finder - プロジェクトガイド

## プロジェクト概要

GPSで現在地を取得し、近くの森林・コンビニ・駅を検知して距離を表示するWebアプリケーション。
PWA（Progressive Web App）としてiOS/Androidでもネイティブアプリのように動作。

**最終更新:** 2026-03-06

## 現在のステータス

- 森林（`/`）、国土数値情報森林（`/kokudo`）、コンビニ（`/konbini`）、駅（`/station`）の4ページ稼働
- AnimatedPolyline（経路アニメーション）実装済み
- 変更は未コミット・未デプロイ

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

## 必須要件：POIデータの住所表示

**すべてのPOIエントリには住所を表示すること。** データソースに関わらず、住所が未設定の場合は国土地理院の逆ジオコーディングAPI（`mreversegeocoder.gsi.go.jp`）で座標から住所を自動取得する。

- **表示箇所**: 地図ポップアップ（Marker Popup）および画面下部の最寄りPOIオーバーレイの両方
- **住所未取得時**: 「住所を取得中...」を表示する
- **実装**: `src/lib/reverseGeocode.ts` で逆ジオコーディング、各検索フックで検索後に自動解決
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

## 次のステップ

- [ ] 変更をコミット＆プッシュ＆デプロイ確認
- [ ] トップページにPOI切り替えタブの追加検討
- [ ] 実機テスト（iOS/Android）
- [ ] コンビニ・駅ページのPWAマニフェスト対応
