'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Position } from '@/types/geolocation'
import type { ForestSearchResult, ForestArea } from '@/types/forest'
import { searchForestsLocal } from '@/services/localForestService'
import { calculateDistance } from '@/lib/distance'
import { resolveForestAddresses } from '@/lib/reverseGeocode'

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
}

interface UseForestSearchReturn {
  result: ForestSearchResult | null
  isLoading: boolean
  error: string | null
  refresh: () => void
  searchAt: (lat: number, lng: number) => void
}

// 住所キャッシュ（マージで上書きされても復元できる）
const addressCache = new Map<string, string>()

export function useForestSearch(
  position: Position | null,
  options: UseForestSearchOptions = {}
): UseForestSearchReturn {
  const { radiusMeters = 5000, minDistanceChange = 50, searchFn = searchForestsLocal } = options

  const [result, setResult] = useState<ForestSearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastSearchPositionRef = useRef<Position | null>(null)
  const lastRadiusRef = useRef<number>(radiusMeters)
  const gpsPositionRef = useRef<Position | null>(position)
  gpsPositionRef.current = position

  // デプロイ済みと同じ住所解決ロジック（バッチ処理）
  const resolveAndApply = useCallback((forests: ForestArea[]) => {
    const needsAddress = forests.filter((f) => !f.address && !addressCache.has(f.id))
    if (needsAddress.length === 0) return

    resolveForestAddresses(needsAddress).then((addressMap) => {
      // キャッシュに保存
      addressMap.forEach((addr, id) => { if (addr) addressCache.set(id, addr) })

      setResult((prev) => {
        if (!prev) return prev
        const updated = prev.forests.map((f) => {
          const addr = addressMap.get(f.id) || addressCache.get(f.id)
          return addr ? { ...f, address: addr } : f
        })
        return { ...prev, forests: updated, nearest: updated[0] || null }
      })
    })
  }, [])

  const doSearch = useCallback(
    (pos: Position) => {
      setIsLoading(true)
      setError(null)

      try {
        const searchResult = searchFn(pos.latitude, pos.longitude, radiusMeters)

        // 既存resultとマージ
        setResult((prev) => {
          if (!prev) {
            // 初回: キャッシュから住所を復元
            const forests = searchResult.forests.map((f) => ({
              ...f,
              address: f.address || addressCache.get(f.id),
            }))
            return { ...searchResult, forests, nearest: forests[0] || null }
          }

          // マージ: 既存を保持しつつ新規を追加
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

          return {
            forests: merged,
            nearest: merged[0] || null,
            searchRadius: Math.max(prev.searchRadius, searchResult.searchRadius),
          }
        })
        lastSearchPositionRef.current = pos

        // 住所解決（デプロイ済みと同じ方式）
        resolveAndApply(searchResult.forests)
      } catch (err) {
        setError('森林データの検索に失敗しました')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [radiusMeters, searchFn, resolveAndApply]
  )

  // 地図中心での追加検索（住所解決はしない）
  const lastMapCenterRef = useRef<{ lat: number; lng: number } | null>(null)

  const searchAt = useCallback(
    (lat: number, lng: number) => {
      if (lastMapCenterRef.current) {
        const dist = calculateDistance(lastMapCenterRef.current.lat, lastMapCenterRef.current.lng, lat, lng)
        if (dist < 1000) return
      }
      lastMapCenterRef.current = { lat, lng }

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

          return {
            forests: merged,
            nearest: merged[0] || null,
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

    // 検索半径が変わった場合は再検索
    if (lastRadiusRef.current !== radiusMeters) {
      lastRadiusRef.current = radiusMeters
      doSearch(position)
      return
    }

    const lastPos = lastSearchPositionRef.current

    // 初回検索
    if (!lastPos) {
      doSearch(position)
      return
    }

    // 前回の検索位置からの距離を計算
    const distance = calculateDistance(
      lastPos.latitude,
      lastPos.longitude,
      position.latitude,
      position.longitude
    )

    // 一定距離以上移動した場合のみ再検索
    if (distance >= minDistanceChange) {
      doSearch(position)
    }
  }, [position, minDistanceChange, doSearch, radiusMeters])

  return { result, isLoading, error, refresh, searchAt }
}
