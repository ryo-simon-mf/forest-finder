'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Position } from '@/types/geolocation'

// デフォルトマーカーアイコンの修正（Leafletのバグ対策）
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

L.Marker.prototype.options.icon = DefaultIcon

interface MapProps {
  position: Position
}

// 地図を現在地に移動させるコンポーネント
function MapUpdater({ position }: { position: Position }) {
  const map = useMap()

  useEffect(() => {
    map.setView([position.latitude, position.longitude], map.getZoom())
  }, [map, position.latitude, position.longitude])

  return null
}

export function Map({ position }: MapProps) {
  return (
    <MapContainer
      center={[position.latitude, position.longitude]}
      zoom={15}
      className="h-full w-full"
      zoomControl={false}
    >
      {/* 国土地理院タイル（標準地図） */}
      <TileLayer
        attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
        url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
        maxZoom={18}
      />

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
  )
}
