import { allBlogs } from 'contentlayer/generated'
import { allCoreContent } from 'pliny/utils/contentlayer'

export type PageMeta = {
  path: string
  title: string
  type: 'home' | 'blog' | 'project' | 'about'
}

export function buildPageMetaList(): PageMeta[] {
  const basePages: PageMeta[] = [
    { path: '/', title: 'Home', type: 'home' },
    { path: '/blog', title: 'Blog', type: 'blog' },
    { path: '/projects', title: 'Projects', type: 'project' },
    { path: '/about', title: 'About', type: 'about' },
  ]

  const blogPages: PageMeta[] = allCoreContent(allBlogs)
    .filter((post) => !post.draft)
    .map((post) => ({
      path: `/blog/${post.slug}`,
      title: post.title,
      type: 'blog' as const,
    }))

  return [...basePages, ...blogPages]
}
