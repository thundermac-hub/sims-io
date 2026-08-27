import type { Metadata } from "next"

import { resolveAppBaseUrl } from "@/lib/auth"

/**
 * Open Graph tags so the survey link renders as a rich preview in chat rather than as
 * a bare URL. WhatsApp fetches the link to build the card, which is safe here: `GET
 * /api/csat/[token]` only reads the token — `used_at` is stamped in the POST handler
 * when the survey is actually submitted — so a preview crawl cannot burn a merchant's
 * single-use link.
 *
 * The copy is deliberately generic and identical for every token. The card is rendered
 * by WhatsApp's servers and shown in the merchant's chat, so putting the merchant or
 * ticket in it would leak ticket detail into a preview for no gain — and generic tags
 * mean no per-token metadata to generate.
 *
 * `generateMetadata` rather than a static export so the absolute image URL is resolved
 * from `APP_BASE_URL` per request. Absolute is required: crawlers cannot follow a
 * relative OG image, and a wrong host yields a card with a broken thumbnail.
 */
export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = resolveAppBaseUrl().replace(/\/+$/, "")

  return {
    title: "CSAT Survey",
    description: "Tell us how our Merchant Success team did. It takes less than a minute.",
    openGraph: {
      type: "website",
      siteName: "Slurp!",
      title: "How did we do?",
      description:
        "Tell us how our Merchant Success team did. It takes less than a minute.",
      images: [
        {
          url: `${baseUrl}/system-logo-v2.png`,
          width: 1024,
          height: 1024,
          alt: "Slurp!",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: "How did we do?",
      description:
        "Tell us how our Merchant Success team did. It takes less than a minute.",
      images: [`${baseUrl}/system-logo-v2.png`],
    },
  }
}

export default function CsatTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
