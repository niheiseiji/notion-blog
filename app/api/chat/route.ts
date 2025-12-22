import { createOpenAI } from '@ai-sdk/openai'
import { convertToCoreMessages, streamText } from 'ai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { allBlogs } from 'contentlayer/generated'
import { allCoreContent } from 'pliny/utils/contentlayer'

interface BlogPostInfo {
  id: string
  title: string
  summary?: string
}

function buildAllPostsInfo(): string {
  const corePosts = allCoreContent(allBlogs)
  const posts: BlogPostInfo[] = corePosts
    .filter((post) => !post.draft)
    .map((post) => ({
      id: post.slug,
      title: post.title,
      summary: post.summary || '',
    }))

  return posts
    .map((post) => {
      const summary = post.summary ? `\n  概要: ${post.summary}` : ''
      return `- ID: ${post.id}\n  タイトル: ${post.title}${summary}`
    })
    .join('\n\n')
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response('OPENAI_API_KEY is not set', { status: 500 })
  }

  const openai = createOpenAI({
    apiKey: apiKey,
  })

  const coreMessages = convertToCoreMessages(messages)

  const promptPath = join(process.cwd(), 'data', 'chu-prompt.md')
  let chuSystemPrompt = readFileSync(promptPath, 'utf-8').trim()

  const allPostsInfo = buildAllPostsInfo()
  chuSystemPrompt = chuSystemPrompt.replace('{{ALL_POSTS_INFO}}', allPostsInfo)

  const lastUserMessage = messages
    .filter((msg: { role: string }) => msg.role === 'user')
    .pop()?.content

  console.log('[DEBUG API] Last user message:', lastUserMessage)
  console.log('[DEBUG API] System prompt length:', chuSystemPrompt.length)
  console.log('[DEBUG API] System prompt (first 500 chars):', chuSystemPrompt.substring(0, 500))

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: coreMessages,
    system: chuSystemPrompt,
  })

  return result.toUIMessageStreamResponse()
}
