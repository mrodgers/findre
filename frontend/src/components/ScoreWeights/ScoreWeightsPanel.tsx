import { useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../store'
import { apiService } from '../../services/api'
import type { ScoreWeights } from '../../types'

const presets: Array<{ label: string; weights: ScoreWeights }> = [
  { label: 'Balanced', weights: { match: 40, value: 35, opportunity: 25 } },
  { label: 'Best Value', weights: { match: 20, value: 55, opportunity: 25 } },
  { label: 'Perfect Fit', weights: { match: 65, value: 20, opportunity: 15 } },
  { label: 'Gem Hunter', weights: { match: 20, value: 30, opportunity: 50 } },
]

export function ScoreWeightsPanel() {
  const [expanded, setExpanded] = useState(false)
  const [reranking, setReranking] = useState(false)
  const session = useAppStore(s => s.session)
  const weights = useAppStore(s => s.session.weights)
  const setWeights = useAppStore(s => s.setWeights)
  const setProperties = useAppStore(s => s.setProperties)
  const setSearching = useAppStore(s => s.setSearching)

  const rerank = async () => {
    if (!session.preferences || !session.search_area) return
    setReranking(true)
    setSearching(true)
    try {
      const res = await apiService.search(session.preferences, session.search_area, weights, session.id)
      setProperties(res.properties)
    } catch {
      // silently ignore
    } finally {
      setReranking(false)
      setSearching(false)
    }
  }

  const update = (key: keyof ScoreWeights, value: number) => {
    const others = Object.keys(weights).filter(k => k !== key) as Array<keyof ScoreWeights>
    const remaining = 100 - value
    const currentOtherTotal = others.reduce((sum, k) => sum + weights[k], 0)

    const newWeights = { ...weights, [key]: value }
    if (currentOtherTotal > 0) {
      for (const k of others) {
        newWeights[k] = Math.round((weights[k] / currentOtherTotal) * remaining)
      }
      // Adjust for rounding
      const total = Object.values(newWeights).reduce((a, b) => a + b, 0)
      if (total !== 100) {
        const diff = 100 - total
        newWeights[others[0]] += diff
      }
    }

    setWeights(newWeights)
  }

  return (
    <div className="border-t border-gray-800">
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Weights · {weights.match}/{weights.value}/{weights.opportunity}
          </span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {session.properties.length > 0 && (
          <button
            onClick={rerank}
            disabled={reranking}
            title="Re-rank with current weights"
            className="px-2 py-2 text-gray-600 hover:text-brand-400 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reranking ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Presets */}
          <div className="flex gap-1.5 flex-wrap">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => setWeights(p.weights)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  JSON.stringify(weights) === JSON.stringify(p.weights)
                    ? 'border-brand-500 text-brand-400 bg-brand-950'
                    : 'border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <WeightSlider
            label="Match"
            description="How well it fits your criteria"
            value={weights.match}
            onChange={v => update('match', v)}
            color="text-green-400 accent-green-500"
          />
          <WeightSlider
            label="Value"
            description="Price vs. comparable homes"
            value={weights.value}
            onChange={v => update('value', v)}
            color="text-blue-400 accent-blue-500"
          />
          <WeightSlider
            label="Opportunity"
            description="Hidden gems & price drops"
            value={weights.opportunity}
            onChange={v => update('opportunity', v)}
            color="text-amber-400 accent-amber-500"
          />
        </div>
      )}
    </div>
  )
}

function WeightSlider({ label, description, value, onChange, color }: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  color: string
}) {
  const [textColor, accentColor] = color.split(' ')
  return (
    <div>
      <div className="flex justify-between mb-1">
        <div>
          <span className={`text-xs font-medium ${textColor}`}>{label}</span>
          <span className="text-xs text-gray-600 ml-1.5">{description}</span>
        </div>
        <span className={`text-xs font-bold ${textColor}`}>{value}%</span>
      </div>
      <input
        type="range"
        min={5}
        max={80}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full bg-gray-800 ${accentColor} cursor-pointer`}
      />
    </div>
  )
}
