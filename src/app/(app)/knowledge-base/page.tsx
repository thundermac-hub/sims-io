import { BookOpen } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const categories = [
  { title: "Payments", articles: 18 },
  { title: "POS Sync", articles: 12 },
  { title: "WhatsApp Templates", articles: 9 },
  { title: "Onboarding", articles: 15 },
]

export default function KnowledgeBasePage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm">
          Search internal playbooks and canned responses.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Search articles</CardTitle>
          <Input placeholder="Search by topic or keyword" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <div
              key={category.title}
              className="rounded-xl border px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="text-muted-foreground size-4" />
                <span className="text-sm font-semibold">{category.title}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                {category.articles} articles
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
