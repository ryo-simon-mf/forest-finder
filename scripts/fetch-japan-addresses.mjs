/**
 * 日本全国の森林データに住所を追加するスクリプト
 * 国土地理院の逆ジオコーディングAPIを使用
 *
 * 使い方:
 *   node scripts/fetch-japan-addresses.mjs
 *
 * 中断しても再実行すれば途中から再開します。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const GSI_API = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress'
const JSON_PATH = join(__dirname, '../src/data/japan-forests.json')
const PROGRESS_PATH = join(__dirname, '../data/japan-addresses-progress.json')

// リクエスト間隔（ミリ秒）
const REQUEST_INTERVAL = 150
// 進捗保存間隔
const SAVE_INTERVAL = 200

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getAddress(lat, lon) {
  try {
    const res = await fetch(`${GSI_API}?lat=${lat}&lon=${lon}`)
    if (!res.ok) return ''
    const data = await res.json()
    return data.results?.lv01Nm || ''
  } catch {
    return ''
  }
}

function loadProgress() {
  try {
    if (existsSync(PROGRESS_PATH)) {
      return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'))
    }
  } catch (e) {
    // ignore
  }
  return { addresses: {} }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress), 'utf-8')
}

async function main() {
  if (!existsSync(JSON_PATH)) {
    console.error(`エラー: ${JSON_PATH} が見つかりません`)
    console.error('先に node scripts/fetch-japan-forests.mjs を実行してください')
    process.exit(1)
  }

  const forests = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`=== 住所取得（国土地理院 逆ジオコーディング）===\n`)
  console.log(`対象: ${forests.length}件`)

  const progress = loadProgress()
  const addressMap = progress.addresses

  // 未取得のエントリを特定
  const todo = forests.filter((f) => !(f.id in addressMap))
  console.log(`取得済み: ${Object.keys(addressMap).length}件`)
  console.log(`残り: ${todo.length}件`)
  console.log(`推定時間: ${Math.round((todo.length * REQUEST_INTERVAL) / 1000 / 60)}分\n`)

  if (todo.length === 0) {
    console.log('全件取得済み。JSONに反映します。')
  }

  for (let i = 0; i < todo.length; i++) {
    const f = todo[i]
    const address = await getAddress(f.latitude, f.longitude)
    addressMap[f.id] = address

    if ((i + 1) % 50 === 0) {
      const total = todo.length
      const percent = (((i + 1) / total) * 100).toFixed(1)
      console.log(`進捗: ${i + 1}/${total} (${percent}%) - ${address || '(住所なし)'}`)
    }

    if ((i + 1) % SAVE_INTERVAL === 0) {
      progress.addresses = addressMap
      saveProgress(progress)
      console.log(`  → 進捗を保存\n`)
    }

    await sleep(REQUEST_INTERVAL)
  }

  // 最終保存
  progress.addresses = addressMap
  saveProgress(progress)

  // JSONに住所を反映
  console.log('\nJSONに住所を反映中...')
  let resolved = 0
  for (const f of forests) {
    const addr = addressMap[f.id]
    if (addr) {
      f.address = addr
      resolved++
    }
  }

  writeFileSync(JSON_PATH, JSON.stringify(forests), 'utf-8')
  const sizeMB = (Buffer.byteLength(JSON.stringify(forests)) / 1024 / 1024).toFixed(1)

  console.log(`\n=== 完了 ===`)
  console.log(`住所あり: ${resolved}件`)
  console.log(`住所なし: ${forests.length - resolved}件`)
  console.log(`出力: ${JSON_PATH} (${sizeMB}MB)`)
}

main().catch(console.error)
