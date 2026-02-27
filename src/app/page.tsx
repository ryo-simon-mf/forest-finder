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
  searchForestsLocal,
  preloadForestData,
  isForestDataLoaded,
} from '@/services/localForestService'

const MIN_RADIUS = 5000

export default function Home() {
  const [dataLoaded, setDataLoaded] = useState(isForestDataLoaded())

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
      preloadForestData().then(() => setDataLoaded(true))
    }
  }, [dataLoaded])

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

  // データ読み込み中
  if (!dataLoaded) {
    return <LoadingScreen />
  }

  const nearestForest = forestResult?.nearest

  const distanceText = nearestForest?.distance
    ? formatDistance(nearestForest.distance)
    : '--'
  const arrivalText = nearestForest?.distance
    ? getEstimatedArrivalTime(nearestForest.distance)
    : ''

  return (
    <main className="h-screen flex flex-col bg-forest text-white">
      <header className="bg-forest px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Forest Finder</h1>
      </header>

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
          <div className="absolute bottom-4 left-4 right-4 z-[1000]">
            <div className="bg-forest rounded-2xl px-6 py-5 shadow-lg">
              <div className="flex items-center">
                <div className="flex-1 basis-0 min-w-0 text-center">
                  <img src={iconImg.src} alt="" className="h-16 w-auto mb-2 mx-auto" />
                  <p className="text-white font-bold text-xl leading-snug">
                    {nearestForest.address || '住所を取得中...'}
                  </p>
                </div>
                <div className="border-l border-white/40 pl-5 ml-5 flex-1 basis-0 text-center">
                  <p className="text-white/80 text-base">現在地から</p>
                  <p className="text-white font-extrabold text-6xl leading-none my-1">
                    {isSearching ? '...' : distanceText}
                  </p>
                  <p className="text-white/80 text-base">{arrivalText}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
