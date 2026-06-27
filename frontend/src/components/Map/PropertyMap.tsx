import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { useAppStore } from '../../store'
import type { Property } from '../../types'
import L from 'leaflet'

const categoryColors = {
  exact: '#22c55e',
  derivative: '#3b82f6',
  opportunity: '#f59e0b',
  stretch: '#ef4444',
}

function createMarkerIcon(category: Property['category'], selected: boolean) {
  const color = categoryColors[category]
  const size = selected ? 16 : 12
  return L.divIcon({
    className: '',
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:50%;
      border:2px solid ${selected ? 'white' : 'rgba(255,255,255,0.4)'};
      box-shadow:0 0 ${selected ? '8' : '4'}px ${color}80;
      transition:all 0.2s;
    "></div>`,
  })
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center[0], center[1], zoom])
  return null
}

export function PropertyMap() {
  const session = useAppStore(s => s.session)
  const selectedProperty = useAppStore(s => s.selectedProperty)
  const selectProperty = useAppStore(s => s.selectProperty)
  const activeCategory = useAppStore(s => s.activeCategory)
  const propertyTypeFilter = useAppStore(s => s.propertyTypeFilter)

  const searchArea = session.search_area
  const defaultCenter: [number, number] = [32.7157, -117.1611] // San Diego default

  const center: [number, number] = searchArea
    ? [searchArea.center_lat, searchArea.center_lng]
    : defaultCenter

  const radiusMeters = (searchArea?.radius_miles ?? 10) * 1609.34

  const visibleProperties = session.properties.filter(p =>
    (activeCategory === 'all' || p.category === activeCategory) &&
    (propertyTypeFilter === 'all' || p.property_type === propertyTypeFilter)
  )

  return (
    <div className="h-full relative">
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {searchArea && (
          <>
            <MapUpdater center={center} zoom={getZoomForRadius(searchArea.radius_miles)} />
            <Circle
              center={center}
              radius={radiusMeters}
              pathOptions={{
                color: '#0ba5e9',
                fillColor: '#0ba5e9',
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '6 4',
              }}
            />
          </>
        )}

        {visibleProperties.map(prop => (
          <Marker
            key={prop.id}
            position={[prop.latitude, prop.longitude]}
            icon={createMarkerIcon(prop.category, selectedProperty?.id === prop.id)}
            eventHandlers={{
              click: () => selectProperty(prop),
            }}
          >
            <Popup className="property-popup">
              <div className="text-gray-900 min-w-48">
                <div className="font-semibold text-sm">{prop.address}</div>
                <div className="text-gray-600 text-xs">{prop.city}, {prop.state}</div>
                <div className="mt-1 flex justify-between">
                  <span className="font-bold text-gray-900">${prop.price.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">{prop.beds}bd/{prop.baths}ba</span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  <ScoreBadge score={prop.scores.composite} />
                  <CategoryBadge category={prop.category} />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg p-3 text-xs space-y-1.5">
        {([
          ['exact', 'Exact Match'],
          ['derivative', 'Related Find'],
          ['opportunity', 'Hidden Gem'],
          ['stretch', 'Over Budget'],
        ] as const).map(([cat, label]) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[cat] }} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {session.is_searching && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-6 py-4 text-center">
            <div className="text-brand-400 font-medium">Searching properties...</div>
            <div className="text-gray-500 text-sm mt-1">AI agents are analyzing the market</div>
          </div>
        </div>
      )}
    </div>
  )
}

function getZoomForRadius(miles: number): number {
  if (miles <= 1) return 14
  if (miles <= 5) return 12
  if (miles <= 10) return 11
  if (miles <= 25) return 10
  return 9
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 55 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>{score}pts</span>
}

function CategoryBadge({ category }: { category: Property['category'] }) {
  const styles = {
    exact: 'bg-green-100 text-green-800',
    derivative: 'bg-blue-100 text-blue-800',
    opportunity: 'bg-amber-100 text-amber-800',
    stretch: 'bg-red-100 text-red-800',
  }
  const labels = {
    exact: 'Exact Match',
    derivative: 'Related',
    opportunity: 'Hidden Gem',
    stretch: 'Over Budget',
  }
  return <span className={`px-1.5 py-0.5 rounded text-xs ${styles[category]}`}>{labels[category]}</span>
}
