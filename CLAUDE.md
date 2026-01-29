# Forest Finder - プロジェクトガイド

## プロジェクト概要

GPSで現在地を取得し、近くの森林を検知して距離を表示するWebアプリケーション。
PWA（Progressive Web App）としてiOS/Androidでもネイティブアプリのように動作。

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
- **データソース**: 国土地理院データ
- **GPS**: Web Geolocation API
- **PWA**: next-pwa / Service Worker

## ディレクトリ構造

```
forest-finder/
├── src/
│   ├── app/              # Next.js App Router
│   │   └── manifest.ts   # PWA マニフェスト
│   ├── components/       # UIコンポーネント
│   ├── hooks/            # カスタムフック
│   ├── lib/              # ユーティリティ関数
│   ├── types/            # TypeScript型定義
│   └── services/         # 外部API連携
├── public/
│   ├── icons/            # PWAアイコン各サイズ
│   └── sw.js             # Service Worker
└── docs/                 # ドキュメント
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

## 注意事項

- GPSは HTTPS 環境でのみ動作
- 国土地理院データは日本国内のみ対応
- iOS/Android両方での動作確認必須

## PWA対応要件

- manifest.json の設定（アプリ名、アイコン、テーマカラー）
- Service Worker の登録（オフラインキャッシュ）
- アイコン各サイズの用意（192x192, 512x512）
- iOS Safari 用メタタグ（apple-touch-icon, apple-mobile-web-app-capable）
- Android インストールプロンプト対応
- スプラッシュスクリーン設定
