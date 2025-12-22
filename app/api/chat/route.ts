import { createOpenAI } from '@ai-sdk/openai'
import { convertToCoreMessages, streamText } from 'ai'
import { readFileSync } from 'fs'
import { join } from 'path'

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
  const chuSystemPrompt = readFileSync(promptPath, 'utf-8').trim()

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: coreMessages,
    system: chuSystemPrompt,
  })

  return result.toUIMessageStreamResponse()
}
