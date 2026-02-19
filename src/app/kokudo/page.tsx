'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useForestSearch } from '@/hooks/useForestSearch'
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation'
import { LocationPermission } from '@/components/LocationPermission'
import { MapWrapper } from '@/components/MapWrapper'
import { formatByMode, type DisplayMode } from '@/lib/distance'
import {
  searchKokudoForestsLocal,
  preloadKokudoData,
  isKokudoDataLoaded,
} from '@/services/kokudoForestService'

const MIN_RADIUS = 50000

export default function KokudoPage() {
  const [dataLoaded, setDataLoaded] = useState(isKokudoDataLoaded())

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

  const [displayMode, setDisplayMode] = useState<DisplayMode>('distance')

  const handleBoundsChange = useCallback((r: number) => setMapRadius(r), [])

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
    return (
      <main className="h-screen flex flex-col bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
          <h1 className="text-xl font-bold text-green-400">
            Forest Finder
            <span className="text-sm font-normal text-gray-400 ml-2">
              国土数値情報版
            </span>
          </h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-400">森林データを読み込み中...</p>
            <p className="text-gray-500 text-sm mt-1">（約125,000件）</p>
          </div>
        </div>
      </main>
    )
  }

  const nearestForest = forestResult?.nearest
  const distanceText = nearestForest?.distance
    ? formatByMode(nearestForest.distance, displayMode)
    : '--'

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-green-400">
          Forest Finder
          <span className="text-sm font-normal text-gray-400 ml-2">
            国土数値情報版
          </span>
        </h1>
      </header>

      {/* 地図エリア */}
      <div className="flex-1 relative">
        {position && (
          <MapWrapper
            position={position}
            forests={forestResult?.forests || []}
            heading={heading}
            displayMode={displayMode}
            onBoundsChange={handleBoundsChange}
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

        {/* 距離表示オーバーレイ */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="bg-gray-800/95 backdrop-blur rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-400 text-sm">最寄りの森林まで</p>
                  <button
                    onClick={() => setDisplayMode(m => m === 'distance' ? 'walking' : 'distance')}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    {displayMode === 'distance' ? '🚶 徒歩' : '📏 距離'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-green-400">
                    {isSearching ? '...' : distanceText}
                  </p>
                  {isSearching && (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-500 border-t-transparent" />
                  )}
                </div>
                {nearestForest && (
                  <div className="text-gray-500 text-sm mt-1">
                    {nearestForest.name && <p>{nearestForest.name}</p>}
                    <p className="text-gray-600 text-xs">
                      📍 {nearestForest.address || '住所を取得中...'}
                    </p>
                  </div>
                )}
              </div>
              <div className="text-right text-sm">
                {position && (
                  <>
                    <p className="text-gray-500">精度</p>
                    <p className="text-white">±{Math.round(position.accuracy)}m</p>
                  </>
                )}
                {heading !== null && (
                  <p className="text-gray-400 mt-1">
                    🧭 {Math.round(heading)}°
                  </p>
                )}
                {forestResult && (
                  <p className="text-gray-500 mt-1">
                    {forestResult.forests.length}件の森林
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
