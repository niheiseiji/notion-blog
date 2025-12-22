import { allCoreContent } from 'pliny/utils/contentlayer'
import { allBlogs } from 'contentlayer/generated'
import Main from './Main'
import { sortPostsBySort } from '@/lib/utils'

export default async function Page() {
  const sortedPosts = sortPostsBySort(allBlogs)
  const posts = allCoreContent(sortedPosts)
  return <Main posts={posts} />
}
