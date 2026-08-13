import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "sims"

// BreadcrumbEllipsis is a leaf marker — it only reads correctly inside a
// Breadcrumb, so the preview is the full composition it belongs to.
export const InBreadcrumb = () => (
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="#">Merchants</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbEllipsis />
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>Outlet detail</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
)

export const Alone = () => (
  <div className="flex items-center gap-2 text-sm">
    <BreadcrumbEllipsis />
    <span className="text-muted-foreground">
      collapsed crumbs indicator
    </span>
  </div>
)
