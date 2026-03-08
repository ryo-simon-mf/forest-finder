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
import iconImg from '@/img/icon.svg'
import { ForestTipBubble } from '@/components/ForestTipBubble'
import {
  searchForestsLocal,
  preloadForestData,
  isForestDataLoaded,
} from '@/services/localForestService'

function LoadingDots() {
  return (
    <span className="inline-flex gap-[2px]">
      <span className="animate-[blink_1.4s_0s_infinite]">.</span>
      <span className="animate-[blink_1.4s_0.2s_infinite]">.</span>
      <span className="animate-[blink_1.4s_0.4s_infinite]">.</span>
    </span>
  )
}

const MIN_RADIUS = 5000
const MIN_LOADING_MS = 5000

function formatAddress(address: string | undefined): string | undefined {
  if (!address) return undefined
  // 「都/道/府/県」+「市/区/郡/町/村」の後に改行を1回だけ入れる
  return address.replace(/(.*?(?:都|道|府|県).*?(?:市|区|郡|町|村))/, '$1\n')
}

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

  const { result: forestResult, isLoading: isSearching, searchAt, resolveAddress } = useForestSearch(
    dataLoaded ? position : null,
    { searchFn, radiusMeters }
  )

  const [selectedForestId, setSelectedForestId] = useState<string | null>(null)
  const selectedForest = selectedForestId
    ? forestResult?.forests.find((f) => f.id === selectedForestId) ?? null
    : null
  const routeTarget = selectedForest ?? forestResult?.nearest ?? null
  const { route, isLoading: isRouteLoading } = useRoute(position, routeTarget)

  const handleForestSelect = useCallback((forest: ForestArea) => {
    setSelectedForestId(forest.id)
    resolveAddress(forest)
  }, [resolveAddress])

  // 半径を量子化し、縮小しない（ズームインで森が消えるのを防止）
  const handleBoundsChange = useCallback((r: number) => {
    const quantized = Math.pow(2, Math.round(Math.log2(r)))
    setMapRadius((prev) => Math.max(prev, quantized))
  }, [])

  // 地図パン時に追加検索
  const handleMapCenterChange = useCallback((lat: number, lng: number) => {
    searchAt(lat, lng)
  }, [searchAt])

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
        <ForestTipBubble />
        {position && (
          <MapWrapper
            position={position}
            forests={forestResult?.forests || []}
            heading={heading}
            onBoundsChange={handleBoundsChange}
            onMapCenterChange={handleMapCenterChange}
            route={route ?? undefined}
            isRouteLoading={isRouteLoading}
            onForestSelect={handleForestSelect}
          />
        )}

        {/* 最寄り森林カード */}
        {displayForest && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="bg-forest rounded-2xl px-6 py-5 shadow-lg h-[140px] overflow-hidden">
              <div className="flex items-center h-full">
                <div className="flex-1 basis-0 min-w-0 text-center flex flex-col items-center justify-center">
                  <img src={iconImg.src} alt="" className="h-12 w-auto mb-1 mx-auto" />
                  <p className="text-white font-bold text-base leading-snug whitespace-pre-line">
                    {formatAddress(displayForest.address) || <>住所取得中<LoadingDots /></>}
                  </p>
                </div>
                <div className="border-l border-white/40 pl-5 ml-5 flex-1 basis-0 text-center flex flex-col justify-center">
                  <p className="text-white text-sm font-bold">現在地から</p>
                  <p className="text-white font-extrabold text-5xl leading-none my-1">
                    {isSearching ? '...' : distanceText}
                  </p>
                  <p className="text-white text-sm font-bold">{subText}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
