'use client'

import { useState, useEffect } from 'react'
import iconImg from '@/img/icon.png'

const TIPS = [
  '森林浴はストレスホルモンを\n13％減らします',
  '週2回、20分以上の滞在が\n勧められています。',
  '国立公園は全国に35ヵ所。\n東京に森林は6000以上。',
]

const TIP_INTERVAL = 3000

function randomIndex(exclude: number) {
  let next: number
  do {
    next = Math.floor(Math.random() * TIPS.length)
  } while (next === exclude && TIPS.length > 1)
  return next
}

export function LoadingScreen() {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length))

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => randomIndex(prev))
    }, TIP_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="h-screen flex flex-col items-center justify-center bg-forest text-white px-6">
      <div className="flex flex-col items-center">
        <img src={iconImg.src} alt="" className="h-36 w-auto mb-10" />

        {/* プログレスバー */}
        <div className="w-40 h-1.5 bg-white/30 overflow-hidden mb-6">
          <div className="h-full bg-white animate-loading-progress" />
        </div>

        {/* 豆知識テキスト */}
        <p className="text-white/90 text-base text-center leading-relaxed whitespace-pre-line">
          {TIPS[tipIndex]}
        </p>
      </div>
    </main>
  )
}
