import { useEffect, useRef, useState } from 'react'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'
import { fetchWalkingRoute } from '@/services/osrmService'

const MIN_MOVE_METERS = 100

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useRoute(
  position: Position | null,
  nearestForest: ForestArea | null
) {
  const [route, setRoute] = useState<[number, number][] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const lastForestIdRef = useRef<string | null>(null)
  const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    if (!position || !nearestForest) {
      setRoute(null)
      return
    }

    const forestChanged = nearestForest.id !== lastForestIdRef.current
    const positionMoved =
      lastPositionRef.current === null ||
      haversineDistance(
        lastPositionRef.current.lat,
        lastPositionRef.current.lon,
        position.latitude,
        position.longitude
      ) >= MIN_MOVE_METERS

    if (!forestChanged && !positionMoved) return

    let cancelled = false

    setIsLoading(true)
    fetchWalkingRoute(
      position.latitude,
      position.longitude,
      nearestForest.center.latitude,
      nearestForest.center.longitude
    )
      .then((coords) => {
        if (!cancelled) {
          setRoute(coords)
          lastForestIdRef.current = nearestForest.id
          lastPositionRef.current = {
            lat: position.latitude,
            lon: position.longitude,
          }
        }
      })
      .catch((err) => {
        console.error('Route fetch failed:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [position, nearestForest])

  return { route, isLoading }
}
