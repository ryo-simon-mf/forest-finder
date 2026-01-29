'use client'

import { useState, useCallback } from 'react'
import type { GeolocationState, Position } from '@/types/geolocation'

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 30000,
  maximumAge: 60000,
}

export function useGeolocation(options: PositionOptions = DEFAULT_OPTIONS) {
  const [state, setState] = useState<GeolocationState>({
    status: 'idle',
    position: null,
    error: null,
  })

  const updatePosition = useCallback((geolocationPosition: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = geolocationPosition.coords
    const position: Position = {
      latitude,
      longitude,
      accuracy,
      timestamp: geolocationPosition.timestamp,
    }
    setState({
      status: 'granted',
      position,
      error: null,
    })
  }, [])

  const handleError = useCallback((error: GeolocationPositionError) => {
    let status: GeolocationState['status'] = 'error'
    let message = 'Unknown error'

    switch (error.code) {
      case error.PERMISSION_DENIED:
        status = 'denied'
        message = '位置情報の使用が許可されていません'
        break
      case error.POSITION_UNAVAILABLE:
        status = 'unavailable'
        message = '位置情報を取得できません'
        break
      case error.TIMEOUT:
        status = 'error'
        message = '位置情報の取得がタイムアウトしました'
        break
    }

    setState({
      status,
      position: null,
      error: message,
    })
  }, [])

  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        status: 'unavailable',
        position: null,
        error: 'お使いのブラウザは位置情報に対応していません',
      })
      return
    }

    setState((prev) => ({ ...prev, status: 'requesting' }))

    navigator.geolocation.getCurrentPosition(updatePosition, handleError, options)
  }, [options, updatePosition, handleError])

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        status: 'unavailable',
        position: null,
        error: 'お使いのブラウザは位置情報に対応していません',
      })
      return null
    }

    setState((prev) => ({ ...prev, status: 'requesting' }))

    const watchId = navigator.geolocation.watchPosition(
      updatePosition,
      handleError,
      options
    )

    return watchId
  }, [options, updatePosition, handleError])

  const stopWatching = useCallback((watchId: number) => {
    navigator.geolocation.clearWatch(watchId)
  }, [])

  return {
    ...state,
    requestPermission,
    startWatching,
    stopWatching,
  }
}
