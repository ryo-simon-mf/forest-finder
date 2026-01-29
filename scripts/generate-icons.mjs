import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#22c55e"/>
  <g fill="#ffffff">
    <!-- 中央の木 -->
    <polygon points="256,80 340,220 300,220 360,320 280,320 280,380 232,380 232,320 152,320 212,220 172,220"/>
    <!-- 左の木 -->
    <polygon points="140,160 200,260 170,260 220,340 160,340 160,380 120,380 120,340 60,340 110,260 80,260"/>
    <!-- 右の木 -->
    <polygon points="372,160 432,260 402,260 452,340 392,340 392,380 352,380 352,340 292,340 342,260 312,260"/>
  </g>
  <!-- 地面 -->
  <rect x="0" y="400" width="512" height="112" fill="#166534"/>
</svg>
`

async function generateIcons() {
  const outputDir = join(__dirname, '../public/icons')

  try {
    await mkdir(outputDir, { recursive: true })
  } catch (e) {
    // ディレクトリが既に存在する場合は無視
  }

  const sizes = [192, 512]

  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(join(outputDir, `icon-${size}x${size}.png`))

    console.log(`Generated icon-${size}x${size}.png`)
  }

  // apple-touch-icon (180x180)
  await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png()
    .toFile(join(outputDir, 'apple-touch-icon.png'))

  console.log('Generated apple-touch-icon.png')
}

generateIcons().catch(console.error)
