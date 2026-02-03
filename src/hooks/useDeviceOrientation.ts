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
      // iOS: webkitCompassHeadingは北からの角度（0-360）
      heading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading ?? null
    } else if (event.alpha !== null) {
      // Android: alphaは画面の向きからの角度、北を基準に変換
      // absolute が true の場合は地磁気北を基準にしている
      if (event.absolute) {
        heading = (360 - event.alpha) % 360
      } else {
        // 相対的な向きの場合はそのまま使用（精度は低い）
        heading = (360 - event.alpha) % 360
      }
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
      // 許可不要な場合は自動で開始
      window.addEventListener('deviceorientation', handleOrientation, true)
      setState((prev) => ({ ...prev, permissionState: 'granted' }))
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [handleOrientation])

  return {
    ...state,
    requestPermission,
  }
}
