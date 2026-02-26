import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Support Form",
}

export default function SupportFormLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
