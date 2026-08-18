import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ contactId: string }>
}): Promise<Metadata> {
  const { contactId } = await params
  return { title: `Contact #${contactId}` }
}

export default function ContactDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
