/**
 * 日本全国の森林データを取得してJSONに保存するスクリプト
 * データソース: OpenStreetMap (Overpass API)
 *
 * 使い方:
 *   node scripts/fetch-japan-forests.mjs
 *
 * 中断しても再実行すれば途中から再開します。
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'
const DATA_DIR = join(__dirname, '../data')
const PROGRESS_PATH = join(DATA_DIR, 'japan-forests-progress.json')
const OUTPUT_JSON = join(__dirname, '../src/data/japan-forests.json')

// リクエスト間隔（ミリ秒）- Overpass API 負荷軽減
const REQUEST_INTERVAL = 5000
// リトライ時の待機（ミリ秒）
const RETRY_WAIT = 30000
const MAX_RETRIES = 3

/**
 * 日本全国を地方ブロック × サブエリアに分割
 * 各エリアは bbox: 'south,west,north,east' 形式
 *
 * 面積が広いエリアはさらに分割してタイムアウトを防止
 */
const REGIONS = [
  // === 北海道 ===
  { name: '北海道-道南', bbox: '41.3,139.3,42.5,141.0' },
  { name: '北海道-道央西', bbox: '42.5,139.3,43.5,142.0' },
  { name: '北海道-道央東', bbox: '42.5,142.0,43.5,145.5' },
  { name: '北海道-道北西', bbox: '43.5,139.3,45.6,142.5' },
  { name: '北海道-道北東', bbox: '43.5,142.5,45.6,145.9' },

  // === 東北 ===
  { name: '青森', bbox: '40.2,139.4,41.6,141.7' },
  { name: '岩手', bbox: '38.7,139.0,40.5,142.1' },
  { name: '秋田', bbox: '39.0,139.5,40.5,140.7' },
  { name: '宮城', bbox: '37.7,140.2,39.0,141.7' },
  { name: '山形', bbox: '37.7,139.5,39.2,140.5' },
  { name: '福島', bbox: '36.8,139.1,38.0,141.1' },

  // === 関東 ===
  { name: '茨城', bbox: '35.7,139.6,36.9,140.9' },
  { name: '栃木', bbox: '36.2,139.3,37.2,140.3' },
  { name: '群馬', bbox: '36.0,138.4,37.1,139.7' },
  { name: '埼玉', bbox: '35.7,138.7,36.3,139.9' },
  { name: '千葉', bbox: '34.9,139.7,36.0,140.9' },
  { name: '東京', bbox: '35.5,138.8,35.9,139.9' },
  { name: '神奈川', bbox: '35.1,138.9,35.7,139.8' },

  // === 中部 ===
  { name: '新潟-上越', bbox: '36.7,137.5,37.5,139.0' },
  { name: '新潟-中下越', bbox: '37.5,138.5,38.6,140.0' },
  { name: '富山', bbox: '36.2,136.7,37.0,137.8' },
  { name: '石川', bbox: '36.0,136.2,37.9,137.4' },
  { name: '福井', bbox: '35.5,135.5,36.3,136.9' },
  { name: '山梨', bbox: '35.2,138.1,35.9,139.2' },
  { name: '長野-北', bbox: '36.2,137.5,37.0,138.8' },
  { name: '長野-南', bbox: '35.2,137.5,36.2,138.7' },
  { name: '岐阜', bbox: '35.1,136.2,36.5,137.7' },
  { name: '静岡', bbox: '34.5,137.4,35.5,139.2' },
  { name: '愛知', bbox: '34.5,136.6,35.4,137.8' },

  // === 近畿 ===
  { name: '三重', bbox: '33.7,135.8,35.2,137.0' },
  { name: '滋賀', bbox: '34.7,135.7,35.7,136.5' },
  { name: '京都', bbox: '34.7,134.8,35.8,136.1' },
  { name: '大阪', bbox: '34.2,135.0,35.0,135.8' },
  { name: '兵庫-南', bbox: '34.2,134.2,35.0,135.5' },
  { name: '兵庫-北', bbox: '35.0,134.2,35.7,135.5' },
  { name: '奈良', bbox: '33.8,135.5,34.8,136.2' },
  { name: '和歌山', bbox: '33.4,135.0,34.4,136.0' },

  // === 中国 ===
  { name: '鳥取', bbox: '35.0,133.1,35.7,134.5' },
  { name: '島根', bbox: '34.3,131.6,36.4,133.4' },
  { name: '岡山', bbox: '34.3,133.3,35.4,134.4' },
  { name: '広島', bbox: '34.0,132.0,35.0,133.5' },
  { name: '山口', bbox: '33.7,130.8,34.8,132.2' },

  // === 四国 ===
  { name: '徳島', bbox: '33.5,133.5,34.3,134.8' },
  { name: '香川', bbox: '34.0,133.4,34.6,134.5' },
  { name: '愛媛', bbox: '32.9,132.0,34.2,133.7' },
  { name: '高知', bbox: '32.7,132.4,33.9,134.3' },

  // === 九州 ===
  { name: '福岡', bbox: '33.0,130.0,34.0,131.2' },
  { name: '佐賀', bbox: '32.9,129.7,33.6,130.6' },
  { name: '長崎', bbox: '32.5,128.5,34.7,130.3' },
  { name: '熊本', bbox: '32.0,130.0,33.3,131.3' },
  { name: '大分', bbox: '32.7,130.8,33.8,132.1' },
  { name: '宮崎', bbox: '31.3,130.6,32.8,131.9' },
  { name: '鹿児島-本土', bbox: '30.9,129.9,32.3,131.3' },
  { name: '鹿児島-離島', bbox: '27.0,128.0,30.9,131.5' },

  // === 沖縄 ===
  { name: '沖縄-本島', bbox: '26.0,127.0,27.0,128.3' },
  { name: '沖縄-先島', bbox: '24.0,122.9,25.5,126.0' },

  // === 離島 ===
  { name: '東京-伊豆諸島', bbox: '33.0,139.0,35.0,140.5' },
  { name: '東京-小笠原', bbox: '24.0,141.0,28.0,143.0' },
]

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadProgress() {
  try {
    if (existsSync(PROGRESS_PATH)) {
      return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'))
    }
  } catch (e) {
    // ignore
  }
  return { completedRegions: [], elements: [] }
}

function saveProgress(progress) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress), 'utf-8')
}

async function fetchRegion(bbox, regionName) {
  const query = `
    [out:json][timeout:120];
    (
      way["landuse"="forest"](${bbox});
      way["natural"="wood"](${bbox});
      relation["landuse"="forest"](${bbox});
      relation["natural"="wood"](${bbox});
    );
    out center tags;
  `

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })

      if (response.status === 429 || response.status === 504) {
        const wait = RETRY_WAIT * attempt
        console.log(`  ⏳ ${regionName}: ${response.status} - ${wait / 1000}秒待機後リトライ (${attempt}/${MAX_RETRIES})`)
        await sleep(wait)
        continue
      }

      if (!response.ok) {
        console.log(`  ⚠ ${regionName}: HTTP ${response.status}`)
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_WAIT)
          continue
        }
        return []
      }

      const data = await response.json()
      return data.elements || []
    } catch (error) {
      console.log(`  ⚠ ${regionName}: ${error.message}`)
      if (attempt < MAX_RETRIES) {
        const wait = RETRY_WAIT * attempt
        console.log(`  ⏳ ${wait / 1000}秒待機後リトライ (${attempt}/${MAX_RETRIES})`)
        await sleep(wait)
        continue
      }
      return []
    }
  }
  return []
}

function parseElement(element) {
  let lat, lon

  if (element.center) {
    lat = element.center.lat
    lon = element.center.lon
  } else if (element.lat && element.lon) {
    lat = element.lat
    lon = element.lon
  } else {
    return null
  }

  const tags = element.tags || {}
  return {
    id: `${element.type}-${element.id}`,
    name: tags.name || '',
    latitude: Math.round(lat * 1000000) / 1000000,
    longitude: Math.round(lon * 1000000) / 1000000,
    address: '',
  }
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true })

  console.log('=== 日本全国 森林データ取得（OSM Overpass API）===\n')
  console.log(`リージョン数: ${REGIONS.length}`)
  console.log(`リクエスト間隔: ${REQUEST_INTERVAL / 1000}秒`)
  console.log(`推定所要時間: ${Math.round((REGIONS.length * REQUEST_INTERVAL) / 1000 / 60)}分（リトライなしの場合）\n`)

  const progress = loadProgress()
  const completedSet = new Set(progress.completedRegions)
  let allElements = [...progress.elements]

  const remaining = REGIONS.filter((r) => !completedSet.has(r.name))

  if (remaining.length < REGIONS.length) {
    console.log(`前回の続きから再開: ${REGIONS.length - remaining.length}/${REGIONS.length} 完了済み`)
    console.log(`取得済みデータ: ${allElements.length}件\n`)
  }

  for (let i = 0; i < remaining.length; i++) {
    const region = remaining[i]
    const total = REGIONS.length
    const done = total - remaining.length + i + 1

    console.log(`[${done}/${total}] ${region.name} を取得中...`)

    const elements = await fetchRegion(region.bbox, region.name)
    const parsed = elements.map(parseElement).filter(Boolean)
    allElements.push(...parsed)

    console.log(`  ✓ ${region.name}: ${parsed.length}件 (累計: ${allElements.length}件)`)

    // 進捗保存
    completedSet.add(region.name)
    progress.completedRegions = Array.from(completedSet)
    progress.elements = allElements
    saveProgress(progress)

    // 最後のリージョン以外はウェイト
    if (i < remaining.length - 1) {
      await sleep(REQUEST_INTERVAL)
    }
  }

  // 重複除去
  const seen = new Set()
  const unique = allElements.filter((el) => {
    if (seen.has(el.id)) return false
    seen.add(el.id)
    return true
  })

  console.log(`\n=== 結果 ===`)
  console.log(`取得件数: ${allElements.length}`)
  console.log(`重複除去後: ${unique.length}`)

  // JSON出力
  mkdirSync(join(__dirname, '../src/data'), { recursive: true })
  writeFileSync(OUTPUT_JSON, JSON.stringify(unique), 'utf-8')
  const sizeMB = (Buffer.byteLength(JSON.stringify(unique)) / 1024 / 1024).toFixed(1)
  console.log(`\n出力: ${OUTPUT_JSON} (${sizeMB}MB)`)

  // 統計
  const withName = unique.filter((f) => f.name).length
  console.log(`名前あり: ${withName}件`)
  console.log(`名前なし: ${unique.length - withName}件`)

  console.log(`\n✅ 完了！次のステップ:`)
  console.log(`  node scripts/fetch-japan-addresses.mjs  (住所取得)`)
}

main().catch(console.error)
