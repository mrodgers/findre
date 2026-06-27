import { useAppStore } from '../../store'
import { PropertyMap } from './PropertyMap'
import { ResultsSidebar } from '../PropertyCard/ResultsSidebar'
import { PropertyDetail } from '../PropertyCard/PropertyDetail'
import { ScoreWeightsPanel } from '../ScoreWeights/ScoreWeightsPanel'
import { ChatSidebar } from '../Onboarding/ChatSidebar'
import { MessageSquare, ListFilter } from 'lucide-react'

export function SearchView() {
  const session = useAppStore(s => s.session)
  const sidebarView = useAppStore(s => s.sidebarView)
  const setSidebarView = useAppStore(s => s.setSidebarView)
  const selectedProperty = useAppStore(s => s.selectedProperty)

  return (
    <div className="h-full flex">
      {/* Left sidebar */}
      <div className="w-96 flex flex-col border-r border-gray-800 bg-gray-900">
        {/* Sidebar tabs */}
        <div className="flex border-b border-gray-800">
          <TabBtn
            active={sidebarView === 'results'}
            onClick={() => setSidebarView('results')}
            icon={<ListFilter className="w-4 h-4" />}
            label={`Results${session.properties.length > 0 ? ` (${session.properties.length})` : ''}`}
          />
          <TabBtn
            active={sidebarView === 'chat'}
            onClick={() => setSidebarView('chat')}
            icon={<MessageSquare className="w-4 h-4" />}
            label="Refine"
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {sidebarView === 'results' ? (
            <ResultsSidebar />
          ) : (
            <ChatSidebar />
          )}
        </div>

        <ScoreWeightsPanel />
      </div>

      {/* Main content: map always visible, detail slides over it */}
      <div className="flex-1 relative overflow-hidden">
        <PropertyMap />
        {selectedProperty && (
          <div className="absolute top-0 right-0 h-full w-[440px] bg-gray-950 border-l border-gray-800 shadow-2xl z-[1000] overflow-hidden flex flex-col">
            <PropertyDetail />
          </div>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'text-white border-b-2 border-brand-500'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
