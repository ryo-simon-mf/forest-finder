'use client'

import dynamic from 'next/dynamic'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'

const Map = dynamic(() => import('./Map').then((mod) => mod.Map), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent mb-3 mx-auto" />
        <p className="text-gray-400">地図を読み込み中...</p>
      </div>
    </div>
  ),
})

interface MapWrapperProps {
  position: Position
  forests?: ForestArea[]
}

export function MapWrapper({ position, forests = [] }: MapWrapperProps) {
  return <Map position={position} forests={forests} />
}
