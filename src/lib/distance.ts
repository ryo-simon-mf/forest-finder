/**
 * Haversine式で2点間の距離を計算（メートル）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // 地球の半径（メートル）
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * 距離をフォーマット（km/m自動切り替え）
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

/**
 * 距離から徒歩時間をフォーマット
 * 不動産業界基準: 80m/分
 */
export function formatWalkingTime(meters: number): string {
  const minutes = Math.ceil(meters / 80)
  if (minutes < 60) {
    return `徒歩${minutes}分`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `徒歩${hours}時間`
  }
  return `徒歩${hours}時間${mins}分`
}

export type DisplayMode = 'distance' | 'walking'

/**
 * 表示モードに応じた距離/時間テキストを返す
 */
export function formatByMode(meters: number, mode: DisplayMode): string {
  return mode === 'walking' ? formatWalkingTime(meters) : formatDistance(meters)
}

/**
 * 距離から到着予定時刻を計算して返す
 * 徒歩速度: 80m/分（不動産業界基準）
 * @returns "HH:MMに到着" 形式の文字列
 */
export function getEstimatedArrivalTime(meters: number): string {
  const minutes = Math.ceil(meters / 80)
  const now = new Date()
  now.setMinutes(now.getMinutes() + minutes)
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}に到着`
}
