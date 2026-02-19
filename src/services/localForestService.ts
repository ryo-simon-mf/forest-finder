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
 * 結果が多い場合はグリッドベースでサンプリングし、地理的に分散した結果を返す
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
  // 半径から動的にグリッドサイズを計算し、約limit個のセルが得られるようにする
  const radiusDeg = radiusMeters / 111_000
  const gridCellDeg = Math.max(0.01, (2 * radiusDeg) / Math.sqrt(limit))

  const gridMap = new Map<string, ForestArea>()

  for (const forest of allInRadius) {
    const cellKey = `${Math.floor(forest.center.latitude / gridCellDeg)}_${Math.floor(forest.center.longitude / gridCellDeg)}`
    // 各セルで最も近い森林を保持
    const existing = gridMap.get(cellKey)
    if (!existing || (forest.distance || 0) < (existing.distance || 0)) {
      gridMap.set(cellKey, forest)
    }
  }

  const sampled = Array.from(gridMap.values())

  // 最寄りの森林が含まれていることを保証
  if (nearest && !sampled.find((f) => f.id === nearest.id)) {
    sampled.push(nearest)
  }

  return {
    forests: sampled,
    nearest,
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

/**
 * 読み込み済みデータの総件数
 */
export function getForestDataCount(): number {
  return cachedData?.length ?? 0
}
