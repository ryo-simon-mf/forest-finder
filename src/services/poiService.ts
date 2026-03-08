import type { POIPoint, POISearchResult } from '@/types/poi'
import { calculateDistance } from '@/lib/distance'

interface RawRecord {
  id: string
  name: string
  latitude: number
  longitude: number
}

// POIタイプごとにキャッシュ
const cacheMap = new Map<string, RawRecord[]>()

async function loadData(dataFile: string, hasName: boolean): Promise<RawRecord[]> {
  const cached = cacheMap.get(dataFile)
  if (cached) return cached

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  const res = await fetch(`${basePath}/data/${dataFile}`)
  const raw = await res.json()

  let records: RawRecord[]
  if (hasName) {
    // [id, lat, lon, name] format
    records = (raw as [string, number, number, string][]).map(([id, lat, lon, name]) => ({
      id: id.replace(/^w/, 'way-').replace(/^n/, 'node-').replace(/^r/, 'relation-'),
      name: name || '',
      latitude: lat,
      longitude: lon,
    }))
  } else {
    // [id, lat, lon] format
    records = (raw as [string, number, number][]).map(([id, lat, lon]) => ({
      id: id.replace(/^w/, 'way-').replace(/^n/, 'node-').replace(/^r/, 'relation-'),
      name: '',
      latitude: lat,
      longitude: lon,
    }))
  }

  cacheMap.set(dataFile, records)
  return records
}

export function searchPOILocal(
  dataFile: string,
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
  limit: number = 200
): POISearchResult {
  const data = cacheMap.get(dataFile)
  if (!data) {
    return { points: [], nearest: null, searchRadius: radiusMeters }
  }

  const allInRadius: POIPoint[] = []

  for (const record of data) {
    const distance = calculateDistance(latitude, longitude, record.latitude, record.longitude)
    if (distance <= radiusMeters) {
      allInRadius.push({
        id: record.id,
        name: record.name || undefined,
        center: { latitude: record.latitude, longitude: record.longitude },
        distance,
      })
    }
  }

  allInRadius.sort((a, b) => (a.distance || 0) - (b.distance || 0))
  const nearest = allInRadius[0] || null

  if (allInRadius.length <= limit) {
    return { points: allInRadius, nearest, searchRadius: radiusMeters }
  }

  // Grid-based geographic sampling
  const radiusDeg = radiusMeters / 111_000
  const gridCellDeg = Math.max(0.01, (2 * radiusDeg) / Math.sqrt(limit))
  const gridMap = new Map<string, POIPoint>()

  for (const point of allInRadius) {
    const cellKey = `${Math.floor(point.center.latitude / gridCellDeg)}_${Math.floor(point.center.longitude / gridCellDeg)}`
    const existing = gridMap.get(cellKey)
    if (!existing || (point.distance || 0) < (existing.distance || 0)) {
      gridMap.set(cellKey, point)
    }
  }

  const sampled = Array.from(gridMap.values())
  if (nearest && !sampled.find((p) => p.id === nearest.id)) {
    sampled.push(nearest)
  }

  return { points: sampled, nearest, searchRadius: radiusMeters }
}

export async function preloadPOIData(dataFile: string, hasName: boolean): Promise<void> {
  await loadData(dataFile, hasName)
}

export function isPOIDataLoaded(dataFile: string): boolean {
  return cacheMap.has(dataFile)
}
