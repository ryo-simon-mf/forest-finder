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

const DATA_FILE = 'stations-23ku.json'
const MIN_RADIUS = 5000
const MIN_LOADING_MS = 3000

const TIPS = [
  '東京23区には約700の駅があります。\n平均500mごとに駅がある計算です。',
  '世界一忙しい駅は新宿駅。\n1日約350万人が利用します。',
  '東京の鉄道路線は計100以上。\n世界で最も複雑な路線網です。',
  '山手線1周は約60分。\n距離にして34.5kmです。',
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
    <main className="h-[100dvh] flex flex-col items-center justify-center bg-station text-white px-6">
      <div className="flex flex-col items-center">
        <div className="text-8xl mb-10">&#x1F689;</div>
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
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-station text-white p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-9xl mb-6">&#x1F689;</div>
        <h1 className="text-3xl font-bold mb-6">最寄りの駅</h1>
        <p className="text-white/90 text-base leading-relaxed mb-10">
          電車に乗りたい時、最寄り駅は
          <br />
          どこですか？ナビします。
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
              className="bg-white text-station-dark font-semibold py-3 px-10 rounded-lg transition-colors hover:bg-white/90 text-lg"
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

export default function StationPage() {
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
      preloadPOIData(DATA_FILE, true).then(() => setDataLoaded(true))
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
    <main className="h-[100dvh] flex flex-col bg-station text-white">
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
            poiType="station"
          />
        )}

        {displayPOI && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] px-4 pb-[calc(env(safe-area-inset-bottom))]">
            <div className="bg-station rounded-2xl px-6 py-5 shadow-lg">
              <div className="flex items-center">
                <div className="flex-1 basis-0 min-w-0 text-center">
                  <div className="text-5xl mb-2">&#x1F689;</div>
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
            <p className="text-[8px] text-gray-600 text-right mt-1">
              © <a href="https://openstreetmap.org/copyright" className="underline">OpenStreetMap</a> · <a href="https://carto.com" className="underline">CARTO</a> · <a href="https://maps.gsi.go.jp" className="underline">国土地理院</a> · <a href="https://project-osrm.org" className="underline">OSRM</a>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
