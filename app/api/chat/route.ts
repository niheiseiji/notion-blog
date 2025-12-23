import { createOpenAI } from '@ai-sdk/openai'
import { convertToCoreMessages, streamText } from 'ai'
import { allBlogs, allAuthors } from 'contentlayer/generated'
import { allCoreContent } from 'pliny/utils/contentlayer'
import chuPrompt from '../../../data/chu-prompt.md?raw'
import { buildPageMetaList } from '@/lib/navigation/pageMeta'

export const runtime = 'edge'

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

function buildAboutPageInfo(): string {
  const author = allAuthors.find((p) => p.slug === 'nihei-seiji')
  if (!author) {
    return ''
  }

  const info: string[] = []
  info.push(`名前: ${author.name}`)
  if (author.occupation) {
    info.push(`職業: ${author.occupation}`)
  }
  if (author.company) {
    info.push(`会社: ${author.company}`)
  }
  if (author.email) {
    info.push(`メール: ${author.email}`)
  }
  if (author.github) {
    info.push(`GitHub: ${author.github}`)
  }
  if (author.linkedin) {
    info.push(`LinkedIn: ${author.linkedin}`)
  }

  const bodyText = author.body.raw
    .replace(/^---[\s\S]*?---\n/, '')
    .replace(/import[^;]*;/g, '')
    .replace(/<FamiliarTechStack[^>]*\/>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .join('\n')
    .trim()

  info.push(`\n内容:\n${bodyText}`)

  return info.join('\n')
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
  const pageMetaList = buildPageMetaList()
  const allPostsInfo = buildAllPostsInfo()
  const aboutPageInfo = buildAboutPageInfo()
  let chuSystemPrompt = chuPrompt.replace('{{ALL_POSTS_INFO}}', allPostsInfo)
  chuSystemPrompt = chuSystemPrompt.replace('{{ABOUT_PAGE_INFO}}', aboutPageInfo)
  chuSystemPrompt = chuSystemPrompt.replace(
    '{{PAGE_META_JSON}}',
    JSON.stringify(pageMetaList, null, 2)
  )

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
