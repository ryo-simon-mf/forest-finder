'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useForestSearch } from '@/hooks/useForestSearch'
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation'
import { useRoute } from '@/hooks/useRoute'
import { LocationPermission } from '@/components/LocationPermission'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ForestTipBubble } from '@/components/ForestTipBubble'
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

// (#6) 住所ローディングアニメーション
function LoadingDots() {
  return (
    <span className="inline-flex gap-[2px]">
      <span className="animate-[blink_1.4s_0s_infinite]">.</span>
      <span className="animate-[blink_1.4s_0.2s_infinite]">.</span>
      <span className="animate-[blink_1.4s_0.4s_infinite]">.</span>
    </span>
  )
}

// (#5) 住所フォーマット
function formatAddress(address: string | undefined): string | undefined {
  if (!address) return undefined
  return address.replace(/(.*?(?:都|道|府|県).*?(?:市|区|郡|町|村))/, '$1\n')
}

const MIN_RADIUS = 5000
const MAX_RADIUS = 15000
const MAX_MARKERS = 30
const MIN_LOADING_MS = 5000

export default function Map3DPage() {
  // (#9) ランディング/ローディング画面
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

  // (#10) デバイス方向取得
  const {
    heading,
    requestPermission: requestOrientationPermission,
  } = useDeviceOrientation()

  // (#9) 「検索する」タップ時: 位置情報許可 + データ読み込み + 最低表示タイマーを同時開始
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

  // (#8) 半径ラチェット
  const [mapRadius, setMapRadius] = useState(MIN_RADIUS)
  const radiusMeters = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, mapRadius))

  const searchFn = useCallback(
    (lat: number, lon: number, radius?: number, limit?: number) =>
      searchForestsLocal(lat, lon, radius, limit),
    []
  )

  const { result: forestResult, isLoading: isSearching, searchAt, resolveAddress } = useForestSearch(
    dataLoaded ? position : null,
    { searchFn, radiusMeters }
  )

  // Selected forest & route
  const [selectedForestId, setSelectedForestId] = useState<string | null>(null)
  const selectedForest = selectedForestId
    ? forestResult?.forests.find((f) => f.id === selectedForestId) ?? null
    : null
  const routeTarget = selectedForest ?? forestResult?.nearest ?? null
  const { route, isLoading: isRouteLoading } = useRoute(position, routeTarget)

  // 表示するマーカーを近い順にMAX_MARKERS件に制限（パフォーマンス対策）
  const displayForests = (forestResult?.forests || []).slice(0, MAX_MARKERS)
  const forestMarkers = displayForests.map((f) => ({
    lat: f.center.latitude,
    lon: f.center.longitude,
    isNearest: f.id === (routeTarget?.id ?? forestResult?.nearest?.id),
  }))

  const handleForestClick = useCallback(
    (index: number) => {
      if (displayForests[index]) {
        setSelectedForestId(displayForests[index].id)
        resolveAddress(displayForests[index])
      }
    },
    [displayForests, resolveAddress]
  )

  // (#8) 半径を量子化し、縮小しない（ズームインで森が消えるのを防止）
  const handleBoundsChange = useCallback((r: number) => {
    const quantized = Math.pow(2, Math.round(Math.log2(r)))
    setMapRadius((prev) => Math.max(prev, quantized))
  }, [])

  // (#7) 地図パン時に追加検索
  const handleMapCenterChange = useCallback((lat: number, lng: number) => {
    searchAt(lat, lng)
  }, [searchAt])

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

  // (#9) まだ開始していない or 拒否/エラー → ランディング画面
  if (!started || status === 'denied' || status === 'unavailable' || status === 'error') {
    return (
      <LocationPermission
        status={status}
        error={error}
        onRequestPermission={handleStart}
      />
    )
  }

  // (#9) 開始済みだがまだ準備完了していない → ローディング画面
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

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  return (
    <main className="h-[100dvh] flex flex-col bg-forest text-white">
      {/* 地図エリア */}
      <div className="flex-1 relative">
        {/* (#2) ForestTipBubble */}
        <ForestTipBubble />

        {/* Header overlay */}
        <div className="absolute top-3 left-3 z-[1000]">
          <a
            href={`${basePath}/`}
            className="bg-white/90 hover:bg-white text-forest-dark text-sm font-medium px-3 py-1.5 rounded-lg shadow"
          >
            &#x2190; 通常マップ
          </a>
        </div>

        {/* ルートローディング */}
        {isRouteLoading && (
          <div className="absolute top-3 right-3 z-[1000] bg-white/90 rounded-full p-2 shadow">
            <div className="animate-spin h-5 w-5 border-2 border-forest border-t-transparent rounded-full" />
          </div>
        )}

        {position && (
          <MapLibre3DViewer
            latitude={position.latitude}
            longitude={position.longitude}
            forestMarkers={forestMarkers}
            route={route ?? undefined}
            heading={heading}
            onForestClick={handleForestClick}
            onBoundsChange={handleBoundsChange}
            onMapCenterChange={handleMapCenterChange}
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
