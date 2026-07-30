import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>
}): Promise<Metadata> {
  const { projectId } = await params
  return { title: `Project #${projectId}` }
}

export default function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
