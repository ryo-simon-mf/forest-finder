'use client'

import type { GeolocationStatus } from '@/types/geolocation'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

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
    <div className="flex flex-col items-center h-[100dvh] bg-[rgb(69,179,101)] text-white px-6 overflow-hidden">
      {/* 固定スペーサー: 動画位置をLoadingScreenと完全一致させる */}
      <div className="flex-none" style={{ height: 'calc(50dvh - 12rem)' }} />

      <video
        src={`${basePath}/logo.mp4`}
        autoPlay
        loop
        muted
        playsInline
        className="h-72 w-auto flex-none"
      />

      <div className="flex-none mt-4 mb-8 text-center">
        <p className="text-white/80 text-base">
          お疲れのあなた、お近くの森林へ。
        </p>
      </div>

      <div className="flex-none text-center">
        {status === 'idle' && (
          <>
            <button
              onClick={onRequestPermission}
              className="bg-white text-forest-dark font-semibold py-3 px-10 rounded-lg transition-colors hover:bg-white/90 text-lg"
            >
              検索する
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
              className="bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-10 rounded-lg transition-colors text-lg"
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
              className="bg-white text-forest-dark font-semibold py-3 px-10 rounded-lg transition-colors hover:bg-white/90 text-lg"
            >
              再試行
            </button>
          </>
        )}
      </div>
    </div>
  )
}
