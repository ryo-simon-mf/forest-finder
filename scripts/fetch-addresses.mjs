/**
 * 森林データに住所を追加するスクリプト
 * 国土地理院の逆ジオコーディングAPIを使用
 * 負荷軽減のため200msの間隔を設けて呼び出し
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const GSI_REVERSE_GEOCODE_API =
  'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress'

// リクエスト間隔（ミリ秒）- API負荷軽減のため
const REQUEST_INTERVAL = 200

// 進捗保存間隔
const SAVE_INTERVAL = 100

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getAddress(lat, lon) {
  try {
    const url = `${GSI_REVERSE_GEOCODE_API}?lat=${lat}&lon=${lon}`
    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.results) {
      const { mupiName, lv01Nm } = data.results
      // 都道府県 + 市区町村 + 町丁目
      return [mupiName, lv01Nm].filter(Boolean).join('')
    }

    return null
  } catch (error) {
    console.error(`  エラー: ${error.message}`)
    return null
  }
}

async function main() {
  // CSVを読み込み
  const csvPath = join(__dirname, '../data/tokyo-forests.csv')
  const csv = readFileSync(csvPath, 'utf-8')
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')

  // 住所カラムを追加
  if (!headers.includes('address')) {
    headers.push('address')
  }
  const addressIndex = headers.indexOf('address')

  // 既存データを解析
  const records = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    records.push(values)
  }

  console.log(`総件数: ${records.length}`)
  console.log(`リクエスト間隔: ${REQUEST_INTERVAL}ms`)
  console.log(`推定時間: ${Math.round((records.length * REQUEST_INTERVAL) / 1000 / 60)}分\n`)

  // 途中経過ファイルがあれば読み込み
  const progressPath = join(__dirname, '../data/tokyo-forests-progress.json')
  let startIndex = 0
  let addressMap = {}

  try {
    const progress = JSON.parse(readFileSync(progressPath, 'utf-8'))
    startIndex = progress.lastIndex + 1
    addressMap = progress.addresses
    console.log(`前回の続きから再開: ${startIndex}件目から\n`)
  } catch (e) {
    console.log('最初から開始\n')
  }

  // 住所を取得
  for (let i = startIndex; i < records.length; i++) {
    const record = records[i]
    const id = record[0]
    const lat = parseFloat(record[3])
    const lon = parseFloat(record[4])

    // 既に取得済みならスキップ
    if (addressMap[id]) {
      continue
    }

    const address = await getAddress(lat, lon)
    addressMap[id] = address || ''

    // 進捗表示
    if ((i + 1) % 10 === 0) {
      const percent = (((i + 1) / records.length) * 100).toFixed(1)
      console.log(`進捗: ${i + 1}/${records.length} (${percent}%) - ${address || '(住所なし)'}`)
    }

    // 定期的に保存
    if ((i + 1) % SAVE_INTERVAL === 0) {
      writeFileSync(
        progressPath,
        JSON.stringify({ lastIndex: i, addresses: addressMap }),
        'utf-8'
      )
      console.log(`  → 進捗を保存しました\n`)
    }

    await sleep(REQUEST_INTERVAL)
  }

  // 最終結果をCSVに保存
  console.log('\nCSVに保存中...')

  const newLines = [headers.join(',')]
  for (const record of records) {
    const id = record[0]
    const address = addressMap[id] || ''
    // 住所カラムを追加/更新
    while (record.length < addressIndex) {
      record.push('')
    }
    record[addressIndex] = address.includes(',') ? `"${address}"` : address
    newLines.push(record.join(','))
  }

  const outputPath = join(__dirname, '../data/tokyo-forests-with-address.csv')
  writeFileSync(outputPath, newLines.join('\n'), 'utf-8')

  console.log(`\n完了: ${outputPath}`)

  // 統計
  const withAddress = Object.values(addressMap).filter(Boolean).length
  console.log(`\n--- 統計 ---`)
  console.log(`住所あり: ${withAddress}`)
  console.log(`住所なし: ${records.length - withAddress}`)
}

main().catch(console.error)
