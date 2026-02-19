'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'
import { formatByMode, type DisplayMode } from '@/lib/distance'

// 地図スタイル定義（認証不要のタイルのみ使用）
const MAP_STYLES = {
  standard: {
    name: '標準',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/">国土地理院</a>',
  },
  pale: {
    name: '淡色',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/">国土地理院</a>',
  },
  osm: {
    name: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    name: 'ダーク',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
} as const

type MapStyleKey = keyof typeof MAP_STYLES

// デフォルトマーカーアイコンの修正
const DefaultIcon = L.icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// 現在地用のカスタムアイコン（方向なし）
const CurrentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background-color: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// 現在地用のカスタムアイコン（方向付き）
const createDirectionalIcon = (heading: number) => L.divIcon({
  className: 'current-location-marker-directional',
  html: `
    <div style="
      position: relative;
      width: 80px;
      height: 80px;
    ">
      <!-- 視野範囲の扇形（SVG） -->
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        style="
          position: absolute;
          top: 0;
          left: 0;
          transform: rotate(${heading}deg);
          transform-origin: center center;
        "
      >
        <!-- 扇形（60度の視野角） -->
        <path
          d="M 40 40 L 40 5 A 35 35 0 0 1 70.3 22 Z"
          fill="rgba(59, 130, 246, 0.5)"
          stroke="rgba(59, 130, 246, 0.8)"
          stroke-width="1"
        />
        <!-- 中心方向の矢印ライン -->
        <line
          x1="40"
          y1="40"
          x2="40"
          y2="8"
          stroke="rgba(59, 130, 246, 0.9)"
          stroke-width="2"
        />
      </svg>
      <!-- 中心の円 -->
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18px;
        height: 18px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      "></div>
    </div>
  `,
  iconSize: [80, 80],
  iconAnchor: [40, 40],
})

// 森林用のカスタムアイコン
const ForestIcon = L.divIcon({
  className: 'forest-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background-color: #22c55e;
      border: 2px solid white;
      border-radius: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">🌲</div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// 最寄り森林用のカスタムアイコン
const NearestForestIcon = L.divIcon({
  className: 'nearest-forest-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background-color: #16a34a;
      border: 3px solid #fbbf24;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    ">🌲</div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

L.Marker.prototype.options.icon = DefaultIcon

interface MapProps {
  position: Position
  forests?: ForestArea[]
  heading?: number | null
  displayMode?: DisplayMode
  onBoundsChange?: (radiusMeters: number) => void
}

function MapUpdater({ position }: { position: Position }) {
  const map = useMap()

  useEffect(() => {
    map.setView([position.latitude, position.longitude], map.getZoom())
  }, [map, position.latitude, position.longitude])

  return null
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: (radiusMeters: number) => void }) {
  const map = useMap()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = () => {
      // デバウンス: ズーム/パン完了後500msで発火（アニメーション中の連続発火を防止）
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const bounds = map.getBounds()
        const center = bounds.getCenter()
        const ne = bounds.getNorthEast()
        const radius = center.distanceTo(ne)
        onBoundsChange(radius)
      }, 500)
    }

    // 初回は即時発火
    const bounds = map.getBounds()
    const center = bounds.getCenter()
    const ne = bounds.getNorthEast()
    onBoundsChange(center.distanceTo(ne))

    map.on('zoomend', handler)
    map.on('moveend', handler)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      map.off('zoomend', handler)
      map.off('moveend', handler)
    }
  }, [map, onBoundsChange])

  return null
}

/** ズーム開始時にポップアップを閉じる（マーカー入れ替え時の不自然な消失を防止） */
function ZoomPopupCloser() {
  const map = useMap()

  useEffect(() => {
    const handler = () => map.closePopup()
    map.on('zoomstart', handler)
    return () => { map.off('zoomstart', handler) }
  }, [map])

  return null
}

// スタイル切り替えボタン
function StyleSwitcher({
  currentStyle,
  onStyleChange,
}: {
  currentStyle: MapStyleKey
  onStyleChange: (style: MapStyleKey) => void
}) {
  return (
    <div className="absolute top-3 right-3 z-[1000]">
      <div className="bg-gray-800/90 backdrop-blur rounded-lg p-1 flex gap-1">
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
          <button
            key={key}
            onClick={() => onStyleChange(key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              currentStyle === key
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {MAP_STYLES[key].name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Map({ position, forests = [], heading, displayMode = 'distance', onBoundsChange }: MapProps) {
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('standard')
  const nearestForestId = forests.length > 0 ? forests[0].id : null
  const style = MAP_STYLES[mapStyle]

  // 方向が取得できている場合は方向付きアイコンを使用
  const locationIcon = heading !== null && heading !== undefined
    ? createDirectionalIcon(heading)
    : CurrentLocationIcon

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[position.latitude, position.longitude]}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          key={mapStyle}
          attribution={style.attribution}
          url={style.url}
          maxZoom={18}
        />

        {/* 森林マーカー */}
        {forests.map((forest) => (
          <Marker
            key={forest.id}
            position={[forest.center.latitude, forest.center.longitude]}
            icon={forest.id === nearestForestId ? NearestForestIcon : ForestIcon}
          >
            <Popup>
              <div className="text-center min-w-[140px]">
                <p className="font-bold text-green-700">
                  {forest.name || '森林'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  📍 {forest.address || '住所を取得中...'}
                </p>
                {forest.distance !== undefined && (
                  <p className="text-sm text-gray-600 mt-1">
                    {formatByMode(forest.distance, displayMode)}
                  </p>
                )}
                {forest.id === nearestForestId && (
                  <p className="text-xs text-yellow-600 font-medium mt-1">
                    ⭐ 最寄り
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 現在地マーカー */}
        <Marker
          position={[position.latitude, position.longitude]}
          icon={locationIcon}
        >
          <Popup>
            <div className="text-center">
              <p className="font-bold">現在地</p>
              <p className="text-sm text-gray-600">
                精度: ±{Math.round(position.accuracy)}m
              </p>
            </div>
          </Popup>
        </Marker>

        <MapUpdater position={position} />
        <ZoomPopupCloser />
        {onBoundsChange && <BoundsWatcher onBoundsChange={onBoundsChange} />}
      </MapContainer>

      <StyleSwitcher currentStyle={mapStyle} onStyleChange={setMapStyle} />
    </div>
  )
}
