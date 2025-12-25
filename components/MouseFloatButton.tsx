'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Send } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRouter } from 'next/navigation'
import type { PageMeta } from '@/lib/navigation/pageMeta'

function renderMarkdown(text: string): (string | JSX.Element)[] {
  const lines = text.split('\n')
  const result: (string | JSX.Element)[] = []
  let keyIndex = 0
  let inList = false
  let listItems: string[] = []

  const processInlineMarkdown = (line: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let match

    const boldRegex = /\*\*([^*]+)\*\*/g
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

    const allMatches: Array<{
      index: number
      length: number
      type: 'bold' | 'link'
      data: RegExpExecArray
    }> = []

    while ((match = boldRegex.exec(line)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'bold',
        data: match,
      })
    }

    while ((match = linkRegex.exec(line)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'link',
        data: match,
      })
    }

    allMatches.sort((a, b) => a.index - b.index)

    allMatches.forEach((matchInfo) => {
      if (matchInfo.index > lastIndex) {
        parts.push(line.substring(lastIndex, matchInfo.index))
      }

      if (matchInfo.type === 'bold') {
        parts.push(
          <strong key={`bold-${keyIndex++}`} className="font-semibold">
            {matchInfo.data[1]}
          </strong>
        )
      } else if (matchInfo.type === 'link') {
        parts.push(
          <a
            key={`link-${keyIndex++}`}
            href={matchInfo.data[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {matchInfo.data[1]}
          </a>
        )
      }

      lastIndex = matchInfo.index + matchInfo.length
    })

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex))
    }

    return parts.length > 0 ? parts : [line]
  }

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim()
    const isListItem = trimmedLine.startsWith('- ')

    if (isListItem) {
      if (!inList) {
        inList = true
        listItems = []
      }
      const itemText = trimmedLine.substring(2)
      listItems.push(itemText)
    } else {
      if (inList && listItems.length > 0) {
        result.push(
          <ul
            key={`list-${keyIndex++}`}
            className="list-disc list-inside space-y-0.5 my-1 ml-2 text-sm"
          >
            {listItems.map((item, idx) => (
              <li key={idx}>{processInlineMarkdown(item)}</li>
            ))}
          </ul>
        )
        listItems = []
        inList = false
      }

      if (trimmedLine.length > 0) {
        result.push(
          <div key={`line-${keyIndex++}`} className="my-1">
            {processInlineMarkdown(trimmedLine)}
          </div>
        )
      }
    }
  })

  if (inList && listItems.length > 0) {
    result.push(
      <ul
        key={`list-${keyIndex++}`}
        className="list-disc list-inside space-y-0.5 my-1 ml-2 text-sm"
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{processInlineMarkdown(item)}</li>
        ))}
      </ul>
    )
  }

  return result.length > 0 ? result : [text]
}

const CHAT_STORAGE_KEY = 'chu-chat-messages'

const MouseFloatButton = () => {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [pageMetaList, setPageMetaList] = useState<PageMeta[]>([])
  const [lastHandledMessageId, setLastHandledMessageId] = useState<string | null>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  })
  const router = useRouter()

  useEffect(() => {
    const loadPageMetaList = async () => {
      try {
        const response = await fetch('/api/navigation/page-meta')
        if (!response.ok) {
          return
        }
        const data = (await response.json()) as PageMeta[]
        setPageMetaList(data)
      } catch {
        // ignore
      }
    }
    loadPageMetaList()
  }, [])

  useEffect(() => {
    if (!isInitialized) {
      const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY)
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed)
          }
        } catch (e) {
          console.error('Failed to parse saved messages:', e)
        }
      }
      setIsInitialized(true)
    }
  }, [isInitialized, setMessages])

  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages, isInitialized])

  const [input, setInput] = useState('')
  const isLoading = status === 'streaming' || status === 'submitted'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  useEffect(() => {
    if (pageMetaList.length === 0) {
      return
    }
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant')
    if (!lastAssistantMessage || lastAssistantMessage.id === lastHandledMessageId) {
      return
    }
    const textParts = lastAssistantMessage.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { type: 'text'; text: string }).text)
    const fullText = textParts.join('')
    const navigationRegex = /<NAVIGATION>\s*([\s\S]*?)\s*<\/NAVIGATION>/g
    const match = navigationRegex.exec(fullText)
    if (match) {
      try {
        const jsonText = match[1].trim()
        const parsed = JSON.parse(jsonText) as {
          action: string
          path?: string
          reason?: string
        }
        if (parsed.action === 'navigate' && parsed.path) {
          const targetPage = pageMetaList.find((page) => page.path === parsed.path)
          if (targetPage) {
            router.push(parsed.path)
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    setLastHandledMessageId(lastAssistantMessage.id)
  }, [messages, pageMetaList, lastHandledMessageId, router])

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
            <span className="font-medium text-gray-900 dark:text-white">???</span>
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
                  <div className="text-sm">
                    {(() => {
                      const textParts = message.parts
                        .filter((part) => part.type === 'text')
                        .map((part) => (part as { type: 'text'; text: string }).text)

                      const fullText = textParts.join('')

                      const parts: (string | JSX.Element)[] = []
                      let lastIndex = 0

                      const navigationRegex = /<NAVIGATION>\s*([\s\S]*?)\s*<\/NAVIGATION>/g
                      const navigationMatches: RegExpExecArray[] = []
                      let match

                      while ((match = navigationRegex.exec(fullText)) !== null) {
                        navigationMatches.push(match)
                      }

                      const relatedPostsRegex = /<RELATED_POSTS>\s*([\s\S]*?)\s*<\/RELATED_POSTS>/g
                      const relatedPostsMatches: RegExpExecArray[] = []
                      while ((match = relatedPostsRegex.exec(fullText)) !== null) {
                        relatedPostsMatches.push(match)
                      }

                      const allMatches = [...navigationMatches, ...relatedPostsMatches].sort(
                        (a, b) => a.index - b.index
                      )

                      allMatches.forEach((match, matchIndex) => {
                        if (match.index > lastIndex) {
                          const beforeText = fullText.substring(lastIndex, match.index)
                          parts.push(...renderMarkdown(beforeText))
                        }

                        if (match[0].includes('<NAVIGATION>')) {
                          try {
                            const jsonText = match[1].trim()
                            const jsonData = JSON.parse(jsonText) as {
                              action: string
                              path?: string
                              reason?: string
                            }
                            if (jsonData.action === 'navigate' && jsonData.path) {
                              const targetPage = pageMetaList.find(
                                (page) => page.path === jsonData.path
                              )
                              if (targetPage) {
                                parts.push(
                                  <div
                                    key={`nav-${matchIndex}`}
                                    className="mt-3 pt-3 border-t border-gray-300 dark:border-zinc-600"
                                  >
                                    <a
                                      href={jsonData.path}
                                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                      {targetPage.title} へ移動 →
                                    </a>
                                  </div>
                                )
                              }
                            }
                          } catch {
                            // ignore parse errors
                          }
                        } else if (match[0].includes('<RELATED_POSTS>')) {
                          try {
                            let jsonText = match[1].trim()
                            jsonText = jsonText.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ')
                            const jsonData = JSON.parse(jsonText)
                            if (
                              jsonData.posts &&
                              Array.isArray(jsonData.posts) &&
                              jsonData.posts.length > 0
                            ) {
                              parts.push(
                                <div
                                  key={`related-${matchIndex}`}
                                  className="mt-4 pt-4 border-t border-gray-300 dark:border-zinc-600"
                                >
                                  <div className="font-semibold mb-2">関連記事:</div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {jsonData.posts
                                      .map((post: { id?: string; title?: string }, idx: number) => {
                                        if (!post.id || !post.title) {
                                          return null
                                        }
                                        const url = `/blog/${post.id}`
                                        return (
                                          <li key={idx}>
                                            <a
                                              href={url}
                                              className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                              {post.title}
                                            </a>
                                          </li>
                                        )
                                      })
                                      .filter(Boolean)}
                                  </ul>
                                </div>
                              )
                            }
                          } catch {
                            // ignore parse errors
                          }
                        }

                        lastIndex = match.index + match[0].length
                      })

                      if (lastIndex < fullText.length) {
                        const remainingText = fullText.substring(lastIndex)
                        parts.push(...renderMarkdown(remainingText))
                      }

                      return parts.length > 0 ? (
                        <div>{parts}</div>
                      ) : (
                        <div>{renderMarkdown(fullText)}</div>
                      )
                    })()}
                  </div>
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
