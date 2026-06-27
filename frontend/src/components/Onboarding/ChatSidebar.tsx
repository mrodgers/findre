import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useAppStore } from '../../store'
import { apiService } from '../../services/api'
import type { ChatMessage } from '../../types'

export function ChatSidebar() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const session = useAppStore(s => s.session)
  const apiStatus = useAppStore(s => s.apiStatus)
  const addChatMessage = useAppStore(s => s.addChatMessage)
  const setPreferences = useAppStore(s => s.setPreferences)
  const setSearchArea = useAppStore(s => s.setSearchArea)
  const setSearching = useAppStore(s => s.setSearching)
  const setProperties = useAppStore(s => s.setProperties)
  const setApiStatus = useAppStore(s => s.setApiStatus)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.chat])

  const sendMessage = async () => {
    const msg = input.trim()
    if (!msg || isLoading) return

    setInput('')
    addChatMessage({ role: 'user', content: msg })
    setIsLoading(true)

    try {
      const res = await apiService.chat(msg, session.id, session.preferences)
      addChatMessage({ role: 'assistant', content: res.message })

      if (res.preferences) setPreferences(res.preferences)
      if (res.search_area) setSearchArea(res.search_area)

      // In refinement mode: re-search if we already have context, even if complete=false
      const prefs = res.preferences || session.preferences
      const area = res.search_area || session.search_area
      const hasContext = !!(prefs?.budget_max && area)

      if ((res.complete || hasContext) && prefs && area) {
        setSearching(true)
        const searchRes = await apiService.search(prefs, area, session.weights, session.id)
        setProperties(searchRes.properties)
        if (searchRes.quota_exhausted && apiStatus) {
          setApiStatus({ ...apiStatus, quota_exhausted: true, using_demo_data: true })
          addChatMessage({
            role: 'assistant',
            content: 'Monthly API quota exhausted — showing representative demo properties.',
          })
        }
        setSearching(false)
      }
    } catch {
      addChatMessage({ role: 'assistant', content: 'Could not process that. Try again?' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {session.chat.map((msg: ChatMessage) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`text-xs rounded-xl px-3 py-2 max-w-[85%] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-300'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-xl px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-2 border-t border-gray-800">
        <div className="flex gap-1.5 bg-gray-800 rounded-lg p-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Refine your search..."
            className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 px-1"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
