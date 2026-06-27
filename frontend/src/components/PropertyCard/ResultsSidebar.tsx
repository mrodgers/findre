import { useAppStore } from '../../store'
import { PropertyCard } from './PropertyCard'
import type { Property } from '../../types'
import { Target, TrendingUp, Lightbulb, LayoutGrid, Download } from 'lucide-react'

const categories = [
  { key: 'all' as const, label: 'All', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { key: 'exact' as const, label: 'Exact', icon: <Target className="w-3.5 h-3.5" /> },
  { key: 'derivative' as const, label: 'Related', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'opportunity' as const, label: 'Gems', icon: <Lightbulb className="w-3.5 h-3.5" /> },
]

export function ResultsSidebar() {
  const session = useAppStore(s => s.session)
  const selectedProperty = useAppStore(s => s.selectedProperty)
  const activeCategory = useAppStore(s => s.activeCategory)
  const setActiveCategory = useAppStore(s => s.setActiveCategory)
  const selectProperty = useAppStore(s => s.selectProperty)
  const updateSessionLearning = useAppStore(s => s.updateSessionLearning)

  const counts = {
    all: session.properties.length,
    exact: session.properties.filter(p => p.category === 'exact').length,
    derivative: session.properties.filter(p => p.category === 'derivative').length,
    opportunity: session.properties.filter(p => p.category === 'opportunity').length,
  }

  const visible = session.properties
    .filter(p => activeCategory === 'all' || p.category === activeCategory)
    .sort((a, b) => b.scores.composite - a.scores.composite)

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
      {/* Header row: filter tabs + export */}
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

      {/* Results list */}
      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {visible.map((prop: Property) => (
          <PropertyCard
            key={prop.id}
            property={prop}
            selected={selectedProperty?.id === prop.id}
            onClick={() => selectProperty(prop)}
            onLike={() => {
              updateSessionLearning(prop.id, 'like')
            }}
            onDislike={() => {
              updateSessionLearning(prop.id, 'dislike')
            }}
          />
        ))}

        {visible.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No {activeCategory} matches found
          </div>
        )}
      </div>
    </div>
  )
}

function exportCSV(properties: Property[]) {
  const headers = ['Address', 'City', 'State', 'Zip', 'Price', 'Beds', 'Baths', 'Sqft', '$/sqft', 'Days on Market', 'Category', 'Match', 'Value', 'Opportunity', 'Composite', 'Zillow URL']
  const rows = properties.map(p => [
    p.address, p.city, p.state, p.zip,
    p.price, p.beds, p.baths, p.sqft, p.price_per_sqft,
    p.days_on_market ?? '',
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
