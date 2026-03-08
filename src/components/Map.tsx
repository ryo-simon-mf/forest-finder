'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, AttributionControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Position } from '@/types/geolocation'
import type { ForestArea } from '@/types/forest'
import type { POIType } from '@/types/poi'
// import type { DisplayMode } from '@/lib/distance'
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
        <path
          d="M 40 40 L 40 5 A 35 35 0 0 1 70.3 22 Z"
          fill="rgba(59, 130, 246, 0.5)"
          stroke="rgba(59, 130, 246, 0.8)"
          stroke-width="1"
        />
        <line
          x1="40"
          y1="40"
          x2="40"
          y2="8"
          stroke="rgba(59, 130, 246, 0.9)"
          stroke-width="2"
        />
      </svg>
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

// 森林用のカスタムアイコン（薄い緑）
const ForestIcon = L.divIcon({
  className: 'forest-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background-color: #8fd4a4;
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

// コンビニ用アイコン
const KonbiniIcon = L.divIcon({
  className: 'konbini-marker',
  html: `<div style="font-size:18px;text-align:center;line-height:24px;width:24px;height:24px;opacity:0.5;">&#x1F3EA;</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const NearestKonbiniIcon = L.divIcon({
  className: 'nearest-konbini-marker',
  html: `<div style="font-size:28px;text-align:center;line-height:32px;width:32px;height:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">&#x1F3EA;</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

// 駅用アイコン
const StationIcon = L.divIcon({
  className: 'station-marker',
  html: `<div style="font-size:18px;text-align:center;line-height:24px;width:24px;height:24px;opacity:0.5;">&#x1F689;</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const NearestStationIcon = L.divIcon({
  className: 'nearest-station-marker',
  html: `<div style="font-size:28px;text-align:center;line-height:32px;width:32px;height:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">&#x1F689;</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

function getPOIIcons(poiType: POIType): { normal: L.DivIcon; nearest: L.DivIcon } {
  switch (poiType) {
    case 'konbini': return { normal: KonbiniIcon, nearest: NearestKonbiniIcon }
    case 'station': return { normal: StationIcon, nearest: NearestStationIcon }
    default: return { normal: ForestIcon, nearest: NearestForestIcon }
  }
}

const POI_ROUTE_COLORS: Record<POIType, string> = {
  forest: 'rgba(27, 172, 83, 1)',
  konbini: 'rgba(59, 130, 246, 1)',
  station: 'rgba(239, 68, 68, 1)',
}

L.Marker.prototype.options.icon = DefaultIcon

interface MapProps {
  position: Position
  forests?: ForestArea[]
  heading?: number | null
  displayMode?: string
  onBoundsChange?: (radiusMeters: number) => void
  route?: [number, number][]
  onForestSelect?: (forest: ForestArea) => void
  poiType?: POIType
}

function MapUpdater({ position, route }: { position: Position; route?: [number, number][] }) {
  const map = useMap()
  const fittedRouteRef = useRef<string | null>(null)
  const initialRef = useRef(true)

  useEffect(() => {
    // 初回のみ: ルートがあればfitBounds、なければ現在地にセット
    if (initialRef.current) {
      initialRef.current = false
      if (route && route.length > 0) {
        const key = `${route[0][0]},${route[0][1]}-${route[route.length - 1][0]},${route[route.length - 1][1]}`
        const bounds = L.latLngBounds(route)
        const mapSize = map.getSize()
        const bottomPad = Math.round(mapSize.y * 0.25)
        const sidePad = Math.round(mapSize.x * 0.08)
        const topPad = Math.round(mapSize.y * 0.08)
        map.fitBounds(bounds, { paddingTopLeft: [sidePad, topPad], paddingBottomRight: [sidePad, bottomPad], maxZoom: 16 })
        fittedRouteRef.current = key
      }
      return
    }

    // 新しいルートが来た時だけfitBounds（GPS移動では何もしない）
    if (route && route.length > 0) {
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
    }
  }, [map, position.latitude, position.longitude, route])

  return null
}

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()
  mapRef.current = map
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

    // ズームレベル変更時のみ発火
    const handler = () => onBoundsChange(calcRadius())
    map.on('zoomend', handler)

    return () => {
      map.off('zoomend', handler)
    }
  }, [map, onBoundsChange])

  return null
}

const ANIM_DURATION = 1500

function AnimatedPolyline({ route, poiType = 'forest' }: { route: [number, number][]; poiType?: POIType }) {
  const [visiblePoints, setVisiblePoints] = useState<[number, number][]>([])
  const routeRef = useRef<[number, number][]>(route)

  // routeの参照を常に最新に保つ
  routeRef.current = route

  // routeの始点・終点からキーを生成し、安定した依存値にする
  const routeKey = `${route[0][0]},${route[0][1]}-${route[route.length - 1][0]},${route[route.length - 1][1]}`

  useEffect(() => {
    const currentRoute = routeRef.current
    const totalPoints = currentRoute.length
    const startTime = performance.now()

    let rafId: number
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / ANIM_DURATION, 1)
      // ease-out曲線
      const eased = 1 - Math.pow(1 - progress, 3)
      const count = Math.max(2, Math.ceil(totalPoints * eased))
      setVisiblePoints(currentRoute.slice(0, count))

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }
    rafId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(rafId)
  }, [routeKey])

  if (visiblePoints.length < 2) return null

  return (
    <Polyline
      positions={visiblePoints}
      pathOptions={{
        color: POI_ROUTE_COLORS[poiType],
        weight: 6,
        opacity: 0.8,
        dashArray: '8, 12',
        dashOffset: '0',
        lineJoin: 'miter',
        lineCap: 'square',
      }}
    />
  )
}

export function Map({ position, forests = [], heading, onBoundsChange, route, onForestSelect, poiType = 'forest' }: MapProps) {
  const [mapStyle] = useState<MapStyleKey>('light')
  const mapRef = useRef<L.Map | null>(null)
  const nearestForestId = forests.length > 0 ? forests[0].id : null
  const style = MAP_STYLES[mapStyle]
  const poiIcons = getPOIIcons(poiType)

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

        {/* 徒歩ルート（アニメーション） */}
        {route && route.length > 0 && (
          <AnimatedPolyline route={route} poiType={poiType} />
        )}

        {/* 森林マーカー */}
        {forests.map((forest) => (
          <Marker
            key={forest.id}
            position={[forest.center.latitude, forest.center.longitude]}
            icon={forest.id === nearestForestId ? poiIcons.nearest : poiIcons.normal}
            eventHandlers={onForestSelect ? { click: () => onForestSelect(forest) } : undefined}
          />
        ))}

        {/* 現在地マーカー */}
        <Marker
          position={[position.latitude, position.longitude]}
          icon={locationIcon}
        >
          {/* <Popup>
            <div className="text-center">
              <p className="font-bold">現在地</p>
              <p className="text-sm text-gray-600">
                精度: ±{Math.round(position.accuracy)}m
              </p>
            </div>
          </Popup> */}
        </Marker>

        <MapUpdater position={position} route={route} />
        <MapRefCapture mapRef={mapRef} />
        {onBoundsChange && <BoundsWatcher onBoundsChange={onBoundsChange} />}
      </MapContainer>

      {/* 現在地に戻るボタン — fixed配置で下部カードより上に表示 */}
      <button
        onClick={() => mapRef.current?.setView([position.latitude, position.longitude], 15, { animate: true })}
        className="fixed z-[1001] right-4 bottom-[calc(12rem+env(safe-area-inset-bottom))] bg-[#1bac53] rounded-full w-11 h-11 shadow-lg flex items-center justify-center hover:bg-[#159a48] active:bg-[#128a3f] transition-colors"
        aria-label="現在地に戻る"
        title="現在地に戻る"
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{transform: 'rotate(60deg)'}}>
          <path d="M12 2 L16 14 L12 11 L8 14 Z" fill="white" />
          <path d="M12 22 L8 10 L12 13 L16 10 Z" fill="rgba(255,255,255,0.4)" />
        </svg>
      </button>
    </div>
  )
}
