'use client'

import { useState, useEffect } from 'react'

const TIPS = [
  '桜が見ごろです',
  'シジュウカラの鳴き声は「ツツピー」',
  '日差しが強いとこはこもれび日和',
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
    <div className="absolute top-3 right-4 z-[1000] pointer-events-none flex justify-end">
      <div
        className="relative bg-[rgb(200,237,215)] border-2 border-[#1bac53] rounded-xl px-5 py-2.5 transition-all duration-500 ease-in-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(20px)',
        }}
      >
        <p className="text-[#1bac53] text-sm font-bold leading-relaxed text-center whitespace-nowrap">
          {shuffled[tipIndex]}
        </p>
        {/* 右向き三角（吹き出し尻尾） */}
        <div className="absolute top-1/2 -right-[10px] -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[10px] border-l-[#1bac53]" />
        <div className="absolute top-1/2 -right-[7px] -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[8px] border-l-[rgb(200,237,215)]" />
      </div>
    </div>
  )
}
