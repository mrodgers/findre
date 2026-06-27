# FindRE — Real Estate Discovery Engine

## Current Status: MVP COMPLETE ✓

**Last updated:** 2026-06-24

---

## What's Running

| Service | URL | Status |
|---------|-----|--------|
| Frontend (Vite + React) | http://localhost:5173 | ✓ Running |
| Backend (FastAPI) | http://localhost:8000 | ✓ Running |
| Ollama AI | http://localhost:11434 | ✓ Running — model: qwen3.6:35b |
| Data source | — | Demo data (Zillow API key not configured) |

**Start commands:**
```bash
# Backend
cd backend && uv run python main.py

# Frontend
cd frontend && npm run dev
```

---

## Architecture

```
find-real-estate/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── agents/
│   │   ├── orchestrator.py      # Coordinates all agents
│   │   ├── user_intent.py       # Converts chat → structured prefs
│   │   ├── scoring.py           # Match/Value/Opportunity scoring
│   │   ├── discovery.py         # Derivative + opportunity identification
│   │   └── explanation.py       # AI-generated property explanations
│   ├── providers/
│   │   ├── base.py              # Abstract provider interface
│   │   ├── zillow.py            # Zillow via RapidAPI
│   │   └── demo.py              # Synthetic demo data
│   ├── services/
│   │   └── ollama_service.py    # Ollama LLM integration
│   ├── storage/
│   │   └── cache.py             # SQLite caching
│   ├── models/
│   │   └── schemas.py           # Pydantic data models
│   └── routers/
│       └── api.py               # HTTP route handlers
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── store/index.ts       # Zustand global state
│       ├── services/api.ts      # Backend API client
│       ├── types/index.ts       # TypeScript types
│       └── components/
│           ├── Layout/          # StatusBar, Layout
│           ├── Onboarding/      # Chat onboarding + sidebar chat
│           ├── Map/             # Leaflet map + SearchView
│           ├── PropertyCard/    # Card, ResultsSidebar, PropertyDetail
│           └── ScoreWeights/    # Score weight sliders + presets
├── PROJECT_STATUS.md
└── TASKS.md
```

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | React + Vite + TypeScript | Fast, modern, type-safe |
| State management | Zustand | Lightweight, no boilerplate |
| Map | Leaflet / react-leaflet | OSS, well-supported |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Backend | FastAPI | Async, type-safe, fast |
| Package manager | uv (Python) | Fast, modern |
| AI | Ollama (local) | No cloud dependency |
| Model selection | qwen3.6:35b | Best balance of capability + speed |
| Model option | `think: false` | Required to prevent token budget exhaustion on reasoning models |
| Data | Demo provider | Default; Zillow via RapidAPI when key configured |
| Database | SQLite via aiosqlite | Lightweight, no setup |

---

## Ollama Model Selection

Model priority (highest to lowest capability/speed tradeoff):
1. qwen3.6:35b ← **currently selected**
2. qwen3.5:35b
3. qwen3:30b
4. gemma4:26b
5. gemma4:latest
6. gemma4:e2b
7. qwen3:latest
8. gemma3:latest
9. deepseek-r1:latest
10. qwen3-coder-next (51GB — last resort, very slow)

**Critical:** Must use `"think": false` in Ollama API calls. Reasoning models exhaust token budgets on thinking before outputting.

---

## Zillow API Setup

The system defaults to demo data. To enable live Zillow data:

**Option 1: Environment variable**
```bash
ZILLOW_API_KEY=your_rapidapi_key uv run python main.py
```

**Option 2: API endpoint**
```bash
curl -X POST http://localhost:8000/api/config/zillow-key \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_rapidapi_key"}'
```

Get an API key at: https://rapidapi.com/apimaker/api/zillow-com1

---

## Scoring Algorithm

### Match Score (0–100)
- Price vs budget (major factor)
- Beds/baths vs minimum requirements
- Square footage vs minimum
- Must-have features present/absent
- Deal-breaker detection

### Value Score (0–100)
- Price per sqft vs neighborhood median
- Large sqft relative to price bonus
- Calibrated: -30% below median → 95pts, at median → 55pts, +30% above → 20pts

### Opportunity Score (0–100)
- Days on market (>90d = +35pts, >60d = +25pts, >30d = +10pts)
- Price reductions (2+ = +25pts, 1 = +15pts)
- Under budget with good features bonus
- Nice-to-have feature matches

### Composite Score
`(match × weight_match + value × weight_value + opportunity × weight_opportunity) / 100`

Default weights: 40/35/25 (Match/Value/Opportunity)

---

## Session Learning

The Learning Agent tracks thumbs-up/thumbs-down interactions during the session and nudges score weights toward dimensions that correlate with liked properties. Requires 3+ interactions to activate. No persistent memory — resets on page reload.

---

## Known Limitations / Next Steps

- Demo data is synthetic (realistic San Diego area pricing)
- Property images not shown (placeholder only)
- Zillow API required for real listings
- Map tile style could be improved (currently OSM with dark filter)
- No persistent sessions or saved searches (by design for MVP)
- Search limited to San Diego area in demo mode
