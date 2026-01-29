export type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error'

export interface Position {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface GeolocationState {
  status: GeolocationStatus
  position: Position | null
  error: string | null
}
