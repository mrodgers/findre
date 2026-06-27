# FindRE Task Tracker

## ✅ Completed (MVP)

### Core Infrastructure
- [x] Python FastAPI backend with uv package management
- [x] React + TypeScript + Vite frontend
- [x] Tailwind CSS dark theme
- [x] Zustand global state store
- [x] SQLite cache with aiosqlite
- [x] CORS configured for dev

### AI / Ollama Integration
- [x] Ollama availability detection (`ollama list` on startup)
- [x] Automatic model selection with configurable priority ranking
- [x] `think: false` parameter to prevent reasoning model token exhaustion
- [x] JSON extraction with `<think>` tag stripping
- [x] Graceful fallback when Ollama unavailable (rule-based explanations)

### Onboarding Agent
- [x] Conversational chat interface with typing indicator
- [x] Freeform NL goal parsing → structured UserPreferences
- [x] Budget parsing ("$800k" → 800000, "$1.2M" → 1200000)
- [x] Radius parsing ("within 20 miles" → radius_miles: 20)
- [x] Must-have feature extraction
- [x] Location geocoding via Nominatim
- [x] ZIP code fallback coordinates map
- [x] Quick suggestion buttons (4 preset searches)
- [x] Conversation history context (last 20 messages)

### Property Providers
- [x] Abstract BasePropertyProvider interface
- [x] Demo provider: realistic synthetic San Diego listings
  - 15 neighborhoods with authentic pricing
  - Organic opportunity signals (DOM, price reductions)
  - Feature pool with 30+ realistic features
- [x] Zillow provider via RapidAPI (requires key)
- [x] SQLite search result caching (30 min TTL)

### Discovery Engine
- [x] Match Score algorithm
- [x] Value Score algorithm (PSF vs neighborhood median)
- [x] Opportunity Score algorithm (DOM + price reductions + budget headroom)
- [x] Composite score with configurable weights
- [x] Automatic category classification (Exact / Derivative / Opportunity)
- [x] Post-processing opportunity identification pass
- [x] Search radius expansion when results are sparse
- [x] Address+city deduplication

### Explanation Agent
- [x] AI explanations for top 5 properties (Ollama)
- [x] Rule-based explanations for remaining properties
- [x] Why It Matches / Why It's Interesting / Key Tradeoffs / Confidence
- [x] Highlight bullet generation

### Session Learning Agent
- [x] Thumbs-up / thumbs-down interaction recording
- [x] Weight nudging based on liked/disliked property score profiles
- [x] Normalizes weights to sum to 100
- [x] Session-scoped (no persistence)

### Frontend UI
- [x] Dark-themed full-screen layout
- [x] Status bar (AI model indicator, data source indicator, result count)
- [x] Onboarding chat with message history
- [x] Search results sidebar with category filters
- [x] Property cards with score bars + composite ring
- [x] Property detail panel with full AI explanation
- [x] Features tag cloud
- [x] "This is what I want" / "Not my style" feedback buttons
- [x] Score weight sliders with 4 presets
- [x] Leaflet map with dark tile filter
- [x] Search radius circle on map
- [x] Color-coded property markers (green/blue/amber)
- [x] Map popup with score and category
- [x] Chat sidebar in search view (for refining)
- [x] Zillow API key configuration endpoint

---

## 🔲 Post-MVP Enhancements

### Data Quality
- [ ] Real Zillow / MLS data (requires RapidAPI key)
- [ ] Property image fetching and display
- [ ] GreatSchools integration for school ratings
- [ ] WalkScore integration
- [ ] Commute time calculation (Google Maps or HERE API)

### Discovery Improvements
- [ ] Expand to additional metros beyond San Diego
- [ ] Comparable sales-based value score (currently uses synthetic comps)
- [ ] Price history charts
- [ ] "Similar properties" panel in detail view
- [ ] Neighborhood trend analysis

### AI / UX
- [ ] Streaming AI responses for faster perceived speed
- [ ] Multi-turn preference refinement from search view
- [ ] Natural language property filter commands ("show me only the gems under $600k")
- [ ] Export / save search results

### Infrastructure
- [ ] Docker Compose for one-command startup
- [ ] Persistent sessions (optional)
- [ ] Authentication (optional, out of MVP scope)
- [ ] Redfin provider implementation
- [ ] Realtor.com provider implementation
