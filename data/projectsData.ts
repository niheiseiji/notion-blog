import { TechStack } from '@/components/techStack'
interface ProjectDataProps {
  title: string
  description: string
  imgSrc: string
  href: string
  techStack: TechStack[]
}

const projectsData: ProjectDataProps[] = [
  {
    title: 'Nihei Tech Blog',
    description:
      'このサイトです！Next.js 14 (App Router) と TypeScript で構築した個人テックブログ。Notionで記事を書いて自動で公開できる仕組みや、ブログ内に潜むAIネズミ「チュウ」との対話機能など、実験的な機能を実装中。技術的な知見やプロジェクトの進捗を発信しています。',
    href: 'https://niheiseiji.jp/',
    imgSrc: '/static/images/dots/chu_winter.png',
    techStack: ['NextJS', 'TypeScript', 'React', 'OpenAI'],
  },
]

export default projectsData
