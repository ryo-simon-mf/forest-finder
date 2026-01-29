'use client'

import type { GeolocationStatus } from '@/types/geolocation'

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <svg
            className="w-24 h-24 mx-auto text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-4">Forest Finder</h1>

        {status === 'idle' && (
          <>
            <p className="text-gray-400 mb-8">
              近くの森林を見つけるために、位置情報の許可が必要です
            </p>
            <button
              onClick={onRequestPermission}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              位置情報を許可する
            </button>
          </>
        )}

        {status === 'requesting' && (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mb-4" />
            <p className="text-gray-400">位置情報を取得中...</p>
          </div>
        )}

        {status === 'denied' && (
          <>
            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              ブラウザの設定から位置情報の許可を有効にしてください
            </p>
            <button
              onClick={onRequestPermission}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              再試行
            </button>
          </>
        )}

        {(status === 'unavailable' || status === 'error') && (
          <>
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4 mb-6">
              <p className="text-yellow-400">{error}</p>
            </div>
            <button
              onClick={onRequestPermission}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              再試行
            </button>
          </>
        )}
      </div>
    </div>
  )
}
