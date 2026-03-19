'use client'

import { useState, useEffect } from 'react'
import titleTypoImg from '@/img/title_typo.svg'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const TIPS = [
  '週2回20分以上の滞在が\nおすすめです',
  '東京にある\n駅の数は783 / 森の数は6600',
  'カナダでは医師が\n森の滞在を処方します',
]

export function LoadingScreen() {
  const [tip, setTip] = useState(TIPS[0])

  useEffect(() => {
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)])
  }, [])

  return (
    <main className="h-[100dvh] flex flex-col items-center bg-[rgb(0,160,85)] text-white px-6 overflow-hidden">
      {/* 固定スペーサー: 動画位置をLocationPermissionと完全一致させる */}
      <div className="flex-none" style={{ height: 'calc(50dvh - 12rem)' }} />

      <div className="relative h-72 flex-none">
        {/* <video
          src={`${basePath}/logo.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="h-72 w-auto opacity-20"
        /> */}
        <img
          src={`${basePath}/logo.gif`}
          alt=""
          className="h-72 w-auto scale-[1.2]"
        />
        <img
          src={titleTypoImg.src}
          alt=""
          className="absolute left-1/2 -translate-x-1/2 bottom-10 w-48 scale-[0.95]"
        />
      </div>

      <div className="mt-8 w-40 h-1.5 bg-white/30 overflow-hidden mb-6 flex-none">
        <div className="h-full bg-white animate-loading-progress" />
      </div>

      <div className="h-[4.5rem] flex-none">
        <p className="text-white/90 text-base text-center leading-relaxed whitespace-pre-line">
          {tip}
        </p>
      </div>
    </main>
  )
}
