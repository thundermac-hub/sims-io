import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Merchant Success Audit Trail",
}

export default function MerchantSuccessAuditTrailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
