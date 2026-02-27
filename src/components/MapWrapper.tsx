'use client'

import dynamic from 'next/dynamic'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'
import type { DisplayMode } from '@/lib/distance'

const Map = dynamic(() => import('./Map').then((mod) => mod.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-forest flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent mb-3 mx-auto" />
        <p className="text-white/80">地図を読み込み中...</p>
      </div>
    </div>
  ),
})

interface MapWrapperProps {
  position: Position
  forests?: ForestArea[]
  heading?: number | null
  displayMode?: DisplayMode
  onBoundsChange?: (radiusMeters: number) => void
  route?: [number, number][]
  isRouteLoading?: boolean
}

export function MapWrapper({ position, forests = [], heading, displayMode = 'distance', onBoundsChange, route, isRouteLoading }: MapWrapperProps) {
  return (
    <div className="h-full w-full relative">
      <Map position={position} forests={forests} heading={heading} displayMode={displayMode} onBoundsChange={onBoundsChange} route={route} />
      {isRouteLoading && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 rounded-full p-2 shadow">
          <div className="animate-spin h-5 w-5 border-2 border-forest border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
