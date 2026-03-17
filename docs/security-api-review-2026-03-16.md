# forest-finder セキュリティ・API利用規約レビュー

**対象:** https://github.com/ryo-simon-mf/forest-finder
**レビュー日:** 2026-03-16
**ステータス:** レビュー完了・対応未着手

---

## 総合評価

現時点で直ちに重大インシデントが起きるリスクは低い。`output: 'export'` による静的エクスポート構成のため、サーバー側の認証不備・DB流出・APIキー窃取・任意コード実行といった攻撃面はかなり小さい。

ただし、**位置情報の第三者送信**、**公開APIの利用制限**、**basemapの商用ライセンス**の3点は、運用拡大時に問題化しうるため対応が必要。

---

## TODO一覧

### 優先度: 高

| # | 項目 | 詳細 | 対象ファイル |
|---|------|------|------------|
| 1 | CARTO basemap の利用確認・置換 | `/classic`（Leaflet版）で CARTO `light_all` をデフォルト使用。CARTO は商用利用に Enterprise ライセンスが必要。メインページ（`/`）は OpenFreeMap 使用で問題なし。 | `src/components/Map.tsx` |
| 2 | routing.openstreetmap.de の本番依存脱却 | 1 req/sec 制限、サーバーログにルート要求が保存される旨を明記、重負荷禁止。多ユーザー利用時に規約抵触リスク。自前 OSRM インスタンスまたは有償ルーティング API への移行を検討。 | `src/services/osrmService.ts` |
| 3 | 位置情報の第三者送信の明示 | 国土地理院（逆ジオコーディング）・OSRM（ルーティング）にユーザーの座標が送信される。初回許可 UI またはプライバシーポリシーで送信先・目的を明記すべき。 | `src/components/LocationPermission.tsx`, `src/lib/reverseGeocode.ts`, `src/services/osrmService.ts` |

### 優先度: 中

| # | 項目 | 詳細 | 対象ファイル |
|---|------|------|------------|
| 4 | 外部 API スロットリング強化 | ルート再計算は 100m 移動ごとにトリガーされる。OSRM の 1 req/sec 制限に対し、クールダウン/デバウンスの追加を検討。逆ジオコーディングの頻度制御も確認。 | `src/hooks/useRoute.ts`, `src/lib/reverseGeocode.ts` |
| 5 | Attribution 常時可視化の確認 | OSM / OpenFreeMap / OpenMapTiles 等のクレジットが、3D/2D 切替・画面遷移時にも常に表示されているか確認。OSM タイル利用ポリシーは「見える場所」への表示を要求。 | `src/components/MapLibre3DViewer.tsx`, `src/app/3d-2d/page.tsx` |
| 6 | 依存パッケージ監査の CI 導入 | 現状の GitHub Actions ワークフローは build/deploy 中心。Dependabot または `npm audit` をワークフローに追加し、脆弱性の自動検知を行う。 | `.github/workflows/deploy.yml` |

### 優先度: 低（現状問題なし）

| # | 項目 | 状況 |
|---|------|------|
| 7 | 秘密情報のコミット | `.gitignore` で `.env*.local` を除外済み。公開環境変数は `NEXT_PUBLIC_BASE_PATH` のみ。APIキー露出なし。 |
| 8 | Overpass API 利用 | バッチ生成スクリプト（`scripts/fetch-japan-forests.mjs`）でのみ使用。本番クライアントからの直接呼び出しはなし。5秒待機・リトライ実装あり。 |
| 9 | Next.js 脆弱性 | `next@14.2.35` は DoS 修正版。React Flight 関連の重大脆弱性は 15.x/16.x 系が対象で、14.2.35 は対象外。 |

---

## API・データソース別 規約チェック

### 1. OpenStreetMap 公式タイル

- **使用箇所:** `src/components/Map.tsx`（Leaflet版）
- **ポリシー:** https://operations.osmfoundation.org/policies/tiles/
- **要求事項:** 正しい URL、見える形のライセンス表示、有効な User-Agent/Referer、ローカルキャッシュ、大量プリフェッチ禁止
- **現状:** Attribution 表示あり。PWA/Service Worker でのタイルキャッシュを今後入れる場合はポリシー確認必要。

### 2. Overpass API

- **使用箇所:** `scripts/fetch-japan-forests.mjs`（バッチ生成のみ）
- **ポリシー:** https://wiki.openstreetmap.org/wiki/Overpass_API
- **要求事項:** 1日1万クエリ・1GB未満目安、一般公開アプリのバックエンドは自前インスタンス推奨
- **現状:** バッチ用途のみで問題なし。全国データ再生成を頻繁に回す場合は注意。

### 3. 国土地理院タイル・逆ジオコーディング

- **使用箇所:** `src/lib/reverseGeocode.ts`
- **ポリシー:** https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html
- **要求事項:** 出典表示
- **現状:** クレジット表示あり。位置情報送信の旨をユーザーに明示すべき。

### 4. routing.openstreetmap.de (OSRM)

- **使用箇所:** `src/services/osrmService.ts`
- **ポリシー:** https://routing.openstreetmap.de/about.html
- **要求事項:** Attribution 表示、有効な User-Agent/Referrer、最大 1 req/sec、スクレイピング・重負荷禁止、リクエストはサーバーログに保存
- **現状:** Attribution 表示あり。多ユーザー利用・頻繁な再計算で制限抵触の可能性あり。**本番運用には自前インスタンスを推奨。**

### 5. CARTO basemap

- **使用箇所:** `src/components/Map.tsx`（`/classic` Leaflet版）
- **ポリシー:** https://carto.com/basemaps
- **要求事項:** 商用利用は Enterprise ライセンスが必要
- **現状:** `/classic` でデフォルト使用中。**商用公開する場合は最優先で対応が必要。**

### 6. OpenFreeMap

- **使用箇所:** `src/components/MapLibre3DViewer.tsx`（メインページ）
- **ポリシー:** APIキー不要、無料利用可
- **現状:** 問題なし。

---

## 依存パッケージ

- `next@14.2.35`: DoS 修正済みバージョン（GHSA-5j59-xgg2-r9c4 の修正版）
- React Flight 関連脆弱性（GHSA-9qr9-h5gf-34mp）: 15.x/16.x 系対象、14.2.35 は対象外
- **注意:** 完全な SCA（Software Composition Analysis）は未実施。`npm audit` / lockfile 全件照合は別途必要。

---

## 対応方針案

### 商用・多ユーザー展開を行う場合

1. CARTO basemap を `/classic` から除去し、OpenFreeMap または国土地理院タイルに統一
2. OSRM を自前インスタンスまたは有償 API（Mapbox Directions 等）に移行
3. プライバシーポリシーを作成し、位置情報の第三者送信先を明記
4. API 呼び出しにレートリミット/クールダウンを追加
5. CI に `npm audit` / Dependabot を導入

### 個人利用・小規模公開のまま継続する場合

1. CARTO basemap の利用状況を確認（`/classic` を公開停止するか検討）
2. プライバシーポリシーまたは初回 UI に位置情報送信の旨を簡潔に記載
3. OSRM 呼び出しにデバウンス/クールダウンを追加（最低限）
