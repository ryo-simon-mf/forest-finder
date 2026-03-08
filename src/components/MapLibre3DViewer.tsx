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
  heading?: number | null
  topDown?: boolean
  animateReady?: boolean
  onForestClick?: (index: number) => void
  onBoundsChange?: (radiusMeters: number) => void
  onMapCenterChange?: (lat: number, lng: number) => void
}

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const ANIM_DURATION = 1500

// タッチデバイス判定（スマホ/タブレット分岐）
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024
}

export default function MapLibre3DViewer({
  latitude,
  longitude,
  forestMarkers = [],
  route,
  heading,
  topDown = false,
  animateReady,
  onForestClick,
  onBoundsChange,
  onMapCenterChange,
}: MapLibre3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const animTargetRef = useRef<{ center: maplibregl.LngLat; zoom: number; bearing: number; pitch: number } | null>(null)
  const animFiredRef = useRef(false)

  // 地図初期化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      maxPitch: topDown ? 0 : 85,
      dragRotate: true,
      touchPitch: !topDown,
    })

    // PC/タブレットのみNavigationControl表示
    if (!isTouchDevice()) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
    }

    map.on('load', () => {
      const layers = map.getStyle().layers
      let labelLayerId: string | undefined

      if (layers) {
        for (const layer of layers) {
          if (layer.type === 'symbol') {
            const sourceLayer = (layer as Record<string, unknown>)['source-layer'] as string | undefined
            if (sourceLayer === 'poi' || layer.id.includes('poi')) {
              map.setLayoutProperty(layer.id, 'visibility', 'none')
              continue
            }
            if (!labelLayerId && (layer.layout as Record<string, unknown>)?.['text-field']) {
              labelLayerId = layer.id
            }
          }
        }
      }

      // 3D建物レイヤー追加（topDownモードではスキップ）
      const sources = map.getStyle().sources
      const buildingSource = Object.keys(sources).find(
        (s) => s === 'openmaptiles' || s === 'openfreemap'
      )

      if (buildingSource && !topDown) {
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

    // BoundsWatcher: moveend で半径通知 + パン検索（デバウンス付き）
    let moveendTimer: ReturnType<typeof setTimeout> | null = null
    map.on('moveend', () => {
      if (moveendTimer) clearTimeout(moveendTimer)
      moveendTimer = setTimeout(() => {
        const center = map.getCenter()
        const mapBounds = map.getBounds()
        const ne = mapBounds.getNorthEast()
        const centerLatLng = new maplibregl.LngLat(center.lng, center.lat)
        const neLatLng = new maplibregl.LngLat(ne.lng, ne.lat)
        const radiusMeters = centerLatLng.distanceTo(neLatLng)
        onBoundsChange?.(radiusMeters)
        onMapCenterChange?.(center.lat, center.lng)
      }, 300)
    })

    mapRef.current = map

    return () => {
      if (moveendTimer) clearTimeout(moveendTimer)
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 初期カメラ配置 + deferred animation
  const initialCameraSetRef = useRef(false)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || initialCameraSetRef.current) return

    const nearest = forestMarkers.find((fm) => fm.isNearest)
    if (!nearest) return

    initialCameraSetRef.current = true

    let initBearing = 0
    const dLon = (nearest.lon - longitude) * Math.PI / 180
    const lat1 = latitude * Math.PI / 180
    const lat2 = nearest.lat * Math.PI / 180
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    initBearing = Math.atan2(y, x) * 180 / Math.PI

    const fitPadding = topDown
      ? { top: 200, bottom: 260, left: 60, right: 60 }
      : { top: 120, bottom: 260, left: 60, right: 60 }

    const bounds = new maplibregl.LngLatBounds(
      [Math.min(longitude, nearest.lon), Math.min(latitude, nearest.lat)],
      [Math.max(longitude, nearest.lon), Math.max(latitude, nearest.lat)]
    )

    map.fitBounds(bounds, {
      padding: fitPadding,
      pitch: 0,
      bearing: initBearing,
      maxZoom: 19,
      duration: 0,
    })
    const targetZoom = map.getZoom() - (topDown ? 0 : 0.5)
    const targetCenter = map.getCenter()
    const targetPitch = topDown ? 0 : 55

    if (animateReady !== undefined) {
      map.jumpTo({ center: [longitude, latitude], zoom: 13, pitch: 0, bearing: initBearing })
      animTargetRef.current = { center: targetCenter, zoom: targetZoom, bearing: initBearing, pitch: targetPitch }
    } else {
      map.jumpTo({ center: [longitude, latitude], zoom: 13, pitch: 0 })
      map.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: initBearing,
        duration: 2000,
        curve: 1.2,
      })
    }
  }, [mapLoaded, forestMarkers, latitude, longitude, topDown, animateReady])

  // deferred animation: animateReadyがtrueになったらflyTo発動
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !animateReady || animFiredRef.current) return
    const target = animTargetRef.current
    if (!target) return
    animFiredRef.current = true
    map.flyTo({
      center: target.center,
      zoom: target.zoom,
      pitch: target.pitch,
      bearing: target.bearing,
      duration: 2000,
      curve: 1.2,
    })
  }, [animateReady, mapLoaded])

  // 現在地マーカー（方向付き）
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLngLat([longitude, latitude])
      const el = locationMarkerRef.current.getElement()
      const arrow = el.querySelector('.direction-arrow') as HTMLElement | null
      if (arrow) {
        if (heading !== null && heading !== undefined) {
          arrow.style.display = 'block'
          arrow.style.transform = `rotate(${heading}deg)`
        } else {
          arrow.style.display = 'none'
        }
      }
      return
    }

    const el = document.createElement('div')
    el.style.cssText = `
      position: relative;
      width: 80px; height: 80px;
    `

    const arrowDiv = document.createElement('div')
    arrowDiv.className = 'direction-arrow'
    arrowDiv.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 80px; height: 80px;
      display: ${heading !== null && heading !== undefined ? 'block' : 'none'};
      transform: rotate(${heading ?? 0}deg);
      transform-origin: center center;
    `
    arrowDiv.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 80 80">
        <path
          d="M 40 40 L 40 5 A 35 35 0 0 1 70.3 22 Z"
          fill="rgba(59, 130, 246, 0.5)"
          stroke="rgba(59, 130, 246, 0.8)"
          stroke-width="1"
        />
        <line
          x1="40" y1="40" x2="40" y2="8"
          stroke="rgba(59, 130, 246, 0.9)"
          stroke-width="2"
        />
      </svg>
    `
    el.appendChild(arrowDiv)

    const dot = document.createElement('div')
    dot.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 18px; height: 18px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0,0,0,0.3);
    `
    el.appendChild(dot)

    locationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([longitude, latitude])
      .addTo(map)
  }, [latitude, longitude, mapLoaded, heading])

  // 森林マーカー（ビューポート内のみ表示 + 差分更新）
  const handleForestClick = useCallback(
    (index: number) => {
      onForestClick?.(index)
    },
    [onForestClick]
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const visibleBounds = map.getBounds()
    const padding = 0.01 // 少し余裕を持たせる
    const paddedBounds = new maplibregl.LngLatBounds(
      [visibleBounds.getWest() - padding, visibleBounds.getSouth() - padding],
      [visibleBounds.getEast() + padding, visibleBounds.getNorth() + padding]
    )

    // 新しいマーカーセットのキーを作成
    const newKeys = new Set<string>()
    const markersToAdd: { fm: ForestMarker; idx: number; key: string }[] = []

    forestMarkers.forEach((fm, idx) => {
      const key = `${fm.lat},${fm.lon}`
      // ビューポート内のマーカーのみ表示
      if (paddedBounds.contains([fm.lon, fm.lat])) {
        newKeys.add(key)
        if (!markersRef.current.has(key)) {
          markersToAdd.push({ fm, idx, key })
        }
      }
    })

    // ビューポート外 or 不要なマーカーを削除
    markersRef.current.forEach((marker, key) => {
      if (!newKeys.has(key)) {
        marker.remove()
        markersRef.current.delete(key)
      }
    })

    // 新規マーカーを追加
    markersToAdd.forEach(({ fm, idx, key }) => {
      const iconSize = fm.isNearest ? 32 : 24
      const color = fm.isNearest ? 'rgba(27, 172, 83, 1)' : '#8fd4a4'
      const tapSize = Math.max(44, iconSize)
      const el = document.createElement('div')
      el.style.cssText = `
        width: ${tapSize}px; height: ${tapSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      `
      const icon = document.createElement('div')
      icon.style.cssText = `
        width: ${iconSize}px; height: ${iconSize}px;
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
      `
      el.appendChild(icon)

      let touchMoved = false
      el.addEventListener('touchstart', () => { touchMoved = false }, { passive: true })
      el.addEventListener('touchmove', () => { touchMoved = true }, { passive: true })
      el.addEventListener('touchend', (e) => {
        if (!touchMoved) {
          e.preventDefault()
          e.stopPropagation()
          handleForestClick(idx)
        }
      })
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        handleForestClick(idx)
      })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fm.lon, fm.lat])
        .addTo(map)

      markersRef.current.set(key, marker)
    })
  }, [forestMarkers, handleForestClick, mapLoaded])

  // ズーム/パン時にマーカーの表示/非表示を更新
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    let viewportTimer: ReturnType<typeof setTimeout> | null = null

    const updateVisibleMarkers = () => {
      if (viewportTimer) clearTimeout(viewportTimer)
      viewportTimer = setTimeout(() => {
        const visibleBounds = map.getBounds()
        const padding = 0.01

        const paddedBounds = new maplibregl.LngLatBounds(
          [visibleBounds.getWest() - padding, visibleBounds.getSouth() - padding],
          [visibleBounds.getEast() + padding, visibleBounds.getNorth() + padding]
        )

        markersRef.current.forEach((marker) => {
          const lngLat = marker.getLngLat()
          const el = marker.getElement()
          if (paddedBounds.contains(lngLat)) {
            el.style.display = ''
          } else {
            el.style.display = 'none'
          }
        })
      }, 150)
    }

    map.on('moveend', updateVisibleMarkers)
    map.on('zoomend', updateVisibleMarkers)

    return () => {
      if (viewportTimer) clearTimeout(viewportTimer)
      map.off('moveend', updateVisibleMarkers)
      map.off('zoomend', updateVisibleMarkers)
    }
  }, [mapLoaded])

  // ルート表示（アニメーション付き）+ カメラ移動
  const fittedRouteRef = useRef<string | null>(null)
  const initialRouteRef = useRef(true)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (map.getLayer('route-line')) map.removeLayer('route-line')
    if (map.getSource('route')) map.removeSource('route')

    if (!route || route.length < 2) return

    const fullCoordinates = route.map(([lat, lng]) => [lng, lat])
    const routeKey = `${route[0][0]},${route[0][1]}-${route[route.length - 1][0]},${route[route.length - 1][1]}`

    if (initialRouteRef.current) {
      initialRouteRef.current = false
      fittedRouteRef.current = routeKey
    } else if (fittedRouteRef.current !== routeKey) {
      fittedRouteRef.current = routeKey

      const startLat = route[0][0] * Math.PI / 180
      const endLat = route[route.length - 1][0] * Math.PI / 180
      const dLon = (route[route.length - 1][1] - route[0][1]) * Math.PI / 180
      const y = Math.sin(dLon) * Math.cos(endLat)
      const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon)
      const bearing = Math.atan2(y, x) * 180 / Math.PI

      const routeBounds = new maplibregl.LngLatBounds(
        [Math.min(fullCoordinates[0][0], fullCoordinates[fullCoordinates.length - 1][0]),
         Math.min(fullCoordinates[0][1], fullCoordinates[fullCoordinates.length - 1][1])],
        [Math.max(fullCoordinates[0][0], fullCoordinates[fullCoordinates.length - 1][0]),
         Math.max(fullCoordinates[0][1], fullCoordinates[fullCoordinates.length - 1][1])]
      )
      const routePadding = topDown
        ? { top: 200, bottom: 260, left: 60, right: 60 }
        : { top: 120, bottom: 260, left: 60, right: 60 }

      const currentCenter = map.getCenter()
      const currentZoom = map.getZoom()
      const currentBearing = map.getBearing()
      const currentPitch = map.getPitch()

      map.fitBounds(routeBounds, {
        padding: routePadding,
        bearing,
        pitch: topDown ? 0 : 55,
        maxZoom: 19,
        duration: 0,
      })
      const targetZoom = map.getZoom()
      const targetCenter = map.getCenter()

      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: currentPitch,
      })
      map.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        bearing,
        pitch: topDown ? 0 : 55,
        duration: 1200,
        curve: 1.0,
      })
    }

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: fullCoordinates.slice(0, 2),
        },
      },
    })

    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'butt',
      },
      paint: {
        'line-color': 'rgba(27, 172, 83, 1)',
        'line-width': 4,
        'line-opacity': 0.85,
        'line-dasharray': [2, 3],
      },
    })

    const totalPoints = fullCoordinates.length
    const startTime = performance.now()
    let rafId: number

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / ANIM_DURATION, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const count = Math.max(2, Math.ceil(totalPoints * eased))

      const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: fullCoordinates.slice(0, count),
          },
        })
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [route, mapLoaded, topDown])

  // 現在地に戻る
  const handleRecenter = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({
      center: [longitude, latitude],
      zoom: 15,
      pitch: topDown ? 0 : 55,
      duration: 800,
    })
  }, [latitude, longitude, topDown])

  // 現在地ボタンのタッチ対応（ダブルタップ不要にする）
  const recenterTouchRef = useRef(false)
  const handleRecenterTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    recenterTouchRef.current = true
    handleRecenter()
  }, [handleRecenter])
  const handleRecenterClick = useCallback(() => {
    // touchendで既に処理済みならスキップ
    if (recenterTouchRef.current) {
      recenterTouchRef.current = false
      return
    }
    handleRecenter()
  }, [handleRecenter])

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />

      {/* 現在地に戻るボタン */}
      <button
        onTouchEnd={handleRecenterTouch}
        onClick={handleRecenterClick}
        className="fixed z-[1001] right-4 bottom-[calc(12rem+env(safe-area-inset-bottom))] bg-[#1bac53] rounded-full w-11 h-11 shadow-lg flex items-center justify-center hover:bg-[#159a48] active:bg-[#128a3f] transition-colors touch-manipulation"
        aria-label="現在地に戻る"
        title="現在地に戻る"
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{transform: 'rotate(60deg)'}}>
          <path d="M12 2 L16 14 L12 11 L8 14 Z" fill="white" />
          <path d="M12 22 L8 10 L12 13 L16 10 Z" fill="rgba(255,255,255,0.4)" />
        </svg>
      </button>

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
