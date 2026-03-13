'use client'

import type { GeolocationStatus } from '@/types/geolocation'
import logoImg from '@/img/logo.png'

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
    <div className="relative flex flex-col items-center h-[100dvh] bg-forest text-white p-6">
      {/* ロゴ（固定位置） */}
      <div className="absolute top-[35%] left-0 right-0 flex flex-col items-center pointer-events-none">
        <img src={logoImg.src} alt="最寄りの森" className="h-48 w-auto" />
        <p className="text-white/80 text-base mt-4">
          お疲れのあなた、お近くの森林へ。
        </p>
      </div>

      {/* ボタン + 注釈（ロゴ下に配置） */}
      <div style={{ height: 'calc(35% + 12rem + 3rem)' }} />
      <div className="flex flex-col items-center max-w-md w-full text-center">
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
