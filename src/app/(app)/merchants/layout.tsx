import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Merchants",
}

export default function MerchantsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
