'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Send, Loader2 } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

const MouseFloatButton = () => {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  })

  const [input, setInput] = useState('')
  const isLoading = status === 'streaming' || status === 'submitted'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleClick = () => {
    setIsChatOpen((prev) => !prev)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() !== '') {
        sendMessage({ text: input })
        setInput('')
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() !== '') {
      sendMessage({ text: input })
      setInput('')
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="チュー"
        className="fixed bottom-8 right-8 md:bottom-8 md:right-8 z-30 w-16 h-16 rounded-full bg-background border border-border shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center overflow-hidden ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Image
          src="/static/images/dots/chu_winter.png"
          alt="チュー"
          width={48}
          height={48}
          className="object-contain"
        />
      </button>

      <div
        className={`fixed bottom-24 right-8 md:bottom-24 md:right-8 z-30 w-80 md:w-96 h-96 bg-white dark:bg-zinc-800 rounded-lg shadow-2xl flex flex-col border border-gray-200 dark:border-zinc-700 transition-all duration-300 ease-in-out ${
          isChatOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Image
              src="/static/images/dots/chu_winter.png"
              alt=""
              width={24}
              height={24}
              className="object-contain rounded-full"
            />
          </div>
          <button
            onClick={handleClick}
            aria-label="Close Chat"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <p className="text-sm">（誰かいるみたいです...! 話かけてみましょう。）</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.parts
                      .filter((part) => part.type === 'text')
                      .map((part) => (part as { type: 'text'; text: string }).text)
                      .join('')}
                  </p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-lg px-4 py-2">
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    <span className="text-sm animate-dot-pulse">.</span>
                    <span className="text-sm animate-dot-pulse" style={{ animationDelay: '0.2s' }}>
                      .
                    </span>
                    <span className="text-sm animate-dot-pulse" style={{ animationDelay: '0.4s' }}>
                      .
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-700">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || input.trim() === ''}
              aria-label="Send Message"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default MouseFloatButton
