/**
 * 国土地理院の逆ジオコーディングAPIを使って座標から住所を取得
 */

const GSI_REVERSE_GEOCODE_URL =
  'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress'

// キャッシュ（座標 → 住所）
const cache = new Map<string, string>()

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`
}

/**
 * 座標から住所を取得（国土地理院逆ジオコーディングAPI）
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string> {
  const key = cacheKey(lat, lon)
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  try {
    const res = await fetch(
      `${GSI_REVERSE_GEOCODE_URL}?lat=${lat}&lon=${lon}`
    )
    if (!res.ok) {
      cache.set(key, '')
      return ''
    }
    const data = await res.json()
    const address = data.results?.lv01Nm || ''
    cache.set(key, address)
    return address
  } catch {
    cache.set(key, '')
    return ''
  }
}

/**
 * 複数の森林の住所を一括解決（バッチ処理）
 */
export async function resolveForestAddresses(
  forests: { id: string; center: { latitude: number; longitude: number } }[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const BATCH_SIZE = 10

  for (let i = 0; i < forests.length; i += BATCH_SIZE) {
    const batch = forests.slice(i, i + BATCH_SIZE)
    const promises = batch.map(async (f) => {
      const addr = await reverseGeocode(f.center.latitude, f.center.longitude)
      if (addr) results.set(f.id, addr)
    })
    await Promise.all(promises)
  }

  return results
}
