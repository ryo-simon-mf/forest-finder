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
import iconImg from '@/img/icon.png'
import {
  searchKokudoForestsLocal,
  preloadKokudoData,
  isKokudoDataLoaded,
} from '@/services/kokudoForestService'

const MIN_RADIUS = 50000
const MIN_LOADING_MS = 5000

export default function KokudoPage() {
  const [dataLoaded, setDataLoaded] = useState(isKokudoDataLoaded())
  const [minTimeElapsed, setMinTimeElapsed] = useState(isKokudoDataLoaded())

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS)
    return () => clearTimeout(timer)
  }, [])

  const showMap = dataLoaded && minTimeElapsed

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
    permissionState: orientationPermission,
    requestPermission: requestOrientationPermission,
  } = useDeviceOrientation()

  // データの事前読み込み
  useEffect(() => {
    if (!dataLoaded) {
      preloadKokudoData().then(() => setDataLoaded(true))
    }
  }, [dataLoaded])

  const searchFn = useCallback(
    (lat: number, lon: number, radius?: number, limit?: number) => {
      return searchKokudoForestsLocal(lat, lon, radius, limit)
    },
    []
  )

  const [mapRadius, setMapRadius] = useState(MIN_RADIUS)
  const radiusMeters = Math.max(MIN_RADIUS, mapRadius)

  const { result: forestResult, isLoading: isSearching } = useForestSearch(
    dataLoaded ? position : null,
    { searchFn, radiusMeters }
  )

  const { route, isLoading: isRouteLoading } = useRoute(position, forestResult?.nearest ?? null)

  // 半径を量子化（2のべき乗に丸め）して微小変化による再検索を防止
  const handleBoundsChange = useCallback((r: number) => {
    const quantized = Math.pow(2, Math.round(Math.log2(r)))
    setMapRadius(quantized)
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

  if (status !== 'granted') {
    return (
      <LocationPermission
        status={status}
        error={error}
        onRequestPermission={requestPermission}
      />
    )
  }

  // データ読み込み中 or 最低表示時間待ち
  if (!showMap) {
    return <LoadingScreen />
  }

  const nearestForest = forestResult?.nearest

  const walkingMinutes = nearestForest?.distance
    ? Math.ceil(nearestForest.distance / 80)
    : null
  const distanceText = walkingMinutes !== null ? `${walkingMinutes}分` : '--'
  const subText = nearestForest?.distance
    ? `${formatDistance(nearestForest.distance)}・${getEstimatedArrivalTime(nearestForest.distance).replace('に到着', '')}`
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
          />
        )}

        {/* iOS用コンパス許可ボタン */}
        {orientationPermission === 'prompt' && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000]">
            <button
              onClick={requestOrientationPermission}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm"
            >
              <span>🧭</span>
              <span>コンパスを有効にする</span>
            </button>
          </div>
        )}

        {/* 最寄り森林カード */}
        {nearestForest && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="bg-forest rounded-2xl px-6 py-5 shadow-lg">
              <div className="flex items-center">
                <div className="flex-1 basis-0 min-w-0 text-center">
                  <img src={iconImg.src} alt="" className="h-16 w-auto mb-2 mx-auto" />
                  <p className="text-white font-bold text-lg leading-snug">
                    {nearestForest.address || '住所を取得中...'}
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
