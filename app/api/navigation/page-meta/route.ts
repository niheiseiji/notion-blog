import { NextResponse } from 'next/server'
import { buildPageMetaList } from '@/lib/navigation/pageMeta'

export const runtime = 'edge'

export async function GET() {
  const pageMetaList = buildPageMetaList()
  return NextResponse.json(pageMetaList)
}
