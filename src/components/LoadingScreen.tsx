'use client'

import { useState, useEffect } from 'react'
import iconImg from '@/img/icon.svg'

const TIPS = [
  '森林浴は\nストレスホルモンを\n13%減らします',
  '週2回20分以上の滞在が\nおすすめです',
  '東京にある\n駅の数は783 / 森の数は6600',
  '森に行ったら\n深呼吸も忘れずに',
  'カナダでは医師が\n森の滞在を処方します',
]

const HALF_TIME = 2500

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function LoadingScreen() {
  const [shuffled] = useState(() => shuffle(TIPS))
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setTipIndex(1)
    }, HALF_TIME)
    return () => clearTimeout(timer)
  }, [])

  return (
    <main className="h-[100dvh] flex flex-col items-center justify-center bg-forest text-white px-6">
      <div className="flex flex-col items-center">
        <img src={iconImg.src} alt="" className="h-36 w-auto mb-10" />

        {/* プログレスバー */}
        <div className="w-40 h-1.5 bg-white/30 overflow-hidden mb-6">
          <div className="h-full bg-white animate-loading-progress" />
        </div>

        {/* 豆知識テキスト */}
        <p className="text-white/90 text-base text-center leading-relaxed whitespace-pre-line">
          {shuffled[tipIndex]}
        </p>
      </div>
    </main>
  )
}
