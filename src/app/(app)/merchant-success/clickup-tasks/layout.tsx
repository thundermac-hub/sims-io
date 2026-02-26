import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ClickUp Tasks",
}

export default function ClickupTasksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
