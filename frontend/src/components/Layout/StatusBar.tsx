import { useAppStore } from '../../store'
import { Cpu, Database, MapPin, RotateCcw, BookOpen } from 'lucide-react'

const buildDate = new Date(__BUILD_TIME__)
const buildLabel = `v${__APP_VERSION__} · ${buildDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${__GIT_HASH__}`

export function StatusBar() {
  const apiStatus = useAppStore(s => s.apiStatus)
  const session = useAppStore(s => s.session)
  const resetSession = useAppStore(s => s.resetSession)

  return (
    <header className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-brand-400" />
        <span className="font-semibold text-white tracking-tight">FindRE</span>
        <span className="text-gray-500 text-xs ml-1">Real Estate Discovery</span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {apiStatus && (
          <>
            <StatusPill
              icon={<Cpu className="w-3 h-3" />}
              label={apiStatus.ollama_available ? (apiStatus.ollama_model ?? 'AI Ready') : 'AI Offline'}
              ok={apiStatus.ollama_available}
            />
            <StatusPill
              icon={<Database className="w-3 h-3" />}
              label={
                apiStatus.quota_exhausted
                  ? 'Quota Exhausted (Demo)'
                  : apiStatus.zillow_configured
                  ? 'Zillow Live'
                  : 'Demo Data'
              }
              ok={apiStatus.zillow_configured && !apiStatus.quota_exhausted}
              warn={apiStatus.quota_exhausted}
            />
          </>
        )}
        {session.properties.length > 0 && (
          <span className="text-gray-400">
            {session.properties.length} found
          </span>
        )}
        <span
          className="text-gray-600 text-xs font-mono hidden sm:block select-none"
          title={`Built ${buildDate.toISOString()}`}
        >
          {buildLabel}
        </span>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="User Guide"
        >
          <BookOpen className="w-3 h-3" />
          Help
        </a>
        {session.onboarding_complete && (
          <button
            onClick={resetSession}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Start a new search"
          >
            <RotateCcw className="w-3 h-3" />
            New Search
          </button>
        )}
      </div>
    </header>
  )
}

function StatusPill({ icon, label, ok, warn }: { icon: React.ReactNode; label: string; ok: boolean; warn?: boolean }) {
  const cls = warn
    ? 'bg-orange-950 text-orange-400'
    : ok
    ? 'bg-green-950 text-green-400'
    : 'bg-yellow-950 text-yellow-500'
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${cls}`}>
      {icon}
      <span>{label}</span>
    </div>
  )
}
