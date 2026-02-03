'use client'

import { useEffect, useRef } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useForestSearch } from '@/hooks/useForestSearch'
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation'
import { LocationPermission } from '@/components/LocationPermission'
import { MapWrapper } from '@/components/MapWrapper'
import { formatDistance } from '@/lib/distance'

export default function Home() {
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

  const { result: forestResult, isLoading: isSearching } = useForestSearch(position)

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

  const nearestForest = forestResult?.nearest
  const distanceText = nearestForest?.distance
    ? formatDistance(nearestForest.distance)
    : '--'

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-green-400">Forest Finder</h1>
      </header>

      {/* 地図エリア */}
      <div className="flex-1 relative">
        {position && (
          <MapWrapper
            position={position}
            forests={forestResult?.forests || []}
            heading={heading}
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
                <p className="text-gray-400 text-sm">最寄りの森林まで</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-green-400">
                    {isSearching ? '...' : distanceText}
                  </p>
                  {isSearching && (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-500 border-t-transparent" />
                  )}
                </div>
                {nearestForest?.name && (
                  <p className="text-gray-500 text-sm mt-1">
                    {nearestForest.name}
                  </p>
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
