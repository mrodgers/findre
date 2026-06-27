import axios from 'axios'
import type { UserPreferences, Property, SearchArea, ScoreWeights, ApiStatus, SearchResponse, PropertyDetails } from '../types'

const api = axios.create({ baseURL: '/api' })

export type { SearchResponse }

export interface OnboardingResponse {
  message: string
  preferences?: UserPreferences
  search_area?: SearchArea
  complete: boolean
  follow_up?: string
}

export const apiService = {
  async getStatus(): Promise<ApiStatus> {
    const res = await api.get('/status')
    return res.data
  },

  async chat(message: string, sessionId: string, preferences?: UserPreferences): Promise<OnboardingResponse> {
    const res = await api.post('/onboard/chat', {
      message,
      session_id: sessionId,
      current_preferences: preferences,
    })
    return res.data
  },

  async search(preferences: UserPreferences, searchArea: SearchArea, weights: ScoreWeights, sessionId: string): Promise<SearchResponse> {
    const res = await api.post('/search', {
      preferences,
      search_area: searchArea,
      weights,
      session_id: sessionId,
    })
    return res.data
  },

  async setZillowKey(key: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/config/zillow-key', { api_key: key })
    return res.data
  },

  async getPropertyDetails(propertyId: string, listingUrl?: string): Promise<PropertyDetails> {
    const params = listingUrl ? { listing_url: listingUrl } : {}
    const res = await api.get(`/properties/${propertyId}/details`, { params })
    return res.data
  },

  async getSimilarProperties(propertyId: string, sessionId: string): Promise<Property[]> {
    const res = await api.get(`/properties/${propertyId}/similar`, {
      params: { session_id: sessionId }
    })
    return res.data
  },

  async recordInteraction(propertyId: string, action: string, sessionId: string): Promise<void> {
    await api.post('/interactions', {
      property_id: propertyId,
      action,
      session_id: sessionId,
    })
  },
}
