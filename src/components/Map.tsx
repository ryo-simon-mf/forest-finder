'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'
import { formatDistance } from '@/lib/distance'

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

// 現在地用のカスタムアイコン
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
}

function MapUpdater({ position }: { position: Position }) {
  const map = useMap()

  useEffect(() => {
    map.setView([position.latitude, position.longitude], map.getZoom())
  }, [map, position.latitude, position.longitude])

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

export function Map({ position, forests = [] }: MapProps) {
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('standard')
  const nearestForestId = forests.length > 0 ? forests[0].id : null
  const style = MAP_STYLES[mapStyle]

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
                {forest.address && (
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {forest.address}
                  </p>
                )}
                {forest.distance !== undefined && (
                  <p className="text-sm text-gray-600 mt-1">
                    距離: {formatDistance(forest.distance)}
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
          icon={CurrentLocationIcon}
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
      </MapContainer>

      <StyleSwitcher currentStyle={mapStyle} onStyleChange={setMapStyle} />
    </div>
  )
}
