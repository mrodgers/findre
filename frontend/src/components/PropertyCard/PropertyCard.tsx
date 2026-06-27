import { ThumbsUp, ThumbsDown, Bed, Bath, Maximize, TrendingDown, Clock } from 'lucide-react'
import type { Property } from '../../types'

interface PropertyCardProps {
  property: Property
  selected: boolean
  onClick: () => void
  onLike: () => void
  onDislike: () => void
}

const categoryStyles = {
  exact: { badge: 'bg-green-900/60 text-green-400 border-green-800', border: 'border-green-800/30' },
  derivative: { badge: 'bg-blue-900/60 text-blue-400 border-blue-800', border: 'border-blue-800/30' },
  opportunity: { badge: 'bg-amber-900/60 text-amber-400 border-amber-800', border: 'border-amber-800/30' },
  stretch: { badge: 'bg-red-900/60 text-red-400 border-red-800', border: 'border-red-800/40' },
}

const categoryLabels = {
  exact: 'Exact Match',
  derivative: 'Related Find',
  opportunity: 'Hidden Gem',
  stretch: 'Over Budget',
}

export function PropertyCard({ property: p, selected, onClick, onLike, onDislike }: PropertyCardProps) {
  const styles = categoryStyles[p.category]

  return (
    <div
      onClick={onClick}
      className={`card p-3 cursor-pointer transition-all hover:border-gray-700 ${
        selected ? 'border-brand-500 ring-1 ring-brand-500/30' : styles.border
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-white truncate">{p.address}</div>
          <div className="text-xs text-gray-500">{p.city}, {p.state} {p.zip}</div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${styles.badge}`}>
          {categoryLabels[p.category]}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-lg font-bold ${p.category === 'stretch' ? 'text-red-400' : 'text-white'}`}>
          ${(p.price / 1000).toFixed(0)}k
        </span>
        <span className="text-xs text-gray-500">${p.price_per_sqft}/sqft</span>
        {p.price_reductions && p.price_reductions > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-green-400 ml-auto">
            <TrendingDown className="w-3 h-3" />
            {p.price_reductions}x reduced
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.beds}</span>
        <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{p.baths}</span>
        <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{p.sqft.toLocaleString()}sf</span>
        {p.days_on_market !== undefined && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {p.days_on_market}d
          </span>
        )}
      </div>

      {/* Score bars */}
      <div className="space-y-1 mb-2">
        <ScoreBar label="Match" value={p.scores.match} color="bg-green-500" />
        <ScoreBar label="Value" value={p.scores.value} color="bg-blue-500" />
        <ScoreBar label="Opp" value={p.scores.opportunity} color="bg-amber-500" />
      </div>

      {/* Composite + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CompositeRing score={p.scores.composite} />
          <span className="text-xs text-gray-500">composite</span>
        </div>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={onLike}
            className="p-1.5 hover:bg-green-900/40 hover:text-green-400 text-gray-600 rounded transition-colors"
            title="Good fit"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDislike}
            className="p-1.5 hover:bg-red-900/40 hover:text-red-400 text-gray-600 rounded transition-colors"
            title="Not for me"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Explanation teaser */}
      {p.explanation.highlights.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 line-clamp-2">
            {p.explanation.highlights[0]}
          </p>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-8">{label}</span>
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-6 text-right">{value}</span>
    </div>
  )
}

function CompositeRing({ score }: { score: number }) {
  const color = score >= 75 ? '#22c55e' : score >= 55 ? '#f59e0b' : '#6b7280'
  const radius = 12
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference

  return (
    <div className="relative w-9 h-9 flex items-center justify-center">
      <svg width="36" height="36" className="-rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#1f2937" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={radius}
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-bold text-white" style={{ color }}>
        {score}
      </span>
    </div>
  )
}
