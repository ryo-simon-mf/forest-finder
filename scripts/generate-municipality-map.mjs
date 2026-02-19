/**
 * 全国地方公共団体コード → 都道府県+市区町村名 のマッピングJSONを生成
 * データソース: code4fukui/localgovjp (CC0)
 *
 * 使い方: node scripts/generate-municipality-map.mjs
 */

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SOURCE_URL = 'https://code4fukui.github.io/localgovjp/localgovjp.json'
const OUTPUT_PATH = join(__dirname, '../src/data/municipality-map.json')

async function main() {
  console.log('自治体コードマッピングを生成中...')
  console.log(`ソース: ${SOURCE_URL}`)

  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`)
  }

  const data = await res.json()
  console.log(`取得件数: ${data.length}`)

  // muniCd (5桁) → "都道府県名市区町村名" のマッピング
  const map = {}

  for (const item of data) {
    const lgcode = item.lgcode
    if (!lgcode || lgcode.length < 5) continue

    // lgcodeの先頭5桁 = GSI APIのmuniCd
    const muniCd = lgcode.substring(0, 5)

    // 都道府県名 + 市区町村名（スペース除去）
    const pref = item.pref || ''
    const city = (item.city || '').replace(/\s+/g, '')
    const fullName = pref + city

    if (fullName) {
      map[muniCd] = fullName
    }
  }

  const entries = Object.keys(map).length
  writeFileSync(OUTPUT_PATH, JSON.stringify(map), 'utf-8')

  const sizeMB = (Buffer.byteLength(JSON.stringify(map)) / 1024).toFixed(1)
  console.log(`\n生成完了:`)
  console.log(`  エントリ数: ${entries}`)
  console.log(`  出力: ${OUTPUT_PATH} (${sizeMB}KB)`)

  // サンプル表示
  console.log('\nサンプル:')
  const samples = ['01101', '13103', '13113', '27100', '40130']
  for (const code of samples) {
    console.log(`  ${code} → ${map[code] || '(なし)'}`)
  }
}

main().catch(console.error)
