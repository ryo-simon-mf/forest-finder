'use client'

import type { GeolocationStatus } from '@/types/geolocation'
import iconImg from '@/img/icon.png'

interface LocationPermissionProps {
  status: GeolocationStatus
  error: string | null
  onRequestPermission: () => void
}

export function LocationPermission({
  status,
  error,
  onRequestPermission,
}: LocationPermissionProps) {
  if (status === 'granted') {
    return null
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-forest text-white p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <img src={iconImg.src} alt="Forest Finder" className="h-24 w-auto mx-auto" />
        </div>

        <h1 className="text-2xl font-bold mb-4">Forest Finder</h1>

        {status === 'idle' && (
          <>
            <p className="text-white/80 mb-8">
              近くの森林を見つけるために、位置情報の許可が必要です
            </p>
            <button
              onClick={onRequestPermission}
              className="w-full bg-white text-forest-dark font-semibold py-4 px-6 rounded-xl transition-colors hover:bg-white/90"
            >
              位置情報を許可する
            </button>
          </>
        )}

        {status === 'requesting' && (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4" />
            <p className="text-white/80">位置情報を取得中...</p>
          </div>
        )}

        {status === 'denied' && (
          <>
            <div className="bg-red-500/20 border border-red-300/50 rounded-xl p-4 mb-6">
              <p className="text-white">{error}</p>
            </div>
            <p className="text-white/80 text-sm mb-6">
              ブラウザの設定から位置情報の許可を有効にしてください
            </p>
            <button
              onClick={onRequestPermission}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              再試行
            </button>
          </>
        )}

        {(status === 'unavailable' || status === 'error') && (
          <>
            <div className="bg-yellow-500/20 border border-yellow-300/50 rounded-xl p-4 mb-6">
              <p className="text-white">{error}</p>
            </div>
            <button
              onClick={onRequestPermission}
              className="w-full bg-white text-forest-dark font-semibold py-4 px-6 rounded-xl transition-colors hover:bg-white/90"
            >
              再試行
            </button>
          </>
        )}
      </div>
    </div>
  )
}
