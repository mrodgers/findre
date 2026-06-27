import { useEffect } from 'react'
import { useAppStore } from './store'
import { apiService } from './services/api'
import { Layout } from './components/Layout/Layout'

function App() {
  const setApiStatus = useAppStore(s => s.setApiStatus)

  useEffect(() => {
    apiService.getStatus()
      .then(setApiStatus)
      .catch(() => setApiStatus({
        ollama_available: false,
        zillow_configured: false,
        using_demo_data: true,
        quota_exhausted: false,
      }))
  }, [setApiStatus])

  return <Layout />
}

export default App
