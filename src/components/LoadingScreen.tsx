'use client'

import { useState, useEffect } from 'react'
import iconImg from '@/img/icon.png'

const TIPS = [
  '森林浴はストレスホルモンを\n13％減らします',
  '週2回、20分以上の滞在が\n勧められています。',
  '国立公園は全国に35ヵ所。\n東京に森林は6000以上。',
]

const TIP_INTERVAL = 3000

export function LoadingScreen() {
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length)
    }, TIP_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="h-screen flex flex-col items-center justify-center bg-forest text-white px-6">
      <div className="flex flex-col items-center">
        <img src={iconImg.src} alt="" className="h-36 w-auto mb-10" />

        {/* プログレスバー */}
        <div className="w-40 h-1.5 bg-white/30 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-white rounded-full animate-loading-bar" />
        </div>

        {/* 豆知識テキスト */}
        <p className="text-white/90 text-base text-center leading-relaxed whitespace-pre-line">
          {TIPS[tipIndex]}
        </p>
      </div>
    </main>
  )
}
