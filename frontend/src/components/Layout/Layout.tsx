import { useAppStore } from '../../store'
import { Onboarding } from '../Onboarding/Onboarding'
import { SearchView } from '../Map/SearchView'
import { StatusBar } from './StatusBar'

export function Layout() {
  const onboardingComplete = useAppStore(s => s.session.onboarding_complete)

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <StatusBar />
      <main className="flex-1 overflow-hidden">
        {!onboardingComplete ? <Onboarding /> : <SearchView />}
      </main>
    </div>
  )
}
