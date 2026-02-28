'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, AttributionControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'
import { formatByMode, type DisplayMode } from '@/lib/distance'
import iconImg from '@/img/icon.png'

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
  light: {
    name: 'ライト',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
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

// 森林用のカスタムアイコン（白みがかった緑）
const ForestIcon = L.divIcon({
  className: 'forest-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background-color: rgba(27, 172, 83, 0.4);
      -webkit-mask-image: url(${iconImg.src});
      mask-image: url(${iconImg.src});
      -webkit-mask-size: contain;
      mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-position: center;
      mask-position: center;
    "></div>
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
      background-color: rgba(27, 172, 83, 1);
      -webkit-mask-image: url(${iconImg.src});
      mask-image: url(${iconImg.src});
      -webkit-mask-size: contain;
      mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-position: center;
      mask-position: center;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    "></div>
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
  route?: [number, number][]
  onForestSelect?: (forest: ForestArea) => void
}

function MapUpdater({ position, route }: { position: Position; route?: [number, number][] }) {
  const map = useMap()
  const fittedRouteRef = useRef<string | null>(null)

  useEffect(() => {
    if (route && route.length > 0) {
      // ルートの識別キー（始点+終点）
      const key = `${route[0][0]},${route[0][1]}-${route[route.length - 1][0]},${route[route.length - 1][1]}`
      if (fittedRouteRef.current !== key) {
        const bounds = L.latLngBounds(route)
        const mapSize = map.getSize()
        const bottomPad = Math.round(mapSize.y * 0.25)
        const sidePad = Math.round(mapSize.x * 0.08)
        const topPad = Math.round(mapSize.y * 0.08)
        map.fitBounds(bounds, { paddingTopLeft: [sidePad, topPad], paddingBottomRight: [sidePad, bottomPad], maxZoom: 16 })
        fittedRouteRef.current = key
      }
    } else {
      map.setView([position.latitude, position.longitude], map.getZoom())
    }
  }, [map, position.latitude, position.longitude, route])

  return null
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: (radiusMeters: number) => void }) {
  const map = useMap()

  useEffect(() => {
    const calcRadius = () => {
      const bounds = map.getBounds()
      const center = bounds.getCenter()
      const ne = bounds.getNorthEast()
      return center.distanceTo(ne)
    }

    // 初回のみ即時発火
    onBoundsChange(calcRadius())

    // ズームレベル変更時のみ発火（パン・GPS移動では発火しない）
    const handler = () => onBoundsChange(calcRadius())
    map.on('zoomend', handler)

    return () => {
      map.off('zoomend', handler)
    }
  }, [map, onBoundsChange])

  return null
}

export function Map({ position, forests = [], heading, displayMode = 'distance', onBoundsChange, route, onForestSelect }: MapProps) {
  const [mapStyle] = useState<MapStyleKey>('light')
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
        attributionControl={false}
      >
        <AttributionControl position="bottomright" prefix='<a href="https://leafletjs.com">Leaflet</a>' />
        <TileLayer
          key={mapStyle}
          attribution={style.attribution}
          url={style.url}
          maxZoom={18}
        />

        {/* 徒歩ルート */}
        {route && route.length > 0 && (
          <Polyline
            positions={route}
            pathOptions={{
              color: 'rgba(27, 172, 83, 1)',
              weight: 6,
              opacity: 0.8,
              dashArray: '8, 12',
              dashOffset: '0',
              lineJoin: 'miter',
              lineCap: 'square',
            }}
          />
        )}

        {/* 森林マーカー */}
        {forests.map((forest) => (
          <Marker
            key={forest.id}
            position={[forest.center.latitude, forest.center.longitude]}
            icon={forest.id === nearestForestId ? NearestForestIcon : ForestIcon}
            eventHandlers={onForestSelect ? { click: () => onForestSelect(forest) } : undefined}
          >
            <Popup className="forest-popup">
              <div className="text-center min-w-[120px]">
                <p className="font-bold text-white text-sm">
                  {forest.address || '住所を取得中...'}
                </p>
                {forest.distance !== undefined && (
                  <p className="text-white/90 text-xs mt-1">
                    {formatByMode(forest.distance, displayMode)} · 徒歩{Math.ceil(forest.distance / 80)}分
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

        <MapUpdater position={position} route={route} />
        {onBoundsChange && <BoundsWatcher onBoundsChange={onBoundsChange} />}
      </MapContainer>

      {/* <StyleSwitcher currentStyle={mapStyle} onStyleChange={setMapStyle} /> */}
    </div>
  )
}
