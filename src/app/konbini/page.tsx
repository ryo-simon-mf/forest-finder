'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { usePOISearch } from '@/hooks/usePOISearch'
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation'
import { useRoute } from '@/hooks/useRoute'
import { MapWrapper } from '@/components/MapWrapper'
import { formatDistance, getEstimatedArrivalTime } from '@/lib/distance'
import type { ForestArea } from '@/types/forest'
import {
  searchPOILocal,
  preloadPOIData,
  isPOIDataLoaded,
} from '@/services/poiService'

const DATA_FILE = 'konbini-23ku.json'
const MIN_RADIUS = 3000
const MIN_LOADING_MS = 3000

const TIPS = [
  '日本のコンビニは約5.6万店。\n人口2,300人に1店の密度です。',
  'セブンイレブンの名前の由来は\n朝7時から夜11時まで。',
  '日本初のコンビニは1974年、\n東京・豊洲のセブンイレブンです。',
  'コンビニのATM利用は\n年間約9億件です。',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function LoadingScreen() {
  const [shuffled] = useState(() => shuffle(TIPS))
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % shuffled.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [shuffled.length])

  return (
    <main className="h-[100dvh] flex flex-col items-center justify-center bg-konbini text-white px-6">
      <div className="flex flex-col items-center">
        <div className="text-8xl mb-10">&#x1F3EA;</div>
        <div className="w-40 h-1.5 bg-white/30 overflow-hidden mb-6">
          <div className="h-full bg-white animate-loading-progress" />
        </div>
        <p className="text-white/90 text-base text-center leading-relaxed whitespace-pre-line">
          {shuffled[tipIndex]}
        </p>
      </div>
    </main>
  )
}

function LandingScreen({ status, error, onStart }: { status: string; error: string | null; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-konbini text-white p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-9xl mb-6">&#x1F3EA;</div>
        <h1 className="text-3xl font-bold mb-6">最寄りのコンビニ</h1>
        <p className="text-white/90 text-base leading-relaxed mb-10">
          今すぐ必要なもの、ありますよね。
          <br />
          最寄りのコンビニまでナビします。
        </p>
        {(status === 'idle' || status === 'denied' || status === 'unavailable' || status === 'error') && (
          <>
            {error && (
              <div className="bg-red-500/20 border border-red-300/50 rounded-xl p-4 mb-6">
                <p className="text-white">{error}</p>
              </div>
            )}
            <button
              onClick={onStart}
              className="bg-white text-konbini-dark font-semibold py-3 px-10 rounded-lg transition-colors hover:bg-white/90 text-lg"
            >
              <span className="mr-2">&#x1F50D;</span>検索する
            </button>
            <p className="text-white/70 text-sm mt-4">
              ※位置情報の許可が必要です。
            </p>
          </>
        )}
        {status === 'requesting' && (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4" />
            <p className="text-white/80">位置情報を取得中...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KonbiniPage() {
  const [started, setStarted] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(isPOIDataLoaded(DATA_FILE))
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  const { status, position, error, requestPermission, startWatching, stopWatching } = useGeolocation()
  const { heading, requestPermission: requestOrientationPermission } = useDeviceOrientation()

  const handleStart = useCallback(() => {
    setStarted(true)
    requestPermission()
    requestOrientationPermission()
    if (!dataLoaded) {
      preloadPOIData(DATA_FILE, false).then(() => setDataLoaded(true))
    }
    setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS)
  }, [requestPermission, requestOrientationPermission, dataLoaded])

  const isReady = started && status === 'granted' && dataLoaded && minTimeElapsed

  const [mapRadius, setMapRadius] = useState(MIN_RADIUS)
  const radiusMeters = Math.max(MIN_RADIUS, mapRadius)

  const { result: poiResult, isLoading: isSearching } = usePOISearch(
    dataLoaded ? position : null,
    {
      searchFn: (lat, lon, radius, limit) => searchPOILocal(DATA_FILE, lat, lon, radius, limit),
      radiusMeters,
    }
  )

  const forests = poiResult?.points?.map(p => ({
    ...p,
    center: p.center,
  })) || []
  const nearest = poiResult?.nearest || null

  const [selectedPOI, setSelectedPOI] = useState<ForestArea | null>(null)
  const routeTarget = selectedPOI ?? nearest ?? null
  const { route, isLoading: isRouteLoading } = useRoute(position, routeTarget)

  const handlePOISelect = useCallback((poi: ForestArea) => {
    setSelectedPOI(poi)
  }, [])

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

  if (!started || status === 'denied' || status === 'unavailable' || status === 'error') {
    return <LandingScreen status={status} error={error} onStart={handleStart} />
  }
  if (!isReady) {
    return <LoadingScreen />
  }

  const displayPOI = routeTarget
  const walkingMinutes = displayPOI?.distance ? Math.ceil(displayPOI.distance / 80) : null
  const distanceText = walkingMinutes !== null ? `${walkingMinutes}分` : '--'
  const subText = displayPOI?.distance
    ? `${formatDistance(displayPOI.distance)}・${getEstimatedArrivalTime(displayPOI.distance).replace('に到着', '')}`
    : ''

  return (
    <main className="h-[100dvh] flex flex-col bg-konbini text-white">
      <div className="flex-1 relative">
        {position && (
          <MapWrapper
            position={position}
            forests={forests}
            heading={heading}
            onBoundsChange={handleBoundsChange}
            route={route ?? undefined}
            isRouteLoading={isRouteLoading}
            onForestSelect={handlePOISelect}
            poiType="konbini"
          />
        )}

        {displayPOI && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="bg-konbini rounded-2xl px-6 py-5 shadow-lg">
              <div className="flex items-center">
                <div className="flex-1 basis-0 min-w-0 text-center">
                  <div className="text-5xl mb-2">&#x1F3EA;</div>
                  <p className="text-white font-bold text-lg leading-snug">
                    {displayPOI.name || displayPOI.address || '住所を取得中...'}
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
