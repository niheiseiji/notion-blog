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
    title: 'Corgi-AI: Create anything with AI',
    description: 
      'Corgi AI is a collection of AI tools for different usecases. It includes a chatGPT clone with streaming responses, Image Generation, Audio Generation, Image Restoration and PDF Chat(beta). It is a full fledged SaaS application with stripe payments. It is Deployed using Docker with a VPS hosting on fly.io',
    href: 'https://corgi-ai.fly.dev',
    imgSrc: '/static/images/corgi-ai-dashboard.png',
    techStack: ['Svelte', 'TypeScript', 'PostgreSQL', 'Docker', 'Drizzle'],
  },
]

export default projectsData
