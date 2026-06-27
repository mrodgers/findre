import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useAppStore } from '../../store'
import { apiService } from '../../services/api'
import type { ChatMessage } from '../../types'

export function Onboarding() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const session = useAppStore(s => s.session)
  const apiStatus = useAppStore(s => s.apiStatus)
  const addChatMessage = useAppStore(s => s.addChatMessage)
  const setPreferences = useAppStore(s => s.setPreferences)
  const setSearchArea = useAppStore(s => s.setSearchArea)
  const setOnboardingComplete = useAppStore(s => s.setOnboardingComplete)
  const setSearching = useAppStore(s => s.setSearching)
  const setProperties = useAppStore(s => s.setProperties)
  const setApiStatus = useAppStore(s => s.setApiStatus)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.chat])

  const sendMessage = async (text?: string) => {
    const msg = text ?? input.trim()
    if (!msg || isLoading) return

    setInput('')
    addChatMessage({ role: 'user', content: msg })
    setIsLoading(true)

    try {
      const res = await apiService.chat(msg, session.id, session.preferences)
      addChatMessage({ role: 'assistant', content: res.message })

      if (res.preferences) setPreferences(res.preferences)
      if (res.search_area) setSearchArea(res.search_area)

      if (res.complete && res.preferences && res.search_area) {
        setOnboardingComplete(true)
        setSearching(true)

        const searchRes = await apiService.search(
          res.preferences,
          res.search_area,
          session.weights,
          session.id
        )

        setProperties(searchRes.properties)
        if (searchRes.quota_exhausted && apiStatus) {
          setApiStatus({ ...apiStatus, quota_exhausted: true, using_demo_data: true })
          addChatMessage({
            role: 'assistant',
            content: 'Monthly API quota exhausted — showing representative demo properties. Results will refresh next month when quota resets.',
          })
        }
        setSearching(false)
      }
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: 'I had trouble processing that. Could you try rephrasing?'
      })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const suggestions = [
    'Houses under $800k near San Diego with 3+ beds',
    'Best value homes within 25 miles of 92108',
    'Large lots near good schools, budget $1.2M',
    'Hidden gems in emerging neighborhoods, $600-900k',
  ]

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col h-full max-h-[calc(100vh-6rem)]">

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {session.chat.map((msg: ChatMessage) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="chat-bubble-agent">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick suggestions (shown when chat is just started) */}
        {session.chat.length <= 1 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-left text-xs p-2.5 border border-gray-700 rounded-lg text-gray-400 hover:border-brand-500 hover:text-brand-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 border border-gray-700 rounded-xl p-2 bg-gray-900 focus-within:border-brand-500 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Describe what you're looking for..."
            className="flex-1 bg-transparent outline-none text-gray-100 placeholder-gray-500 text-sm px-2"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-agent'}>
        <MarkdownText text={message.content} />
      </div>
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  // Simple markdown: bold, italic, bullets
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        const formatted = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-brand-400 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} />
            </div>
          )
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
      })}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
