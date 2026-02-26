export const KB_AUDIENCE_EXTERNAL_USER = "External User" as const

export const KB_CATEGORIES = [
  "Getting Started",
  "Tickets",
  "Merchants",
  "Renewals",
  "CSAT",
  "Profile",
  "Troubleshooting",
] as const

export const KB_STATUSES = [
  "Draft",
  "Ready for Review",
  "Approved",
  "Published",
] as const

export type KbCategory = (typeof KB_CATEGORIES)[number]
export type KbStatus = (typeof KB_STATUSES)[number]

export type KbNotionArticle = {
  title: string
  audience: typeof KB_AUDIENCE_EXTERNAL_USER
  category: KbCategory
  featureArea: string[]
  status: KbStatus
  appVersion: string
  lastVerifiedDate: string
  sourceRefs: string[]
  owner: string
}

export type KbPublishedArticle = {
  slug: string
  title: string
  summary: string
  category: string
  bodyMarkdown: string
  lastVerifiedDate: string
  versionTag: string
  relatedArticles: string[]
}

type PublishValidationResult = {
  canPublish: boolean
  reasons: string[]
}

export function validatePublishableArticle(
  article: KbNotionArticle
): PublishValidationResult {
  const reasons: string[] = []

  if (article.status !== "Approved") {
    reasons.push("Only Approved articles can be published.")
  }

  if (!article.sourceRefs.length) {
    reasons.push("At least one source reference is required.")
  }

  if (!article.lastVerifiedDate) {
    reasons.push("Last verified date is required.")
  }

  return {
    canPublish: reasons.length === 0,
    reasons,
  }
}

export const kbCategoryArticleCounts: Record<KbCategory, number> = {
  "Getting Started": 6,
  Tickets: 14,
  Merchants: 9,
  Renewals: 8,
  CSAT: 5,
  Profile: 4,
  Troubleshooting: 11,
}

export const kbPublishedArticles: KbPublishedArticle[] = [
  {
    slug: "create-and-track-tickets",
    title: "Create and Track Tickets",
    summary: "How to open, assign, and resolve tickets in the support workflow.",
    category: "Tickets",
    bodyMarkdown:
      "### Who this is for\nSupport agents handling inbound merchant requests.",
    lastVerifiedDate: "2026-02-24",
    versionTag: "v1.0.1",
    relatedArticles: ["ticket-statuses-explained", "csat-after-resolution"],
  },
  {
    slug: "merchant-record-linking",
    title: "Linking Messages to Merchant Records",
    summary: "Resolve merchant conversations against the correct FID/OID.",
    category: "Merchants",
    bodyMarkdown:
      "### Who this is for\nUsers who need to identify outlets during ticket triage.",
    lastVerifiedDate: "2026-02-24",
    versionTag: "v1.0.1",
    relatedArticles: ["create-and-track-tickets"],
  },
]
