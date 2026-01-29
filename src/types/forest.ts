export interface ForestArea {
  id: string
  name?: string
  address?: string
  center: {
    latitude: number
    longitude: number
  }
  distance?: number // メートル
}

export interface ForestSearchResult {
  forests: ForestArea[]
  nearest: ForestArea | null
  searchRadius: number // メートル
}
