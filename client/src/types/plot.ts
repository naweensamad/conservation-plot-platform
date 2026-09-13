export type PlotStatus =
  | 'available'
  | 'protected'
  | 'already_claimed'

export interface Plot {
  id: number
  name: string
  latitude: number
  longitude: number
  status: PlotStatus
  price: number
  size: number
  description: string
}