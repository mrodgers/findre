import { useEffect, useState } from 'react'
import { X, ExternalLink, MapPin, Bed, Bath, Maximize, Calendar, TrendingDown, Clock, Star, Eye, Heart, Home, Thermometer, Video, LayoutPanelLeft } from 'lucide-react'
import { useAppStore } from '../../store'
import { apiService } from '../../services/api'
import type { PropertyDetails } from '../../types'

export function PropertyDetail() {
  const property = useAppStore(s => s.selectedProperty)
  const apiStatus = useAppStore(s => s.apiStatus)
  const selectProperty = useAppStore(s => s.selectProperty)
  const updateSessionLearning = useAppStore(s => s.updateSessionLearning)

  const [details, setDetails] = useState<PropertyDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    if (!property) { setDetails(null); setPhotoIdx(0); return }
    if (!apiStatus?.zillow_configured || apiStatus?.quota_exhausted) return

    setDetailsLoading(true)
    apiService.getPropertyDetails(property.id, property.listing_url)
      .then(setDetails)
      .catch(() => setDetails(null))
      .finally(() => setDetailsLoading(false))
  }, [property?.id])

  if (!property) return null

  const p = property
  const confidenceLabel = p.explanation.confidence >= 0.8 ? 'High' : p.explanation.confidence >= 0.6 ? 'Medium' : 'Low'
  const confidenceColor = p.explanation.confidence >= 0.8 ? 'text-green-400' : p.explanation.confidence >= 0.6 ? 'text-amber-400' : 'text-gray-500'

  const allPhotos = details?.photos_high_res?.length
    ? details.photos_high_res
    : p.images

  const zestDiff = details?.zestimate ? details.zestimate - p.price : null
  const zestPct = zestDiff && details?.zestimate ? Math.round((zestDiff / details.zestimate) * 100) : null

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div>
          <h2 className="font-semibold text-white">{p.address}</h2>
          <p className="text-xs text-gray-500">{p.city}, {p.state} {p.zip}</p>
        </div>
        <button onClick={() => selectProperty(null)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Photo carousel */}
        {allPhotos.length > 0 ? (
          <div className="relative">
            <img
              src={allPhotos[photoIdx]}
              alt={p.address}
              className="w-full h-52 object-cover rounded-xl"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            {allPhotos.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {allPhotos.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
            {allPhotos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">‹</button>
                <button onClick={() => setPhotoIdx(i => (i + 1) % allPhotos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">›</button>
              </>
            )}
          </div>
        ) : (
          <div className="h-52 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600">
            {detailsLoading ? (
              <div className="animate-pulse text-xs text-gray-600">Loading photos…</div>
            ) : (
              <MapPin className="w-8 h-8" />
            )}
          </div>
        )}

        {/* Rich media links */}
        {(details?.virtual_tour_url || details?.floor_plan_url || details?.street_view_url) && (
          <div className="flex gap-2 flex-wrap">
            {details.virtual_tour_url && (
              <a href={details.virtual_tour_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-brand-400 transition-colors">
                <Video className="w-3 h-3" /> Virtual Tour
              </a>
            )}
            {details.floor_plan_url && (
              <a href={details.floor_plan_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-brand-400 transition-colors">
                <LayoutPanelLeft className="w-3 h-3" /> Floor Plan
              </a>
            )}
          </div>
        )}

        {/* Price + zestimate */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-white">${p.price.toLocaleString()}</div>
            <div className="text-sm text-gray-500">${p.price_per_sqft}/sqft</div>
            {details?.zestimate && (
              <div className="mt-1 text-xs text-gray-500">
                Zillow estimate: <span className="text-gray-300">${details.zestimate.toLocaleString()}</span>
                {zestPct !== null && (
                  <span className={zestPct > 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                    ({zestPct > 0 ? '+' : ''}{zestPct}% vs list)
                  </span>
                )}
              </div>
            )}
            {details?.hoa_fee && (
              <div className="mt-1 text-xs text-amber-500">
                HOA: ${details.hoa_fee.toLocaleString()}/{details.hoa_frequency?.toLowerCase() || 'mo'}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {p.listing_url && (
              <a href={p.listing_url} target="_blank" rel="noopener noreferrer"
                className="btn-ghost flex items-center gap-1.5 text-sm">
                <ExternalLink className="w-3.5 h-3.5" /> View on Zillow
              </a>
            )}
            {/* Demand signals */}
            {details?.favorite_count != null && (
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-400" /> {details.favorite_count.toLocaleString()} saves
                </span>
                {details.page_view_count && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-blue-400" /> {details.page_view_count.toLocaleString()} views
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox icon={<Bed className="w-4 h-4" />} label="Beds" value={p.beds} />
          <StatBox icon={<Bath className="w-4 h-4" />} label="Baths" value={p.baths} />
          <StatBox icon={<Maximize className="w-4 h-4" />} label="Sqft" value={p.sqft.toLocaleString()} />
          {p.year_built && <StatBox icon={<Calendar className="w-4 h-4" />} label="Built" value={p.year_built} />}
        </div>

        {/* Market time + price reductions */}
        {(p.days_on_market !== undefined || (p.price_reductions && p.price_reductions > 0)) && (
          <div className="flex gap-4 text-sm">
            {p.days_on_market !== undefined && (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Clock className="w-4 h-4" />
                {p.days_on_market} days on market
              </span>
            )}
            {p.price_reductions && p.price_reductions > 0 && (
              <span className="flex items-center gap-1.5 text-green-400">
                <TrendingDown className="w-4 h-4" />
                {p.price_reductions} price reduction{p.price_reductions !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* At-a-glance facts from Zillow */}
        {details?.at_a_glance && details.at_a_glance.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-brand-400" /> At a Glance
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {details.at_a_glance.filter(f => f.factValue).map(f => (
                <div key={f.factLabel} className="text-xs">
                  <span className="text-gray-500">{f.factLabel}: </span>
                  <span className="text-gray-300">{f.factValue}</span>
                </div>
              ))}
              {details.has_cooling === false && (
                <div className="text-xs">
                  <span className="text-amber-500 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" /> No A/C
                  </span>
                </div>
              )}
              {details.has_pool && (
                <div className="text-xs text-blue-400">Pool</div>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {details?.description && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-6">{details.description}</p>
          </div>
        )}

        {/* Scores */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Score Breakdown</h3>
          <div className="grid grid-cols-3 gap-3">
            <ScoreDisplay label="Match" score={p.scores.match} color="text-green-400" bg="bg-green-500" />
            <ScoreDisplay label="Value" score={p.scores.value} color="text-blue-400" bg="bg-blue-500" />
            <ScoreDisplay label="Opportunity" score={p.scores.opportunity} color="text-amber-400" bg="bg-amber-500" />
          </div>
          <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-400">Composite Score</span>
            <span className="text-xl font-bold text-white">{p.scores.composite}</span>
          </div>
        </div>

        {/* AI Explanation */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Why This Property</h3>
            <span className={`text-xs font-medium ${confidenceColor}`}>{confidenceLabel} Confidence</span>
          </div>
          <ExplanationSection title="Why It Matches" content={p.explanation.why_matches} color="text-green-400" />
          <ExplanationSection title="Why It's Interesting" content={p.explanation.why_interesting} color="text-brand-400" />
          <ExplanationSection title="Key Tradeoffs" content={p.explanation.tradeoffs} color="text-amber-400" />
        </div>

        {/* Features */}
        {p.features.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Features</h3>
            <div className="flex flex-wrap gap-2">
              {p.features.map(f => (
                <span key={f} className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-800 rounded-lg text-gray-400">
                  <Star className="w-3 h-3 text-amber-500" />
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback buttons */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={() => { updateSessionLearning(p.id, 'like'); selectProperty(null) }}
            className="flex-1 btn-primary text-center"
          >
            This is what I want
          </button>
          <button
            onClick={() => { updateSessionLearning(p.id, 'dislike'); selectProperty(null) }}
            className="flex-1 btn-ghost text-center"
          >
            Not my style
          </button>
        </div>
      </div>
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="card p-2 flex flex-col items-center gap-1">
      <span className="text-gray-500">{icon}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}

function ScoreDisplay({ label, score, color, bg }: { label: string; score: number; color: string; bg: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-12 h-12 relative flex items-center justify-center">
        <svg width="48" height="48" className="-rotate-90">
          <circle cx="24" cy="24" r="18" fill="none" stroke="#1f2937" strokeWidth="4" />
          <circle
            cx="24" cy="24" r="18"
            fill="none"
            className={bg.replace('bg-', 'stroke-')}
            strokeWidth="4"
            strokeDasharray={`${(score / 100) * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute text-xs font-bold ${color}`}>{score}</span>
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

function ExplanationSection({ title, content, color }: { title: string; content: string; color: string }) {
  return (
    <div>
      <div className={`text-xs font-medium ${color} mb-1`}>{title}</div>
      <p className="text-sm text-gray-400 leading-relaxed">{content}</p>
    </div>
  )
}
