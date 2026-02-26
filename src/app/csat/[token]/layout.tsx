import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "CSAT Survey",
}

export default function CsatTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
