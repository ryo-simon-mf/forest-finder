'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useForestSearch } from '@/hooks/useForestSearch'
import { useRoute } from '@/hooks/useRoute'
import { formatDistance, getEstimatedArrivalTime } from '@/lib/distance'
import iconImg from '@/img/icon.svg'
import {
  searchForestsLocal,
  preloadForestData,
  isForestDataLoaded,
} from '@/services/localForestService'

const MapLibre3DViewer = dynamic(() => import('@/components/MapLibre3DViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent mb-3 mx-auto" />
        <p className="text-white/80">3Dビューを準備中...</p>
      </div>
    </div>
  ),
})

type PageState = 'landing' | 'loading' | 'ready'

export default function Map3DPage() {
  const [pageState, setPageState] = useState<PageState>('landing')
  const [dataLoaded, setDataLoaded] = useState(isForestDataLoaded())
  const [error, setError] = useState<string | null>(null)

  const {
    status,
    position,
    error: geoError,
    requestPermission,
    startWatching,
    stopWatching,
  } = useGeolocation()

  const handleStart = useCallback(() => {
    setPageState('loading')
    requestPermission()
    if (!isForestDataLoaded()) {
      preloadForestData().then(() => setDataLoaded(true))
    }
  }, [requestPermission])

  // GPS watching
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

  // 位置情報取得＋データロード完了 → ready
  useEffect(() => {
    if (pageState === 'loading' && position && dataLoaded) {
      setPageState('ready')
    }
  }, [pageState, position, dataLoaded])

  // Forest search
  const searchFn = useCallback(
    (lat: number, lon: number, radius?: number, limit?: number) =>
      searchForestsLocal(lat, lon, radius, limit),
    []
  )

  const { result: forestResult, isLoading: isSearching, resolveAddress } = useForestSearch(
    pageState === 'ready' ? position : null,
    { searchFn, radiusMeters: 5000 }
  )

  // Selected forest & route
  const [selectedForestId, setSelectedForestId] = useState<string | null>(null)
  const selectedForest = selectedForestId
    ? forestResult?.forests.find((f) => f.id === selectedForestId) ?? null
    : null
  const routeTarget = selectedForest ?? forestResult?.nearest ?? null
  const { route, isLoading: isRouteLoading } = useRoute(position, routeTarget)

  // Forest markers
  const forestMarkers = (forestResult?.forests || []).map((f) => ({
    lat: f.center.latitude,
    lon: f.center.longitude,
    isNearest: f.id === (routeTarget?.id ?? forestResult?.nearest?.id),
  }))

  const handleForestClick = useCallback(
    (index: number) => {
      const forests = forestResult?.forests
      if (forests && forests[index]) {
        setSelectedForestId(forests[index].id)
        resolveAddress(forests[index])
      }
    },
    [forestResult, resolveAddress]
  )

  // Handle geolocation errors
  useEffect(() => {
    if (status === 'denied' || status === 'error' || status === 'unavailable') {
      setError(geoError || '位置情報を取得できません')
      setPageState('landing')
    }
  }, [status, geoError])

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  // Landing
  if (pageState === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-forest text-white p-6">
        <div className="max-w-md w-full text-center">
          <img src={iconImg.src} alt="" className="h-32 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">3Dマップ</h1>
          <p className="text-white/80 text-base leading-relaxed mb-8">
            最寄りの森を3Dマップで表示します。
            <br />
            地図を回転・傾けて立体的に見られます。
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-300/50 rounded-xl p-4 mb-6">
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleStart}
            className="bg-white text-forest-dark font-semibold py-3 px-10 rounded-lg transition-colors hover:bg-white/90 text-lg mb-4"
          >
            3Dで表示する
          </button>

          <p className="text-white/50 text-sm mb-8">
            ※位置情報の許可が必要です
          </p>

          <a
            href={`${basePath}/`}
            className="text-white/70 hover:text-white text-sm underline"
          >
            &#x2190; 通常マップに戻る
          </a>
        </div>
      </div>
    )
  }

  // Loading
  if (pageState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-forest text-white p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4 mx-auto" />
          <p className="text-white/80 text-base mb-2">
            {!position ? '位置情報を取得中...' : 'データを読み込み中...'}
          </p>
        </div>
      </div>
    )
  }

  // Ready
  const displayForest = routeTarget
  const walkingMinutes = displayForest?.distance
    ? Math.ceil(displayForest.distance / 80)
    : null
  const distanceText = walkingMinutes !== null ? `${walkingMinutes}分` : '--'
  const subText = displayForest?.distance
    ? `${formatDistance(displayForest.distance)}・${getEstimatedArrivalTime(displayForest.distance).replace('に到着', '')}`
    : ''

  return (
    <main className="h-[100dvh] flex flex-col bg-gray-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-gray-900/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <a
            href={`${basePath}/`}
            className="text-white/80 hover:text-white text-sm font-medium"
          >
            &#x2190; 通常マップに戻る
          </a>
          <div className="flex items-center gap-2">
            {isRouteLoading && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
          </div>
        </div>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1">
        {position && (
          <MapLibre3DViewer
            latitude={position.latitude}
            longitude={position.longitude}
            forestMarkers={forestMarkers}
            route={route ?? undefined}
            onForestClick={handleForestClick}
          />
        )}
      </div>

      {/* Forest card */}
      {displayForest && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="bg-forest rounded-2xl px-6 py-5 shadow-lg h-[140px] overflow-hidden">
            <div className="flex items-center h-full">
              <div className="flex-1 basis-0 min-w-0 text-center flex flex-col items-center justify-center">
                <img src={iconImg.src} alt="" className="h-12 w-auto mb-1 mx-auto" />
                <p className="text-white font-bold text-base leading-snug whitespace-pre-line">
                  {displayForest.address || '住所取得中...'}
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
    </main>
  )
}
