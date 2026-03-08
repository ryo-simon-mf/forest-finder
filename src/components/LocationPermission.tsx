'use client'

import type { GeolocationStatus } from '@/types/geolocation'
import iconImg from '@/img/icon.svg'

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
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-forest text-white p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <img src={iconImg.src} alt="" className="h-32 w-auto mx-auto" />
        </div>

        <h1 className="text-3xl font-bold mb-6">最寄りの森</h1>

        {/* <p className="text-white/90 text-base leading-relaxed mb-10">
          森はストレスの特効薬です。
          <br />
          お疲れのあなた、お近くの森林へ。
        </p> */}

        {status === 'idle' && (
          <>
            <button
              onClick={onRequestPermission}
              className="bg-white text-forest-dark font-semibold py-3 px-10 rounded-lg transition-colors hover:bg-white/90 text-lg"
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
