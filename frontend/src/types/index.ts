export interface UserPreferences {
  budget_min?: number
  budget_max?: number
  location: string
  radius_miles: number
  property_type?: string[]
  bedrooms_min?: number
  bathrooms_min?: number
  sqft_min?: number
  lot_size_min?: number
  commute_location?: string
  school_rating_min?: number
  must_haves: string[]
  nice_to_haves: string[]
  deal_breakers: string[]
  freeform_goal?: string
}

export interface ScoreWeights {
  match: number
  value: number
  opportunity: number
}

export type PropertyCategory = 'exact' | 'derivative' | 'opportunity'

export interface PropertyScore {
  match: number
  value: number
  opportunity: number
  composite: number
}

export interface PropertyExplanation {
  why_matches: string
  why_interesting: string
  tradeoffs: string
  confidence: number
  highlights: string[]
}

export interface Property {
  id: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  beds: number
  baths: number
  sqft: number
  lot_sqft?: number
  year_built?: number
  property_type: string
  latitude: number
  longitude: number
  images: string[]
  listing_url?: string
  days_on_market?: number
  price_reductions?: number
  price_per_sqft: number
  description?: string
  features: string[]
  scores: PropertyScore
  category: PropertyCategory
  explanation: PropertyExplanation
}

export interface SearchArea {
  center_lat: number
  center_lng: number
  radius_miles: number
  label: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface SearchSession {
  id: string
  preferences?: UserPreferences
  search_area?: SearchArea
  weights: ScoreWeights
  properties: Property[]
  is_searching: boolean
  chat: ChatMessage[]
  onboarding_complete: boolean
}

export interface ApiStatus {
  ollama_available: boolean
  ollama_model?: string
  zillow_configured: boolean
  using_demo_data: boolean
  quota_exhausted: boolean
}

export interface SearchResponse {
  properties: Property[]
  search_area: SearchArea
  total_found: number
  categories: Record<string, number>
  quota_exhausted: boolean
}

export interface PropertyDetails {
  zpid: string
  description?: string
  zestimate?: number
  zestimate_low_pct?: number
  zestimate_high_pct?: number
  days_on_zillow?: number
  favorite_count?: number
  page_view_count?: number
  hoa_fee?: number
  hoa_frequency?: string
  street_view_url?: string
  photos_high_res: string[]
  virtual_tour_url?: string
  floor_plan_url?: string
  has_cooling?: boolean
  has_garage?: boolean
  garage_spaces?: number
  has_pool?: boolean
  at_a_glance: Array<{ factLabel: string; factValue: string | null }>
  price_change?: Record<string, unknown> | null
}
