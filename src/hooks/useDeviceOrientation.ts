'use client'

import { useState, useEffect, useCallback } from 'react'

interface DeviceOrientationState {
  heading: number | null // 0-360度、北が0
  accuracy: number | null
  isSupported: boolean
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown'
}

export function useDeviceOrientation() {
  const [state, setState] = useState<DeviceOrientationState>({
    heading: null,
    accuracy: null,
    isSupported: false,
    permissionState: 'unknown',
  })

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    // webkitCompassHeading (iOS) または alpha (Android)
    let heading: number | null = null

    if ('webkitCompassHeading' in event) {
      // iOS: webkitCompassHeadingは北からの時計回りの角度（0-360）
      // 北=0, 東=90, 南=180, 西=270
      heading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading ?? null
    } else if (event.alpha !== null) {
      // Android: alphaは北から反時計回りの角度
      // 時計回りに変換: heading = (360 - alpha) % 360
      heading = (360 - event.alpha) % 360
    }

    setState((prev) => ({
      ...prev,
      heading,
      accuracy: (event as DeviceOrientationEvent & { webkitCompassAccuracy?: number }).webkitCompassAccuracy ?? null,
      permissionState: 'granted',
    }))
  }, [])

  const requestPermission = useCallback(async () => {
    // iOS 13+ では許可が必要
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission()
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true)
          setState((prev) => ({ ...prev, permissionState: 'granted' }))
        } else {
          setState((prev) => ({ ...prev, permissionState: 'denied' }))
        }
      } catch {
        setState((prev) => ({ ...prev, permissionState: 'denied' }))
      }
    } else {
      // Android や古いiOSでは許可不要
      window.addEventListener('deviceorientation', handleOrientation, true)
      setState((prev) => ({ ...prev, permissionState: 'granted' }))
    }
  }, [handleOrientation])

  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window

    setState((prev) => ({ ...prev, isSupported }))

    if (!isSupported) return

    // iOS 13+かどうかをチェック
    const needsPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'

    if (needsPermission) {
      setState((prev) => ({ ...prev, permissionState: 'prompt' }))
    } else {
      // Android: deviceorientationabsolute を優先（絶対方位）
      // フォールバックとして deviceorientation を使用
      const win = window as Window & { ondeviceorientationabsolute?: unknown }
      if ('ondeviceorientationabsolute' in win) {
        window.addEventListener('deviceorientationabsolute' as 'deviceorientation', handleOrientation, true)
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true)
      }
      setState((prev) => ({ ...prev, permissionState: 'granted' }))
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', handleOrientation, true)
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [handleOrientation])

  return {
    ...state,
    requestPermission,
  }
}
