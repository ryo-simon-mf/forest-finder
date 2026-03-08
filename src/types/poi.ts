export type POIType = 'forest' | 'konbini' | 'station'

export interface POIPoint {
  id: string
  name?: string
  address?: string
  center: {
    latitude: number
    longitude: number
  }
  distance?: number // meters
}

export interface POISearchResult {
  points: POIPoint[]
  nearest: POIPoint | null
  searchRadius: number
}
