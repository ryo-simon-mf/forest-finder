'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useForestSearch } from '@/hooks/useForestSearch'
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation'
import { useRoute } from '@/hooks/useRoute'
import { LocationPermission } from '@/components/LocationPermission'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MapWrapper } from '@/components/MapWrapper'
import { formatDistance, getEstimatedArrivalTime } from '@/lib/distance'
import type { ForestArea } from '@/types/forest'
import iconImg from '@/img/icon.png'
import {
  searchForestsLocal,
  preloadForestData,
  isForestDataLoaded,
} from '@/services/localForestService'

const MIN_RADIUS = 5000
const MIN_LOADING_MS = 5000

export default function Home() {
  const [started, setStarted] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(isForestDataLoaded())
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  const {
    status,
    position,
    error,
    requestPermission,
    startWatching,
    stopWatching,
  } = useGeolocation()

  const {
    heading,
    requestPermission: requestOrientationPermission,
  } = useDeviceOrientation()

  // 「検索する」タップ時: 位置情報許可 + データ読み込み + 最低表示タイマーを同時開始
  const handleStart = useCallback(() => {
    setStarted(true)
    requestPermission()
    requestOrientationPermission()
    if (!dataLoaded) {
      preloadForestData().then(() => setDataLoaded(true))
    }
    setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS)
  }, [requestPermission, requestOrientationPermission, dataLoaded])

  const isReady = started && status === 'granted' && dataLoaded && minTimeElapsed

  const [mapRadius, setMapRadius] = useState(MIN_RADIUS)
  const radiusMeters = Math.max(MIN_RADIUS, mapRadius)

  const searchFn = useCallback(
    (lat: number, lon: number, radius?: number, limit?: number) => {
      return searchForestsLocal(lat, lon, radius, limit)
    },
    []
  )

  const { result: forestResult, isLoading: isSearching } = useForestSearch(
    dataLoaded ? position : null,
    { searchFn, radiusMeters }
  )

  const [selectedForest, setSelectedForest] = useState<ForestArea | null>(null)
  const routeTarget = selectedForest ?? forestResult?.nearest ?? null
  const { route, isLoading: isRouteLoading } = useRoute(position, routeTarget)

  const handleForestSelect = useCallback((forest: ForestArea) => {
    setSelectedForest(forest)
  }, [])

  // 半径を量子化し、縮小しない（ズームインで森が消えるのを防止）
  const handleBoundsChange = useCallback((r: number) => {
    const quantized = Math.pow(2, Math.round(Math.log2(r)))
    setMapRadius((prev) => Math.max(prev, quantized))
  }, [])

  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (status === 'granted' && !watchIdRef.current) {
      watchIdRef.current = startWatching()
    }

    return () => {
      if (watchIdRef.current !== null) {
        stopWatching(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [status, startWatching, stopWatching])

  // まだ開始していない or 拒否/エラー → ランディング画面
  if (!started || status === 'denied' || status === 'unavailable' || status === 'error') {
    return (
      <LocationPermission
        status={status}
        error={error}
        onRequestPermission={handleStart}
      />
    )
  }

  // 開始済みだがまだ準備完了していない → ローディング画面
  if (!isReady) {
    return <LoadingScreen />
  }

  const displayForest = routeTarget

  const walkingMinutes = displayForest?.distance
    ? Math.ceil(displayForest.distance / 80)
    : null
  const distanceText = walkingMinutes !== null ? `${walkingMinutes}分` : '--'
  const subText = displayForest?.distance
    ? `${formatDistance(displayForest.distance)}・${getEstimatedArrivalTime(displayForest.distance).replace('に到着', '')}`
    : ''

  return (
    <main className="h-[100dvh] flex flex-col bg-forest text-white">
      {/* 地図エリア */}
      <div className="flex-1 relative">
        {position && (
          <MapWrapper
            position={position}
            forests={forestResult?.forests || []}
            heading={heading}
            onBoundsChange={handleBoundsChange}
            route={route ?? undefined}
            isRouteLoading={isRouteLoading}
            onForestSelect={handleForestSelect}
          />
        )}

        {/* 最寄り森林カード */}
        {displayForest && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="bg-forest rounded-2xl px-6 py-5 shadow-lg">
              <div className="flex items-center">
                <div className="flex-1 basis-0 min-w-0 text-center">
                  <img src={iconImg.src} alt="" className="h-16 w-auto mb-2 mx-auto" />
                  <p className="text-white font-bold text-lg leading-snug">
                    {displayForest.address || '住所を取得中...'}
                  </p>
                </div>
                <div className="border-l border-white/40 pl-5 ml-5 flex-1 basis-0 text-center">
                  <p className="text-white text-base font-bold">現在地から</p>
                  <p className="text-white font-extrabold text-6xl leading-none my-1">
                    {isSearching ? '...' : distanceText}
                  </p>
                  <p className="text-white text-base font-bold">{subText}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
