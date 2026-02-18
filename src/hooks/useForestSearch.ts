'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Position } from '@/types/geolocation'
import type { ForestSearchResult } from '@/types/forest'
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
}

export function useForestSearch(
  position: Position | null,
  options: UseForestSearchOptions = {}
): UseForestSearchReturn {
  const { radiusMeters = 5000, minDistanceChange = 50, searchFn = searchForestsLocal } = options

  const [result, setResult] = useState<ForestSearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastSearchPositionRef = useRef<Position | null>(null)

  const doSearch = useCallback(
    (pos: Position) => {
      setIsLoading(true)
      setError(null)

      try {
        // ローカルデータから検索（同期処理なので高速）
        const searchResult = searchFn(
          pos.latitude,
          pos.longitude,
          radiusMeters
        )
        setResult(searchResult)
        lastSearchPositionRef.current = pos

        // 住所が未設定のエントリを逆ジオコーディングで解決
        const needsAddress = searchResult.forests.filter((f) => !f.address)
        if (needsAddress.length > 0) {
          resolveForestAddresses(needsAddress).then((addressMap) => {
            setResult((prev) => {
              if (!prev) return prev
              const forests = prev.forests.map((f) => {
                const addr = addressMap.get(f.id)
                return addr ? { ...f, address: addr } : f
              })
              return { ...prev, forests, nearest: forests[0] || null }
            })
          })
        }
      } catch (err) {
        setError('森林データの検索に失敗しました')
        console.error(err)
      } finally {
        setIsLoading(false)
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
  }, [position, minDistanceChange, doSearch])

  return { result, isLoading, error, refresh }
}
