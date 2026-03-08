'use client'

import { useState, useEffect } from 'react'

const TIPS = [
  '桜が見ごろです',
  '新芽が顔をだしています',
  '季節の変わり目を肌で',
]

const SHOW_DURATION = 5000
const HIDE_DURATION = 15000

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function ForestTipBubble() {
  const [shuffled] = useState(() => shuffle(TIPS))
  const [tipIndex, setTipIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let timeout: NodeJS.Timeout

    const cycle = () => {
      if (visible) {
        // 表示中 → SHOW_DURATION後に非表示
        timeout = setTimeout(() => {
          setVisible(false)
        }, SHOW_DURATION)
      } else {
        // 非表示中 → HIDE_DURATION後に次のTIPで表示
        timeout = setTimeout(() => {
          setTipIndex((prev) => (prev + 1) % shuffled.length)
          setVisible(true)
        }, HIDE_DURATION)
      }
    }

    cycle()
    return () => clearTimeout(timeout)
  }, [visible, shuffled.length])

  return (
    <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-none">
      <div
        className="bg-[#faf6f0] border-2 border-forest/80 rounded-xl px-4 py-3 shadow-lg relative transition-all duration-500 ease-in-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-12px)',
        }}
      >
        <p className="text-gray-700 text-sm leading-relaxed text-center">
          {shuffled[tipIndex]}
        </p>
        {/* 吹き出しの三角（右上向き） */}
        <div className="absolute -top-[10px] right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-forest/80" />
        <div className="absolute -top-[7px] right-[25.5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[8px] border-b-[#faf6f0]" />
      </div>
    </div>
  )
}
