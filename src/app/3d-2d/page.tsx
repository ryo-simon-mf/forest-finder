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
    <div className="h-full w-full bg-forest flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent mb-3 mx-auto" />
        <p className="text-white/80">マップを準備中...</p>
      </div>
    </div>
  ),
})

function LoadingDots() {
  return (
    <span className="inline-flex gap-[2px]">
      <span className="animate-[blink_1.4s_0s_infinite]">.</span>
      <span className="animate-[blink_1.4s_0.2s_infinite]">.</span>
      <span className="animate-[blink_1.4s_0.4s_infinite]">.</span>
    </span>
  )
}

function formatAddress(address: string | undefined): string | undefined {
  if (!address) return undefined
  return address.replace(/(.*?(?:都|道|府|県).*?(?:市|区|郡|町|村))/, '$1\n')
}

const MIN_RADIUS = 5000
const MIN_LOADING_MS = 5000


export default function Map3D2DPage() {
  const MAX_RADIUS = 999999

  const [started, setStarted] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(isForestDataLoaded())
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [animateReady, setAnimateReady] = useState(false)

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
  // positionが取れたらマップ描画開始（ローディング画面の裏で）
  const canRenderMap = started && position

  // isReady後にフェードアウト → アニメーション発火
  const [overlayVisible, setOverlayVisible] = useState(true)
  useEffect(() => {
    if (isReady && overlayVisible) {
      // フェードアウト開始 → 完了後にアニメーション発火
      const timer = setTimeout(() => {
        setOverlayVisible(false)
        setAnimateReady(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isReady, overlayVisible])

  const [mapRadius, setMapRadius] = useState(MIN_RADIUS)
  const radiusMeters = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, mapRadius))


  const searchFn = useCallback(
    (lat: number, lon: number, radius?: number, limit?: number) =>
      searchForestsLocal(lat, lon, radius, limit),
    []
  )

  const { result: forestResult, isLoading: isSearching, searchAt, resolveAddress } = useForestSearch(
    dataLoaded ? position : null,
    { searchFn, radiusMeters, maxAccumulated: 0 }
  )

  const [selectedForestId, setSelectedForestId] = useState<string | null>(null)
  const selectedForest = selectedForestId
    ? forestResult?.forests.find((f) => f.id === selectedForestId) ?? null
    : null
  const routeTarget = selectedForest ?? forestResult?.nearest ?? null
  const { route, isLoading: isRouteLoading } = useRoute(position, routeTarget)

  // ネイティブレイヤー（スマホ）/ DOMマーカー（PC）共通: 全件渡す
  const allForests = forestResult?.forests || []
  const nearestId = forestResult?.nearest?.id
  const displayForests = allForests

  const forestMarkers = displayForests.map((f) => ({
    lat: f.center.latitude,
    lon: f.center.longitude,
    isNearest: f.id === nearestId,
    isSelected: f.id === selectedForestId,
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

  const handleBoundsChange = useCallback((r: number) => {
    const quantized = Math.pow(2, Math.round(Math.log2(r)))
    setMapRadius((prev) => Math.max(prev, quantized))
  }, [])

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

  // ランディング画面
  if (!started || status === 'denied' || status === 'unavailable' || status === 'error') {
    return (
      <LocationPermission
        status={status}
        error={error}
        onRequestPermission={handleStart}
      />
    )
  }

  const displayForest = routeTarget
  const walkingMinutes = displayForest?.distance
    ? Math.ceil(displayForest.distance / 80)
    : null
  const distanceNumber = walkingMinutes !== null ? `${walkingMinutes}` : '--'
  const subText = displayForest?.distance
    ? `${formatDistance(displayForest.distance)}・${getEstimatedArrivalTime(displayForest.distance).replace('に到着', '')}`
    : ''

  // const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  return (
    <main className="h-[100dvh] flex flex-col bg-forest text-white">
      <div className="flex-1 relative">
        {/* マップ（positionが取れたらローディング中でも裏で描画） */}
        {canRenderMap && (
          <MapLibre3DViewer
            latitude={position.latitude}
            longitude={position.longitude}
            forestMarkers={forestMarkers}
            route={route ?? undefined}
            heading={heading}
            topDown
            animateReady={animateReady}
            onForestClick={handleForestClick}
            onBoundsChange={handleBoundsChange}
            onMapCenterChange={handleMapCenterChange}
          />
        )}

        {/* ローディングオーバーレイ（マップの上に重ねて表示） */}
        {!animateReady && (
          <div
            className="absolute inset-0 z-[2000] transition-opacity duration-500"
            style={{ opacity: isReady ? 0 : 1 }}
          >
            <LoadingScreen />
          </div>
        )}

        {/* 以下はマップ準備完了後のみ表示 */}
        {animateReady && (
          <>
            <ForestTipBubble />

            {/* <div className="absolute top-3 left-3 z-[1000]">
              <a
                href={`${basePath}/`}
                className="bg-white/90 hover:bg-white text-forest-dark text-sm font-medium px-3 py-1.5 rounded-lg shadow"
              >
                &#x2190; 通常マップ
              </a>
            </div> */}

            {isRouteLoading && (
              <div className="absolute top-3 right-3 z-[1000] bg-white/90 rounded-full p-2 shadow">
                <div className="animate-spin h-5 w-5 border-2 border-forest border-t-transparent rounded-full" />
              </div>
            )}
          </>
        )}

        {/* 最寄り森林カード */}
        {animateReady && displayForest && (
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
                  <p className="text-white leading-none my-1">
                    <span className="font-extrabold text-5xl">{isSearching ? '...' : distanceNumber}</span>
                    {!isSearching && walkingMinutes !== null && <span className="font-bold text-2xl ml-0.5">分</span>}
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
