/**
 * 東京都の森林データを取得してCSVに保存するスクリプト
 * データソース: OpenStreetMap (Overpass API)
 */

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

// 東京都を複数の領域に分割
const TOKYO_REGIONS = [
  { name: '23区東部', bbox: '35.6,139.7,35.85,139.95' },
  { name: '23区西部', bbox: '35.6,139.5,35.85,139.7' },
  { name: '多摩東部', bbox: '35.6,139.3,35.8,139.5' },
  { name: '多摩西部', bbox: '35.5,138.9,35.8,139.3' },
  { name: '北部', bbox: '35.8,139.3,35.95,139.95' },
]

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchRegion(bbox, regionName) {
  console.log(`  ${regionName} を取得中...`)

  const query = `
    [out:json][timeout:60];
    (
      way["landuse"="forest"](${bbox});
      way["natural"="wood"](${bbox});
      relation["landuse"="forest"](${bbox});
      relation["natural"="wood"](${bbox});
    );
    out center tags;
  `

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    console.log(`  ⚠ ${regionName}: エラー ${response.status}`)
    return []
  }

  const data = await response.json()
  console.log(`  ✓ ${regionName}: ${data.elements.length}件`)

  return data.elements
}

async function fetchTokyoForests() {
  console.log('東京都の森林データを取得中...\n')

  const allElements = []

  for (const region of TOKYO_REGIONS) {
    const elements = await fetchRegion(region.bbox, region.name)
    allElements.push(...elements)
    // API負荷軽減のため待機
    await sleep(2000)
  }

  // 重複除去（同じIDのものを除外）
  const seen = new Set()
  const uniqueElements = allElements.filter((el) => {
    const key = `${el.type}-${el.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`\n合計: ${uniqueElements.length}件（重複除去後）`)

  return uniqueElements
}

function parseForests(elements) {
  const forests = []

  for (const element of elements) {
    let lat, lon

    if (element.center) {
      lat = element.center.lat
      lon = element.center.lon
    } else if (element.lat && element.lon) {
      lat = element.lat
      lon = element.lon
    } else {
      continue
    }

    const tags = element.tags || {}

    forests.push({
      id: `${element.type}-${element.id}`,
      type: element.type,
      name: tags.name || '',
      latitude: lat,
      longitude: lon,
      landuse: tags.landuse || '',
      natural: tags.natural || '',
      leaf_type: tags.leaf_type || '',
      source: 'OpenStreetMap',
    })
  }

  return forests
}

function toCSV(forests) {
  const headers = [
    'id',
    'type',
    'name',
    'latitude',
    'longitude',
    'landuse',
    'natural',
    'leaf_type',
    'source',
  ]

  const rows = forests.map((f) =>
    headers
      .map((h) => {
        const value = String(f[h] ?? '')
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      .join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

async function main() {
  try {
    const elements = await fetchTokyoForests()
    const forests = parseForests(elements)

    console.log(`解析完了: ${forests.length}件の森林データ`)

    // CSV保存
    const csv = toCSV(forests)
    const outputPath = join(__dirname, '../data/tokyo-forests.csv')
    writeFileSync(outputPath, csv, 'utf-8')

    console.log(`\n保存完了: ${outputPath}`)

    // 統計情報
    const withName = forests.filter((f) => f.name).length
    console.log(`\n--- 統計 ---`)
    console.log(`総数: ${forests.length}`)
    console.log(`名前あり: ${withName}`)
    console.log(`名前なし: ${forests.length - withName}`)
  } catch (error) {
    console.error('エラー:', error.message)
    process.exit(1)
  }
}

main()
