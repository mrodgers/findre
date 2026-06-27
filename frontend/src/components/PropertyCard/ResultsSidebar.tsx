import { useState } from 'react'
import { useAppStore } from '../../store'
import { PropertyCard } from './PropertyCard'
import type { Property } from '../../types'
import { Target, TrendingUp, Lightbulb, LayoutGrid, Download, ChevronDown, ChevronRight, Heart } from 'lucide-react'

const categories = [
  { key: 'all' as const, label: 'All', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { key: 'exact' as const, label: 'Exact', icon: <Target className="w-3.5 h-3.5" /> },
  { key: 'derivative' as const, label: 'Related', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'opportunity' as const, label: 'Gems', icon: <Lightbulb className="w-3.5 h-3.5" /> },
]

const propertyTypes = [
  { key: 'all',           label: 'All types' },
  { key: 'single_family', label: 'House' },
  { key: 'condo',         label: 'Condo' },
  { key: 'townhouse',     label: 'Townhome' },
  { key: 'multi_family',  label: 'Multi' },
  { key: 'land',          label: 'Land' },
]

export function ResultsSidebar() {
  const session = useAppStore(s => s.session)
  const selectedProperty = useAppStore(s => s.selectedProperty)
  const activeCategory = useAppStore(s => s.activeCategory)
  const setActiveCategory = useAppStore(s => s.setActiveCategory)
  const propertyTypeFilter = useAppStore(s => s.propertyTypeFilter)
  const setPropertyTypeFilter = useAppStore(s => s.setPropertyTypeFilter)
  const selectProperty = useAppStore(s => s.selectProperty)
  const updateSessionLearning = useAppStore(s => s.updateSessionLearning)
  const [stretchExpanded, setStretchExpanded] = useState(false)
  const [savedExpanded, setSavedExpanded] = useState(true)
  const favorites = useAppStore(s => s.favorites)

  // Separate stretch from main results, then apply property type filter
  const inBudget = session.properties.filter(p => p.category !== 'stretch')
  const stretchProperties = session.properties.filter(p => p.category === 'stretch')
  const savedProperties = session.properties.filter(p => favorites.has(p.id))

  const matchesTypeFilter = (p: Property) =>
    propertyTypeFilter === 'all' || p.property_type === propertyTypeFilter

  // Which types actually appear in results (to show only relevant chips)
  const presentTypes = new Set(session.properties.map(p => p.property_type))
  const visibleTypeFilters = propertyTypes.filter(
    t => t.key === 'all' || presentTypes.has(t.key)
  )

  const counts = {
    all: inBudget.filter(matchesTypeFilter).length,
    exact: inBudget.filter(p => p.category === 'exact' && matchesTypeFilter(p)).length,
    derivative: inBudget.filter(p => p.category === 'derivative' && matchesTypeFilter(p)).length,
    opportunity: inBudget.filter(p => p.category === 'opportunity' && matchesTypeFilter(p)).length,
  }

  const visible = inBudget.filter(
    p => (activeCategory === 'all' || p.category === activeCategory) && matchesTypeFilter(p)
  )

  if (session.properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="text-gray-600 text-sm">
          {session.is_searching
            ? 'Searching for properties...'
            : 'Complete onboarding to see results'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs + export */}
      <div className="flex items-center justify-between pr-2 border-b border-gray-800">
        <div className="flex gap-1 p-2 flex-1">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat.key
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {cat.icon}
              {cat.label}
              <span className="text-gray-500">({counts[cat.key]})</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => exportCSV(session.properties)}
          title="Export as CSV"
          className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Property type filter chips */}
      {visibleTypeFilters.length > 2 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-gray-800 overflow-x-auto scrollbar-none">
          {visibleTypeFilters.map(t => (
            <button
              key={t.key}
              onClick={() => setPropertyTypeFilter(t.key)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                propertyTypeFilter === t.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Saved properties section */}
        {activeCategory === 'all' && savedProperties.length > 0 && (
          <div>
            <button
              onClick={() => setSavedExpanded(s => !s)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-red-900/40 bg-red-950/20 text-red-400 text-xs font-medium hover:bg-red-950/40 transition-colors"
            >
              {savedExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <Heart className="w-3 h-3 fill-current" />
              Saved — {savedProperties.length} {savedProperties.length === 1 ? 'property' : 'properties'}
            </button>
            {savedExpanded && (
              <div className="mt-2 space-y-2">
                {savedProperties.map((prop: Property) => (
                  <PropertyCard
                    key={prop.id}
                    property={prop}
                    selected={selectedProperty?.id === prop.id}
                    onClick={() => selectProperty(prop)}
                    onLike={() => updateSessionLearning(prop.id, 'like')}
                    onDislike={() => updateSessionLearning(prop.id, 'dislike')}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {visible.map((prop: Property) => (
          <PropertyCard
            key={prop.id}
            property={prop}
            selected={selectedProperty?.id === prop.id}
            onClick={() => selectProperty(prop)}
            onLike={() => updateSessionLearning(prop.id, 'like')}
            onDislike={() => updateSessionLearning(prop.id, 'dislike')}
          />
        ))}

        {visible.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No {propertyTypeFilter !== 'all'
              ? propertyTypes.find(t => t.key === propertyTypeFilter)?.label
              : activeCategory} matches found
          </div>
        )}

        {/* Over Budget section */}
        {activeCategory === 'all' && stretchProperties.filter(matchesTypeFilter).length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setStretchExpanded(s => !s)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-red-900/40 bg-red-950/20 text-red-400 text-xs font-medium hover:bg-red-950/40 transition-colors"
            >
              {stretchExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Over Budget — {stretchProperties.filter(matchesTypeFilter).length} {stretchProperties.filter(matchesTypeFilter).length === 1 ? 'property' : 'properties'} (up to 25% over)
            </button>
            {stretchExpanded && (
              <div className="mt-2 space-y-2">
                {stretchProperties.filter(matchesTypeFilter).map((prop: Property) => (
                  <PropertyCard
                    key={prop.id}
                    property={prop}
                    selected={selectedProperty?.id === prop.id}
                    onClick={() => selectProperty(prop)}
                    onLike={() => updateSessionLearning(prop.id, 'like')}
                    onDislike={() => updateSessionLearning(prop.id, 'dislike')}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function exportCSV(properties: Property[]) {
  const headers = ['Address', 'City', 'State', 'Zip', 'Price', 'Beds', 'Baths', 'Sqft', '$/sqft', 'Days on Market', 'Type', 'Category', 'Match', 'Value', 'Opportunity', 'Composite', 'Zillow URL']
  const rows = properties.map(p => [
    p.address, p.city, p.state, p.zip,
    p.price, p.beds, p.baths, p.sqft, p.price_per_sqft,
    p.days_on_market ?? '',
    p.property_type,
    p.category,
    p.scores.match, p.scores.value, p.scores.opportunity, p.scores.composite,
    p.listing_url ?? '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `findre-results-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
