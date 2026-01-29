import type { ForestArea, ForestSearchResult } from '@/types/forest'
import { calculateDistance } from '@/lib/distance'

// CSVデータをインポート（ビルド時に読み込み）
import forestData from '@/data/tokyo-forests.json'

interface ForestRecord {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
}

/**
 * ローカルデータから指定位置周辺の森林を検索
 */
export function searchForestsLocal(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
  limit: number = 50
): ForestSearchResult {
  const forests: ForestArea[] = []

  for (const record of forestData as ForestRecord[]) {
    const distance = calculateDistance(
      latitude,
      longitude,
      record.latitude,
      record.longitude
    )

    if (distance <= radiusMeters) {
      forests.push({
        id: record.id,
        name: record.name || undefined,
        address: record.address || undefined,
        center: {
          latitude: record.latitude,
          longitude: record.longitude,
        },
        distance,
      })
    }
  }

  // 距離でソート
  forests.sort((a, b) => (a.distance || 0) - (b.distance || 0))

  // 件数制限
  const limitedForests = forests.slice(0, limit)

  return {
    forests: limitedForests,
    nearest: limitedForests.length > 0 ? limitedForests[0] : null,
    searchRadius: radiusMeters,
  }
}
