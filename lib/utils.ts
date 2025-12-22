import type { Blog } from 'contentlayer/generated'

/**
 * sortフィールドの降順（大きい数字が先）でソート
 */
export function sortPostsBySort<T extends Pick<Blog, 'sort'>>(posts: T[]): T[] {
  return [...posts].sort((a, b) => (b.sort ?? 0) - (a.sort ?? 0))
}
