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
  const mod = await import('@/data/kokudo-forests.json')
  cachedData = mod.default as ForestRecord[]
  return cachedData
}

/**
 * 国土数値情報の森林データから指定位置周辺の森林を検索
 * 結果が多い場合はグリッドベースでサンプリングし、地理的に分散した結果を返す
 */
export function searchKokudoForestsLocal(
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

  const allInRadius: ForestArea[] = []

  for (const record of cachedData) {
    const distance = calculateDistance(
      latitude,
      longitude,
      record.latitude,
      record.longitude
    )

    if (distance <= radiusMeters) {
      allInRadius.push({
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
  allInRadius.sort((a, b) => (a.distance || 0) - (b.distance || 0))

  const nearest = allInRadius.length > 0 ? allInRadius[0] : null

  // 制限内ならそのまま返す
  if (allInRadius.length <= limit) {
    return {
      forests: allInRadius,
      nearest,
      searchRadius: radiusMeters,
    }
  }

  // グリッドベースの地理的サンプリング
  const gridCellDeg =
    radiusMeters > 100_000
      ? 0.1
      : radiusMeters > 50_000
        ? 0.05
        : 0.01

  const gridMap = new Map<string, ForestArea>()

  for (const forest of allInRadius) {
    const cellKey = `${Math.floor(forest.center.latitude / gridCellDeg)}_${Math.floor(forest.center.longitude / gridCellDeg)}`
    const existing = gridMap.get(cellKey)
    if (!existing || (forest.distance || 0) < (existing.distance || 0)) {
      gridMap.set(cellKey, forest)
    }
  }

  let sampled = Array.from(gridMap.values())
  sampled.sort((a, b) => (a.distance || 0) - (b.distance || 0))
  sampled = sampled.slice(0, limit)

  if (nearest && !sampled.find((f) => f.id === nearest.id)) {
    sampled.pop()
    sampled.unshift(nearest)
  }

  return {
    forests: sampled,
    nearest,
    searchRadius: radiusMeters,
  }
}

/**
 * データの事前読み込み（コンポーネントから呼び出す）
 */
export async function preloadKokudoData(): Promise<void> {
  await loadData()
}

/**
 * データが読み込み済みかどうか
 */
export function isKokudoDataLoaded(): boolean {
  return cachedData !== null
}
