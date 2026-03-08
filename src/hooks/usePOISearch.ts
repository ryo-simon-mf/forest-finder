'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Position } from '@/types/geolocation'
import type { POISearchResult } from '@/types/poi'
import { calculateDistance } from '@/lib/distance'
import { resolveForestAddresses } from '@/lib/reverseGeocode'

export type POISearchFn = (
  latitude: number,
  longitude: number,
  radiusMeters?: number,
  limit?: number
) => POISearchResult

interface UsePOISearchOptions {
  radiusMeters?: number
  minDistanceChange?: number
  searchFn: POISearchFn
}

interface UsePOISearchReturn {
  result: POISearchResult | null
  isLoading: boolean
}

export function usePOISearch(
  position: Position | null,
  options: UsePOISearchOptions
): UsePOISearchReturn {
  const { radiusMeters = 5000, minDistanceChange = 50, searchFn } = options

  const [result, setResult] = useState<POISearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const lastSearchPositionRef = useRef<Position | null>(null)
  const lastRadiusRef = useRef<number>(radiusMeters)

  const doSearch = useCallback(
    (pos: Position) => {
      setIsLoading(true)
      try {
        const searchResult = searchFn(pos.latitude, pos.longitude, radiusMeters)
        setResult(searchResult)
        lastSearchPositionRef.current = pos

        // Resolve addresses for points that don't have them
        const needsAddress = searchResult.points.filter((p) => !p.address)
        if (needsAddress.length > 0) {
          resolveForestAddresses(needsAddress).then((addressMap) => {
            setResult((prev) => {
              if (!prev) return prev
              const points = prev.points.map((p) => {
                const addr = addressMap.get(p.id)
                return addr ? { ...p, address: addr } : p
              })
              return { ...prev, points, nearest: points[0] || null }
            })
          })
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [radiusMeters, searchFn]
  )

  useEffect(() => {
    if (!position) return

    if (lastRadiusRef.current !== radiusMeters) {
      lastRadiusRef.current = radiusMeters
      doSearch(position)
      return
    }

    const lastPos = lastSearchPositionRef.current
    if (!lastPos) {
      doSearch(position)
      return
    }

    const distance = calculateDistance(
      lastPos.latitude, lastPos.longitude,
      position.latitude, position.longitude
    )
    if (distance >= minDistanceChange) {
      doSearch(position)
    }
  }, [position, minDistanceChange, doSearch, radiusMeters])

  return { result, isLoading }
}
