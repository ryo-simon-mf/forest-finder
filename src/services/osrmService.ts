// OSRM foot profile (OpenStreetMap.de) — 正確な徒歩ルーティング
const OSRM_BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

export async function fetchWalkingRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<[number, number][]> {
  const url = `${OSRM_BASE}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OSRM request failed: ${res.status}`)
  }

  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM returned no route: ${data.code}`)
  }

  // GeoJSON coordinates are [lng, lat] → convert to Leaflet [lat, lng]
  const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
  )

  return coords
}
