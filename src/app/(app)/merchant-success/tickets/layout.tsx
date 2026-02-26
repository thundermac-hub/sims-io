import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Merchant Success Tickets",
}

export default function MerchantSuccessTicketsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
