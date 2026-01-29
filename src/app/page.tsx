'use client'

import { useEffect, useRef } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { LocationPermission } from '@/components/LocationPermission'
import { LocationDisplay } from '@/components/LocationDisplay'
import { MapWrapper } from '@/components/MapWrapper'

export default function Home() {
  const {
    status,
    position,
    error,
    requestPermission,
    startWatching,
    stopWatching,
  } = useGeolocation()

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

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-green-400">Forest Finder</h1>
      </header>

      {/* 地図エリア */}
      <div className="flex-1 relative">
        {position && <MapWrapper position={position} />}

        {/* 距離表示オーバーレイ */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="bg-gray-800/95 backdrop-blur rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">最寄りの森林まで</p>
                <p className="text-3xl font-bold text-green-400">-- km</p>
              </div>
              {position && (
                <div className="text-right text-sm">
                  <p className="text-gray-500">精度</p>
                  <p className="text-white">±{Math.round(position.accuracy)}m</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
