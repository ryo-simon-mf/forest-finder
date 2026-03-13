'use client'

import { useState, useEffect } from 'react'
import logoImg from '@/img/logo.png'

const TIPS = [
  '森林浴は\nストレスホルモンを\n13%減らします',
  '週2回20分以上の滞在が\nおすすめです',
  '東京にある\n駅の数は783 / 森の数は6600',
  '森に行ったら\n深呼吸も忘れずに',
  'カナダでは医師が\n森の滞在を処方します',
]

const SWITCH_INTERVAL = 1700

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function LoadingScreen() {
  const [shuffled, setShuffled] = useState(TIPS)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    setShuffled(shuffle(TIPS))
  }, [])

  useEffect(() => {
    const t1 = setTimeout(() => setTipIndex(1), SWITCH_INTERVAL)
    const t2 = setTimeout(() => setTipIndex(2), SWITCH_INTERVAL * 2)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <main className="relative h-[100dvh] flex flex-col items-center bg-forest text-white px-6">
      {/* ロゴ（固定位置 — LocationPermissionと同じ） */}
      <div className="absolute top-[35%] left-0 right-0 flex flex-col items-center pointer-events-none">
        <img src={logoImg.src} alt="最寄りの森" className="h-48 w-auto" />
      </div>

      {/* ローディングバー + Tips（ロゴ下に配置） */}
      <div style={{ height: 'calc(35% + 12rem + 3rem)' }} />
      <div className="flex flex-col items-center">
        <div className="w-40 h-1.5 bg-white/30 overflow-hidden mb-6">
          <div className="h-full bg-white animate-loading-progress" />
        </div>

        <div className="h-[4.5rem]">
          <p className="text-white/90 text-base text-center leading-relaxed whitespace-pre-line">
            {shuffled[tipIndex]}
          </p>
        </div>
      </div>
    </main>
  )
}
