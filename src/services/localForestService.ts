import type { ForestArea, ForestSearchResult } from '@/types/forest'
import { calculateDistance } from '@/lib/distance'

interface ForestRecord {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
}

// モジュールスコープにキャッシュ
let cachedData: ForestRecord[] | null = null

async function loadData(): Promise<ForestRecord[]> {
  if (cachedData) return cachedData
  const mod = await import('@/data/japan-forests.json')
  cachedData = mod.default as ForestRecord[]
  return cachedData
}

/**
 * ローカルデータから指定位置周辺の森林を検索
 */
export function searchForestsLocal(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
  limit: number = 200
): ForestSearchResult {
  if (!cachedData) {
    return {
      forests: [],
      nearest: null,
      searchRadius: radiusMeters,
    }
  }

  const forests: ForestArea[] = []

  for (const record of cachedData) {
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

/**
 * データの事前読み込み
 */
export async function preloadForestData(): Promise<void> {
  await loadData()
}

/**
 * データが読み込み済みかどうか
 */
export function isForestDataLoaded(): boolean {
  return cachedData !== null
}
