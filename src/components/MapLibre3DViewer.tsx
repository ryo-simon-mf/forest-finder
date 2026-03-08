'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import iconImg from '@/img/icon.svg'

interface ForestMarker {
  lat: number
  lon: number
  isNearest?: boolean
}

interface MapLibre3DViewerProps {
  latitude: number
  longitude: number
  forestMarkers?: ForestMarker[]
  route?: [number, number][]
  onForestClick?: (index: number) => void
}

// 無料のベクタータイル（3D建物データ含む）- positron は CARTO light に近いトーン
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

export default function MapLibre3DViewer({
  latitude,
  longitude,
  forestMarkers = [],
  route,
  onForestClick,
}: MapLibre3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // 地図初期化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // 最寄り森林を探す
    const nearest = forestMarkers.find((fm) => fm.isNearest)

    // 現在地→森林の方角を計算（森林が画面上にくるようにbearingを設定）
    let initBearing = 0
    if (nearest) {
      const dLon = (nearest.lon - longitude) * Math.PI / 180
      const lat1 = latitude * Math.PI / 180
      const lat2 = nearest.lat * Math.PI / 180
      const y = Math.sin(dLon) * Math.cos(lat2)
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
      initBearing = Math.atan2(y, x) * 180 / Math.PI
    }

    const bounds = nearest
      ? new maplibregl.LngLatBounds(
          [Math.min(longitude, nearest.lon), Math.min(latitude, nearest.lat)],
          [Math.max(longitude, nearest.lon), Math.max(latitude, nearest.lat)]
        )
      : null

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom: 15,
      pitch: 55,
      bearing: initBearing,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // 現在地(下)と最寄り森林(上)が画面に収まるようにフィット
      if (bounds) {
        // pitch 0 でfitBoundsのズームを正確に計算させてから、pitchを付ける
        map.fitBounds(bounds, {
          padding: { top: 100, bottom: 220, left: 60, right: 60 },
          pitch: 0,
          bearing: initBearing,
          maxZoom: 19,
          duration: 0,
        })
        // 計算されたズームを少し引いてpitch分の余裕を確保
        const calculatedZoom = map.getZoom() - 0.5
        map.easeTo({
          zoom: calculatedZoom,
          pitch: 55,
          bearing: initBearing,
          duration: 1000,
        })
      }

      const layers = map.getStyle().layers
      let labelLayerId: string | undefined

      if (layers) {
        for (const layer of layers) {
          // POIアイコン（店舗・駅・施設など）を非表示にする
          if (layer.type === 'symbol') {
            const sourceLayer = (layer as Record<string, unknown>)['source-layer'] as string | undefined
            if (sourceLayer === 'poi' || layer.id.includes('poi')) {
              map.setLayoutProperty(layer.id, 'visibility', 'none')
              continue
            }
            // 最初のテキストラベルレイヤーを記録（建物挿入位置）
            if (!labelLayerId && (layer.layout as Record<string, unknown>)?.['text-field']) {
              labelLayerId = layer.id
            }
          }
        }
      }

      // 3D建物レイヤー追加
      const sources = map.getStyle().sources
      const buildingSource = Object.keys(sources).find(
        (s) => s === 'openmaptiles' || s === 'openfreemap'
      )

      if (buildingSource) {
        map.addLayer(
          {
            id: '3d-buildings',
            source: buildingSource,
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#dcdcdc',
              'fill-extrusion-height': ['get', 'render_height'],
              'fill-extrusion-base': ['get', 'render_min_height'],
              'fill-extrusion-opacity': 0.6,
            },
          },
          labelLayerId
        )
      }

      setMapLoaded(true)
    })


    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 現在地マーカー（2D版と同じ青い丸）
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLngLat([longitude, latitude])
      return
    }

    const el = document.createElement('div')
    el.style.cssText = `
      width: 20px; height: 20px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0,0,0,0.3);
    `

    locationMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([longitude, latitude])
      .addTo(map)
  }, [latitude, longitude, mapLoaded])

  // 森林マーカー
  const handleForestClick = useCallback(
    (index: number) => {
      onForestClick?.(index)
    },
    [onForestClick]
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    // 既存マーカーを削除
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    forestMarkers.forEach((fm, idx) => {
      const size = fm.isNearest ? 32 : 24
      const color = fm.isNearest ? 'rgba(27, 172, 83, 1)' : '#8fd4a4'
      const el = document.createElement('div')
      el.style.cssText = `
        width: ${size}px; height: ${size}px;
        background-color: ${color};
        -webkit-mask-image: url(${iconImg.src});
        mask-image: url(${iconImg.src});
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        ${fm.isNearest ? 'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));' : ''}
        cursor: pointer;
      `
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        handleForestClick(idx)
      })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fm.lon, fm.lat])
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [forestMarkers, handleForestClick, mapLoaded])

  // ルート表示
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const addRoute = () => {
      // 既存ルートを削除
      if (map.getLayer('route-line')) map.removeLayer('route-line')
      if (map.getLayer('route-outline')) map.removeLayer('route-outline')
      if (map.getSource('route')) map.removeSource('route')

      if (!route || route.length < 2) return

      const coordinates = route.map(([lat, lng]) => [lng, lat])

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      })

      // メインライン（2D版と同じダッシュスタイル、太さ2倍）
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'miter',
          'line-cap': 'square',
        },
        paint: {
          'line-color': 'rgba(27, 172, 83, 1)',
          'line-width': 8,
          'line-opacity': 0.8,
          'line-dasharray': [1, 1.5],
        },
      })
    }

    addRoute()
  }, [route, mapLoaded])

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      {/* MapLibreコントロールのテーマカラー上書き */}
      <style>{`
        .maplibregl-ctrl-group button {
          background-color: rgba(27, 172, 83, 0.9) !important;
          border: none !important;
        }
        .maplibregl-ctrl-group button + button {
          border-top: 1px solid rgba(255,255,255,0.3) !important;
        }
        .maplibregl-ctrl-group button span {
          filter: brightness(0) invert(1) !important;
        }
        .maplibregl-ctrl-group {
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
        }
      `}</style>
    </div>
  )
}
