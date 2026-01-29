import type { ForestArea, ForestSearchResult } from '@/types/forest'
import { calculateDistance } from '@/lib/distance'

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: { name?: string }
}

/**
 * 指定位置周辺の森林を検索
 */
export async function searchForests(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000
): Promise<ForestSearchResult> {
  const query = buildOverpassQuery(latitude, longitude, radiusMeters)

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`)
    }

    const data = await response.json()
    const forests = parseForestData(data.elements, latitude, longitude)

    // 距離でソート
    forests.sort((a, b) => (a.distance || 0) - (b.distance || 0))

    return {
      forests,
      nearest: forests.length > 0 ? forests[0] : null,
      searchRadius: radiusMeters,
    }
  } catch (error) {
    console.error('Forest search failed:', error)
    return {
      forests: [],
      nearest: null,
      searchRadius: radiusMeters,
    }
  }
}

function buildOverpassQuery(
  lat: number,
  lon: number,
  radius: number
): string {
  // 森林、公園、緑地を検索
  return `
    [out:json][timeout:25];
    (
      way["landuse"="forest"](around:${radius},${lat},${lon});
      way["natural"="wood"](around:${radius},${lat},${lon});
      relation["landuse"="forest"](around:${radius},${lat},${lon});
      relation["natural"="wood"](around:${radius},${lat},${lon});
    );
    out center;
  `
}

function parseForestData(
  elements: OverpassElement[],
  userLat: number,
  userLon: number
): ForestArea[] {
  const forests: ForestArea[] = []

  for (const element of elements) {
    let lat: number | undefined
    let lon: number | undefined

    if (element.center) {
      lat = element.center.lat
      lon = element.center.lon
    } else if (element.lat && element.lon) {
      lat = element.lat
      lon = element.lon
    }

    if (lat !== undefined && lon !== undefined) {
      const distance = calculateDistance(userLat, userLon, lat, lon)

      forests.push({
        id: `${element.type}-${element.id}`,
        name: element.tags?.name,
        center: { latitude: lat, longitude: lon },
        distance,
      })
    }
  }

  return forests
}
