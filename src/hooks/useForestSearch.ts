'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Position } from '@/types/geolocation'
import type { ForestSearchResult, ForestArea } from '@/types/forest'
import { searchForestsLocal } from '@/services/localForestService'
import { calculateDistance } from '@/lib/distance'
import { reverseGeocode } from '@/lib/reverseGeocode'

export type SearchFn = (
  latitude: number,
  longitude: number,
  radiusMeters?: number,
  limit?: number
) => ForestSearchResult

interface UseForestSearchOptions {
  radiusMeters?: number
  minDistanceChange?: number
  searchFn?: SearchFn
  maxAccumulated?: number
}

interface UseForestSearchReturn {
  result: ForestSearchResult | null
  isLoading: boolean
  error: string | null
  refresh: () => void
  searchAt: (lat: number, lng: number) => void
  resolveAddress: (forest: ForestArea) => void
}

// 住所キャッシュ
const addressCache = new Map<string, string>()

export function useForestSearch(
  position: Position | null,
  options: UseForestSearchOptions = {}
): UseForestSearchReturn {
  const { radiusMeters = 5000, minDistanceChange = 50, searchFn = searchForestsLocal, maxAccumulated = 300 } = options

  const [result, setResult] = useState<ForestSearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastSearchPositionRef = useRef<Position | null>(null)
  const lastRadiusRef = useRef<number>(radiusMeters)
  const gpsPositionRef = useRef<Position | null>(position)
  gpsPositionRef.current = position

  // 1件の森の住所を即座に解決してstateに反映
  const resolveAddress = useCallback((forest: ForestArea) => {
    // キャッシュにあればすぐ反映
    const cached = addressCache.get(forest.id)
    if (cached) {
      setResult((prev) => {
        if (!prev) return prev
        const forests = prev.forests.map((f) => f.id === forest.id ? { ...f, address: cached } : f)
        return { ...prev, forests, nearest: forests[0] || null }
      })
      return
    }

    if (forest.address) return

    reverseGeocode(forest.center.latitude, forest.center.longitude).then((addr) => {
      if (!addr) return
      addressCache.set(forest.id, addr)
      setResult((prev) => {
        if (!prev) return prev
        const forests = prev.forests.map((f) => f.id === forest.id ? { ...f, address: addr } : f)
        return { ...prev, forests, nearest: forests[0] || null }
      })
    })
  }, [])

  const doSearch = useCallback(
    (pos: Position) => {
      setIsLoading(true)
      setError(null)

      try {
        const searchResult = searchFn(pos.latitude, pos.longitude, radiusMeters)

        setResult((prev) => {
          if (!prev) {
            const forests = searchResult.forests.map((f) => ({
              ...f,
              address: f.address || addressCache.get(f.id),
            }))
            return { ...searchResult, forests, nearest: forests[0] || null }
          }

          const existingMap = new Map(prev.forests.map((f) => [f.id, f]))
          for (const f of searchResult.forests) {
            if (!existingMap.has(f.id)) {
              existingMap.set(f.id, { ...f, address: addressCache.get(f.id) })
            }
          }
          const merged = Array.from(existingMap.values())
            .map((f) => ({
              ...f,
              distance: calculateDistance(pos.latitude, pos.longitude, f.center.latitude, f.center.longitude),
            }))
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

          // メモリ上限: 蓄積がmaxAccumulatedを超えたら遠い順に削除
          const capped = maxAccumulated > 0 && merged.length > maxAccumulated ? merged.slice(0, maxAccumulated) : merged

          return {
            forests: capped,
            nearest: capped[0] || null,
            searchRadius: Math.max(prev.searchRadius, searchResult.searchRadius),
          }
        })
        lastSearchPositionRef.current = pos
      } catch (err) {
        setError('森林データの検索に失敗しました')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [radiusMeters, searchFn]
  )

  // 地図中心での追加検索
  const lastMapCenterRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastSearchAtRadiusRef = useRef<number>(radiusMeters)

  const searchAt = useCallback(
    (lat: number, lng: number) => {
      const radiusChanged = lastSearchAtRadiusRef.current !== radiusMeters
      if (lastMapCenterRef.current && !radiusChanged) {
        const dist = calculateDistance(lastMapCenterRef.current.lat, lastMapCenterRef.current.lng, lat, lng)
        if (dist < 1000) return
      }
      lastMapCenterRef.current = { lat, lng }
      lastSearchAtRadiusRef.current = radiusMeters

      try {
        const searchResult = searchFn(lat, lng, radiusMeters)
        if (searchResult.forests.length === 0) return

        const gps = gpsPositionRef.current
        const refLat = gps?.latitude ?? lat
        const refLng = gps?.longitude ?? lng

        setResult((prev) => {
          if (!prev) return prev
          const existingMap = new Map(prev.forests.map((f) => [f.id, f]))
          for (const f of searchResult.forests) {
            if (!existingMap.has(f.id)) {
              existingMap.set(f.id, { ...f, address: addressCache.get(f.id) })
            }
          }
          const merged = Array.from(existingMap.values())
            .map((f) => ({
              ...f,
              distance: calculateDistance(refLat, refLng, f.center.latitude, f.center.longitude),
            }))
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

          // メモリ上限: 蓄積がmaxAccumulatedを超えたら遠い順に削除
          const capped = maxAccumulated > 0 && merged.length > maxAccumulated ? merged.slice(0, maxAccumulated) : merged

          return {
            forests: capped,
            nearest: capped[0] || null,
            searchRadius: Math.max(prev.searchRadius, searchResult.searchRadius),
          }
        })
      } catch (err) {
        console.error('Map center search failed:', err)
      }
    },
    [radiusMeters, searchFn]
  )

  const refresh = useCallback(() => {
    if (position) {
      lastSearchPositionRef.current = null
      doSearch(position)
    }
  }, [position, doSearch])

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

  // 最寄りの森の住所を自動解決
  const nearestId = result?.nearest?.id
  useEffect(() => {
    if (result?.nearest && !result.nearest.address) {
      resolveAddress(result.nearest)
    }
  // nearestIdだけを依存にして無限ループを防ぐ
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestId, resolveAddress])

  return { result, isLoading, error, refresh, searchAt, resolveAddress }
}
