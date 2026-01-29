'use client'

import type { Position } from '@/types/geolocation'

interface LocationDisplayProps {
  position: Position
}

export function LocationDisplay({ position }: LocationDisplayProps) {
  const formatCoordinate = (value: number, isLatitude: boolean) => {
    const direction = isLatitude
      ? value >= 0
        ? 'N'
        : 'S'
      : value >= 0
        ? 'E'
        : 'W'
    return `${Math.abs(value).toFixed(6)}° ${direction}`
  }

  const formatAccuracy = (accuracy: number) => {
    if (accuracy < 1000) {
      return `${Math.round(accuracy)}m`
    }
    return `${(accuracy / 1000).toFixed(1)}km`
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        <span className="text-green-400 font-medium">位置情報取得中</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">緯度</p>
          <p className="text-white font-mono">
            {formatCoordinate(position.latitude, true)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">経度</p>
          <p className="text-white font-mono">
            {formatCoordinate(position.longitude, false)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-500">精度</p>
          <p className="text-white font-mono">
            ± {formatAccuracy(position.accuracy)}
          </p>
        </div>
      </div>
    </div>
  )
}
