import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 住所付きCSVを使用
const csvPath = join(__dirname, '../data/tokyo-forests-with-address.csv')
const jsonPath = join(__dirname, '../src/data/tokyo-forests.json')

const csv = readFileSync(csvPath, 'utf-8')
const lines = csv.trim().split('\n')

const data = []

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',')
  const record = {
    id: values[0],
    name: values[2] || '',
    latitude: parseFloat(values[3]),
    longitude: parseFloat(values[4]),
    address: values[9] || '',
  }
  data.push(record)
}

try {
  mkdirSync(join(__dirname, '../src/data'), { recursive: true })
} catch (e) {}

writeFileSync(jsonPath, JSON.stringify(data), 'utf-8')

console.log(`変換完了: ${data.length}件`)
console.log(`出力: ${jsonPath}`)

const withAddress = data.filter(d => d.address).length
console.log(`住所あり: ${withAddress}件`)
