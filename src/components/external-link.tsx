import * as React from "react"
import { SquareArrowOutUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

type ExternalLinkProps = React.ComponentProps<"a">

export function ExternalLink({
  className,
  children,
  ...props
}: ExternalLinkProps) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-start gap-1 text-primary hover:underline",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <SquareArrowOutUpRight className="mt-0.5 h-3 w-3" aria-hidden="true" />
    </a>
  )
}
