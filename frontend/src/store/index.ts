import { create } from 'zustand'
import type { SearchSession, Property, UserPreferences, ScoreWeights, ChatMessage, SearchArea, ApiStatus } from '../types'

interface AppState {
  session: SearchSession
  apiStatus: ApiStatus | null
  selectedProperty: Property | null
  activeCategory: 'all' | 'exact' | 'derivative' | 'opportunity'
  sidebarView: 'chat' | 'results'
  favorites: Set<string>

  setApiStatus: (status: ApiStatus) => void
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setPreferences: (prefs: UserPreferences) => void
  setSearchArea: (area: SearchArea) => void
  setWeights: (weights: ScoreWeights) => void
  setProperties: (properties: Property[]) => void
  setSearching: (searching: boolean) => void
  setOnboardingComplete: (complete: boolean) => void
  selectProperty: (property: Property | null) => void
  setActiveCategory: (cat: AppState['activeCategory']) => void
  setSidebarView: (view: AppState['sidebarView']) => void
  toggleFavorite: (propertyId: string) => void
  updateSessionLearning: (propertyId: string, action: 'like' | 'dislike' | 'view') => void
  resetSession: () => void
}

const defaultWeights: ScoreWeights = { match: 40, value: 35, opportunity: 25 }

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem('findre_favorites')
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(ids: Set<string>) {
  try {
    localStorage.setItem('findre_favorites', JSON.stringify([...ids]))
  } catch {}
}

export const useAppStore = create<AppState>((set, get) => ({
  session: {
    id: crypto.randomUUID(),
    weights: defaultWeights,
    properties: [],
    is_searching: false,
    chat: [{
      id: 'welcome',
      role: 'assistant' as const,
      content: `Hi! I'm your AI real estate scout. I'll help you discover properties you'd never find through a standard Zillow search — hidden gems, undervalued opportunities, and neighborhoods worth exploring.\n\nLet's start with the basics: **Where are you looking to buy, and what's your budget?**\n\nYou can also just describe what you want in plain English — something like *"I want the best value house within 20 miles of 92108 under $900k with a large garage"* — and I'll figure out the details.`,
      timestamp: Date.now(),
    }],
    onboarding_complete: false,
  },
  apiStatus: null,
  selectedProperty: null,
  activeCategory: 'all',
  sidebarView: 'chat',
  favorites: loadFavorites(),

  setApiStatus: (status) => set({ apiStatus: status }),

  addChatMessage: (msg) => set((state) => ({
    session: {
      ...state.session,
      chat: [...state.session.chat, {
        ...msg,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      }]
    }
  })),

  setPreferences: (prefs) => set((state) => ({
    session: { ...state.session, preferences: prefs }
  })),

  setSearchArea: (area) => set((state) => ({
    session: { ...state.session, search_area: area }
  })),

  setWeights: (weights) => set((state) => ({
    session: { ...state.session, weights }
  })),

  setProperties: (properties) => set((state) => ({
    session: { ...state.session, properties },
    sidebarView: 'results',
  })),

  setSearching: (is_searching) => set((state) => ({
    session: { ...state.session, is_searching }
  })),

  setOnboardingComplete: (onboarding_complete) => set((state) => ({
    session: { ...state.session, onboarding_complete }
  })),

  selectProperty: (selectedProperty) => set({ selectedProperty }),

  setActiveCategory: (activeCategory) => set({ activeCategory }),

  setSidebarView: (sidebarView) => set({ sidebarView }),

  toggleFavorite: (propertyId) => set((state) => {
    const next = new Set(state.favorites)
    if (next.has(propertyId)) next.delete(propertyId)
    else next.add(propertyId)
    saveFavorites(next)
    return { favorites: next }
  }),

  resetSession: () => set({
    session: {
      id: crypto.randomUUID(),
      weights: defaultWeights,
      properties: [],
      is_searching: false,
      chat: [{
        id: 'welcome',
        role: 'assistant' as const,
        content: `Hi! I'm your AI real estate scout. I'll help you discover properties you'd never find through a standard Zillow search — hidden gems, undervalued opportunities, and neighborhoods worth exploring.\n\nLet's start with the basics: **Where are you looking to buy, and what's your budget?**\n\nYou can also just describe what you want in plain English — something like *"I want the best value house within 20 miles of 92108 under $900k with a large garage"* — and I'll figure out the details.`,
        timestamp: Date.now(),
      }],
      onboarding_complete: false,
    },
    selectedProperty: null,
    activeCategory: 'all',
    sidebarView: 'chat',
  }),

  updateSessionLearning: (propertyId, action) => {
    // Adjust weights based on what properties user engages with
    const state = get()
    const prop = state.session.properties.find(p => p.id === propertyId)
    if (!prop || action === 'view') return

    const { weights } = state.session
    const multiplier = action === 'like' ? 1 : -1
    const delta = 2

    // Nudge weights toward the category of liked/disliked property
    const newWeights = { ...weights }
    if (prop.scores.value > prop.scores.match) {
      newWeights.value = Math.min(70, Math.max(10, weights.value + delta * multiplier))
    } else if (prop.scores.opportunity > prop.scores.value) {
      newWeights.opportunity = Math.min(70, Math.max(10, weights.opportunity + delta * multiplier))
    } else {
      newWeights.match = Math.min(70, Math.max(10, weights.match + delta * multiplier))
    }

    // Normalize to 100
    const total = newWeights.match + newWeights.value + newWeights.opportunity
    set((s) => ({
      session: {
        ...s.session,
        weights: {
          match: Math.round(newWeights.match / total * 100),
          value: Math.round(newWeights.value / total * 100),
          opportunity: 100 - Math.round(newWeights.match / total * 100) - Math.round(newWeights.value / total * 100),
        }
      }
    }))
  },
}))

if (import.meta.env.DEV) {
  // @ts-ignore
  window.__appStore__ = useAppStore
}
