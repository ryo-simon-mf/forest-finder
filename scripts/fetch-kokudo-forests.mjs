import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import * as shapefile from 'shapefile'
import unzipper from 'unzipper'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '../data/kokudo')

// 東京都周辺の1次メッシュコード
const MESH_CODES = ['5339', '5340', '5239']

// 国土数値情報の土地利用細分メッシュ（2021年度）
// URL形式を試行
const BASE_URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/L03-b/L03-b-21'

// 森林の土地利用コード
const FOREST_CODE = '0500'

async function downloadFile(url, dest) {
  if (existsSync(dest)) {
    console.log(`  既にダウンロード済み: ${dest}`)
    return true
  }

  console.log(`  ダウンロード中: ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`  ❌ HTTP ${res.status}: ${url}`)
      return false
    }
    const fileStream = createWriteStream(dest)
    await pipeline(res.body, fileStream)
    console.log(`  ✅ ダウンロード完了`)
    return true
  } catch (e) {
    console.log(`  ❌ エラー: ${e.message}`)
    return false
  }
}

async function extractShapefile(zipPath, extractDir) {
  mkdirSync(extractDir, { recursive: true })

  const zip = await unzipper.Open.file(zipPath)
  const entries = zip.files.filter(f =>
    f.path.endsWith('.shp') ||
    f.path.endsWith('.dbf') ||
    f.path.endsWith('.shx') ||
    f.path.endsWith('.prj')
  )

  for (const entry of entries) {
    const fileName = entry.path.split('/').pop()
    const dest = join(extractDir, fileName)
    const content = await entry.buffer()
    writeFileSync(dest, content)
    console.log(`  展開: ${fileName}`)
  }

  // .shpファイルのパスを返す
  const shpEntry = entries.find(f => f.path.endsWith('.shp'))
  return shpEntry ? join(extractDir, shpEntry.path.split('/').pop()) : null
}

async function parseShapefile(shpPath) {
  console.log(`  パース中: ${shpPath}`)
  const forests = []

  const source = await shapefile.open(shpPath)
  let result = await source.read()
  let count = 0
  let forestCount = 0

  while (!result.done) {
    count++
    const props = result.value.properties

    // 属性名を確認（最初のレコードのみ）
    if (count === 1) {
      console.log(`  属性一覧:`, Object.keys(props))
      console.log(`  サンプル:`, JSON.stringify(props))
    }

    // 森林コード（L03b_002 = 土地利用種別コード）
    const landUseCode = props.L03b_002 || props['L03b_002'] || props.landuse || ''

    if (String(landUseCode) === FOREST_CODE || String(landUseCode) === '500' || String(landUseCode) === '5') {
      forestCount++
      const geom = result.value.geometry

      // ポリゴンまたはポイントの中心座標を計算
      let lat, lon
      if (geom.type === 'Point') {
        lon = geom.coordinates[0]
        lat = geom.coordinates[1]
      } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0]
        lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
        lon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
      }

      if (lat && lon) {
        // 東京都周辺のフィルタ（緯度35.0-36.0、経度138.5-140.0）
        if (lat >= 35.0 && lat <= 36.5 && lon >= 138.5 && lon <= 140.5) {
          forests.push({
            id: `kokudo-${forestCount}`,
            name: '',
            latitude: Math.round(lat * 1000000) / 1000000,
            longitude: Math.round(lon * 1000000) / 1000000,
            address: '',
            source: 'kokudo',
            meshCode: props.L03b_001 || '',
          })
        }
      }
    }

    result = await source.read()
    if (count % 100000 === 0) {
      console.log(`  処理中: ${count}件 (森林: ${forestCount}件)`)
    }
  }

  console.log(`  完了: 全${count}件中、森林${forestCount}件`)
  return forests
}

async function main() {
  mkdirSync(dataDir, { recursive: true })

  console.log('=== 国土数値情報 土地利用細分メッシュデータ取得 ===\n')

  // URLパターンを複数試す
  const urlPatterns = [
    (code) => `${BASE_URL}/L03-b-21_${code}-jgd2011_GML.zip`,
    (code) => `${BASE_URL}/L03-b-21_${code}-jgd2011.zip`,
    (code) => `${BASE_URL}/L03-b-21_${code}.zip`,
  ]

  let allForests = []

  for (const code of MESH_CODES) {
    console.log(`\n--- メッシュ ${code} ---`)
    const zipPath = join(dataDir, `L03-b-21_${code}.zip`)
    const extractDir = join(dataDir, `mesh_${code}`)

    let downloaded = false
    for (const pattern of urlPatterns) {
      const url = pattern(code)
      downloaded = await downloadFile(url, zipPath)
      if (downloaded) break
    }

    if (!downloaded) {
      console.log(`  ⚠️ メッシュ ${code} のダウンロードに失敗。スキップします。`)
      continue
    }

    try {
      const shpPath = await extractShapefile(zipPath, extractDir)
      if (shpPath) {
        const forests = await parseShapefile(shpPath)
        allForests.push(...forests)
        console.log(`  → ${forests.length}件の森林データを追加`)
      } else {
        console.log(`  ⚠️ Shapefileが見つかりません`)

        // GMLの場合を確認
        const zip = await unzipper.Open.file(zipPath)
        const files = zip.files.map(f => f.path)
        console.log(`  ZIP内のファイル:`, files.slice(0, 10))
      }
    } catch (e) {
      console.log(`  ❌ パースエラー: ${e.message}`)

      // ZIP内容を確認
      try {
        const zip = await unzipper.Open.file(zipPath)
        const files = zip.files.map(f => f.path)
        console.log(`  ZIP内のファイル:`, files.slice(0, 20))
      } catch (e2) {
        console.log(`  ZIP読み取りエラー: ${e2.message}`)
      }
    }
  }

  // 重複除去（同じ座標のものを削除）
  const unique = new Map()
  for (const f of allForests) {
    const key = `${f.latitude},${f.longitude}`
    if (!unique.has(key)) {
      unique.set(key, f)
    }
  }
  allForests = Array.from(unique.values())

  // IDを振り直し
  allForests.forEach((f, i) => { f.id = `kokudo-${i + 1}` })

  console.log(`\n=== 結果 ===`)
  console.log(`森林データ: ${allForests.length}件`)

  // JSON出力
  const jsonPath = join(__dirname, '../src/data/kokudo-forests.json')
  mkdirSync(join(__dirname, '../src/data'), { recursive: true })
  writeFileSync(jsonPath, JSON.stringify(allForests), 'utf-8')
  console.log(`出力: ${jsonPath}`)

  // CSV出力
  const csvPath = join(dataDir, 'kokudo-forests.csv')
  const csvHeader = 'id,name,latitude,longitude,address,source,meshCode'
  const csvLines = allForests.map(f =>
    `${f.id},${f.name},${f.latitude},${f.longitude},${f.address},${f.source},${f.meshCode}`
  )
  writeFileSync(csvPath, [csvHeader, ...csvLines].join('\n'), 'utf-8')
  console.log(`CSV出力: ${csvPath}`)
}

main().catch(console.error)
