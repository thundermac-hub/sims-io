import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "sims"

// A leaf marker — only meaningful inside a Pagination row, so that's the
// composition the card shows.
export const InPagination = () => (
  <Pagination>
    <PaginationContent>
      <PaginationItem>
        <PaginationLink href="#">1</PaginationLink>
      </PaginationItem>
      <PaginationItem>
        <PaginationEllipsis />
      </PaginationItem>
      <PaginationItem>
        <PaginationLink href="#" isActive>
          9
        </PaginationLink>
      </PaginationItem>
    </PaginationContent>
  </Pagination>
)

export const Alone = () => (
  <div className="flex items-center gap-2 text-sm">
    <PaginationEllipsis />
    <span className="text-muted-foreground">skipped pages indicator</span>
  </div>
)
