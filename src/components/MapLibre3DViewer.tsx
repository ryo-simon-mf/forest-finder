'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import selectIconImg from '@/img/select_color.svg'
import nonSelectIconImg from '@/img/non_select_color.svg'

interface ForestMarker {
  lat: number
  lon: number
  isNearest?: boolean
  isSelected?: boolean
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

// SVGをそのままの色で画像化
function createSvgImage(
  svgSrc: string,
  height: number,
  aspectRatio: number = 214.05 / 356.11
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ratio = window.devicePixelRatio || 1
    const pxH = Math.round(height * ratio)
    const pxW = Math.round(pxH * aspectRatio)
    canvas.width = pxW
    canvas.height = pxH
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, pxW, pxH)
      const imageData = ctx.getImageData(0, 0, pxW, pxH)
      resolve({ width: pxW, height: pxH, data: imageData.data })
    }
    img.src = svgSrc
  })
}

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
  const [useMobile] = useState(() => isTouchDevice())
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
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({
      customAttribution: '© <a href="https://project-osrm.org">OSRM</a>',
    }))

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

  // 現在地マーカー（方向付き）— 地図回転を補正
  const headingRef = useRef<number | null | undefined>(heading)
  headingRef.current = heading

  const updateArrowRotation = useCallback(() => {
    const map = mapRef.current
    const marker = locationMarkerRef.current
    if (!map || !marker) return
    const arrow = marker.getElement().querySelector('.direction-arrow') as HTMLElement | null
    if (!arrow) return
    const h = headingRef.current
    if (h !== null && h !== undefined) {
      const mapBearing = map.getBearing()
      arrow.style.display = 'block'
      arrow.style.transform = `rotate(${h - mapBearing}deg)`
    } else {
      arrow.style.display = 'none'
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLngLat([longitude, latitude])
      updateArrowRotation()
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
      display: none;
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

    updateArrowRotation()
  }, [latitude, longitude, mapLoaded, heading, updateArrowRotation])

  // 地図回転時に方向矢印を補正
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const onRotate = () => updateArrowRotation()
    map.on('rotate', onRotate)
    return () => { map.off('rotate', onRotate) }
  }, [mapLoaded, updateArrowRotation])

  // 森林マーカー
  const handleForestClick = useCallback(
    (index: number) => {
      onForestClick?.(index)
    },
    [onForestClick]
  )

  // --- モバイル: GeoJSON source + クラスタリング（symbol layer + SVGアイコン） ---
  const forestClickHandlerRef = useRef(handleForestClick)
  forestClickHandlerRef.current = handleForestClick
  const mobileIconsLoadedRef = useRef(false)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !useMobile) return

    const hasAnySelected = forestMarkers.some((fm) => fm.isSelected)
    const sourceData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: forestMarkers.map((fm, idx) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [fm.lon, fm.lat] },
        properties: {
          idx,
          isNearest: fm.isNearest ? 1 : 0,
          isSelected: fm.isSelected ? 1 : 0,
          // 最寄りがアクティブ: 選択なし or 最寄り自身が選択中
          nearestActive: (fm.isNearest && (!hasAnySelected || fm.isSelected)) ? 1 : 0,
          // ピン留め（nearest/selected）は常に表示、それ以外はコリジョン検出で間引き
          pinned: (fm.isNearest || fm.isSelected) ? 1 : 0,
        },
      })),
    }

    if (map.getSource('forests')) {
      ;(map.getSource('forests') as maplibregl.GeoJSONSource).setData(sourceData)
      return
    }

    // SVGアイコンをMapLibreに登録してからレイヤー追加
    const setupLayers = async () => {
      if (!mobileIconsLoadedRef.current) {
        const [nearestActiveIcon, nearestInactiveIcon, selectedIcon, nonSelectIcon] = await Promise.all([
          createSvgImage(selectIconImg.src, 48),
          createSvgImage(nonSelectIconImg.src, 48),
          createSvgImage(selectIconImg.src, 36),
          createSvgImage(nonSelectIconImg.src, 36),
        ])
        map.addImage('forest-nearest-active', nearestActiveIcon, { pixelRatio: window.devicePixelRatio || 1 })
        map.addImage('forest-nearest-inactive', nearestInactiveIcon, { pixelRatio: window.devicePixelRatio || 1 })
        map.addImage('forest-normal', nonSelectIcon, { pixelRatio: window.devicePixelRatio || 1 })
        map.addImage('forest-selected', selectedIcon, { pixelRatio: window.devicePixelRatio || 1 })
        mobileIconsLoadedRef.current = true
      }

      map.addSource('forests', {
        type: 'geojson',
        data: sourceData,
      })

      // 通常マーカー（最下層、コリジョン検出で自動間引き）
      map.addLayer({
        id: 'forest-normal',
        type: 'symbol',
        source: 'forests',
        filter: ['==', ['get', 'pinned'], 0],
        layout: {
          'icon-image': 'forest-normal',
          'icon-size': 1,
          'icon-allow-overlap': false,
          'icon-padding': 2,
          'symbol-sort-key': 2,
        },
      })

      // 最寄りマーカー（通常の上、サイズ固定48px、色はnearestActiveで切替）
      map.addLayer({
        id: 'forest-nearest',
        type: 'symbol',
        source: 'forests',
        filter: ['==', ['get', 'isNearest'], 1],
        layout: {
          'icon-image': ['case', ['==', ['get', 'nearestActive'], 1], 'forest-nearest-active', 'forest-nearest-inactive'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': 0,
        },
      })

      // 選択中マーカー（最前面）
      map.addLayer({
        id: 'forest-selected',
        type: 'symbol',
        source: 'forests',
        filter: ['all', ['==', ['get', 'isSelected'], 1], ['!=', ['get', 'isNearest'], 1]],
        layout: {
          'icon-image': 'forest-selected',
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': 0,
        },
      })

      // マーカークリック → 森林選択
      const handleClick = (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['forest-nearest', 'forest-selected', 'forest-normal'],
        })
        if (!features.length) return
        const idx = features[0].properties?.idx
        if (idx !== undefined) {
          forestClickHandlerRef.current(idx)
        }
      }
      map.on('click', 'forest-nearest', handleClick)
      map.on('click', 'forest-selected', handleClick)
      map.on('click', 'forest-normal', handleClick)
    }

    setupLayers()
  }, [forestMarkers, mapLoaded, useMobile])

  // --- PC: DOM Marker（ビューポート内のみ表示 + 差分更新） ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || useMobile) return

    const visibleBounds = map.getBounds()
    const padding = 0.01
    const paddedBounds = new maplibregl.LngLatBounds(
      [visibleBounds.getWest() - padding, visibleBounds.getSouth() - padding],
      [visibleBounds.getEast() + padding, visibleBounds.getNorth() + padding]
    )

    const newKeys = new Set<string>()
    const markersToAdd: { fm: ForestMarker; idx: number; key: string }[] = []

    forestMarkers.forEach((fm, idx) => {
      const key = `${fm.lat},${fm.lon}`
      const fullKey = `${key}:${fm.isNearest ? 1 : 0}:${fm.isSelected ? 1 : 0}`
      if (paddedBounds.contains([fm.lon, fm.lat])) {
        newKeys.add(fullKey)
        if (!markersRef.current.has(fullKey)) {
          // 同一座標の古い状態のマーカーを削除
          markersRef.current.forEach((marker, existingKey) => {
            if (existingKey.startsWith(key + ':')) {
              marker.remove()
              markersRef.current.delete(existingKey)
            }
          })
          markersToAdd.push({ fm, idx, key: fullKey })
        }
      }
    })

    markersRef.current.forEach((marker, key) => {
      if (!newKeys.has(key)) {
        marker.remove()
        markersRef.current.delete(key)
      }
    })

    const hasAnySelectedPC = forestMarkers.some((fm) => fm.isSelected)
    markersToAdd.forEach(({ fm, idx, key }) => {
      const isActiveColor = fm.isSelected || (fm.isNearest && (!hasAnySelectedPC || fm.isSelected))
      const iconSize = fm.isNearest ? 48 : 36
      const svgSrc = isActiveColor ? selectIconImg.src : nonSelectIconImg.src
      const tapSize = Math.max(44, iconSize)
      const el = document.createElement('div')
      el.style.cssText = `
        width: ${tapSize}px; height: ${tapSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      `
      const icon = document.createElement('img')
      icon.src = svgSrc
      icon.style.cssText = `
        width: auto;
        height: ${iconSize}px;
        ${isActiveColor ? 'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));' : ''}
      `
      el.appendChild(icon)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        handleForestClick(idx)
      })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fm.lon, fm.lat])
        .addTo(map)

      markersRef.current.set(key, marker)
    })
  }, [forestMarkers, handleForestClick, mapLoaded, useMobile])

  // PC: ズーム/パン時にマーカーの表示/非表示を更新
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || useMobile) return

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
  }, [mapLoaded, useMobile])

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

    // ルートラインは全森林マーカーの下に描画
    const beforeLayer = ['forest-normal', 'forest-selected', 'forest-nearest'].find(id => map.getLayer(id))
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
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          12, 3,
          15, 5,
          18, 8,
        ],
        'line-opacity': 0.85,
        'line-dasharray': [2, 1.5],
      },
    }, beforeLayer)

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

  // ノースアップ（bearing=0にリセット）
  const handleNorthUp = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({ bearing: 0, duration: 600 })
  }, [])

  // 現在地ボタンのタッチ対応（ダブルタップ不要にする）
  const recenterTouchRef = useRef(false)
  const handleRecenterTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    recenterTouchRef.current = true
    handleRecenter()
  }, [handleRecenter])
  const handleRecenterClick = useCallback(() => {
    if (recenterTouchRef.current) {
      recenterTouchRef.current = false
      return
    }
    handleRecenter()
  }, [handleRecenter])

  const northTouchRef = useRef(false)
  const handleNorthTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    northTouchRef.current = true
    handleNorthUp()
  }, [handleNorthUp])
  const handleNorthClick = useCallback(() => {
    if (northTouchRef.current) {
      northTouchRef.current = false
      return
    }
    handleNorthUp()
  }, [handleNorthUp])

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />

      {/* ノースアップボタン */}
      <button
        onTouchEnd={handleNorthTouch}
        onClick={handleNorthClick}
        className="fixed z-[1001] right-5 bottom-[calc(140px+2rem+44px+0.75rem+env(safe-area-inset-bottom))] bg-[#1bac53] rounded-full w-11 h-11 shadow-lg flex items-center justify-center hover:bg-[#159a48] active:bg-[#128a3f] transition-colors touch-manipulation"
        aria-label="ノースアップ"
        title="ノースアップ（北を上に）"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 L16 10 L12 8 L8 10 Z" fill="white" />
          <text x="12" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">N</text>
        </svg>
      </button>

      {/* 現在地に戻るボタン */}
      <button
        onTouchEnd={handleRecenterTouch}
        onClick={handleRecenterClick}
        className="fixed z-[1001] right-5 bottom-[calc(140px+2rem+env(safe-area-inset-bottom))] bg-[#1bac53] rounded-full w-11 h-11 shadow-lg flex items-center justify-center hover:bg-[#159a48] active:bg-[#128a3f] transition-colors touch-manipulation"
        aria-label="現在地に戻る"
        title="現在地に戻る"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{transform: 'rotate(60deg)'}}>
          <path d="M12 2 L19 20 L12 15 L5 20 Z" fill="white" />
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
        .maplibregl-ctrl-attrib {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
