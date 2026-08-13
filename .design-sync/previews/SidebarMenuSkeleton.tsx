import { SidebarMenu, SidebarMenuItem, SidebarMenuSkeleton } from "sims"

// NOTE: SidebarMenuSkeleton reads no sidebar context, so it renders standalone.
// It is previewed on the default surface rather than inside <Sidebar> because
// Skeleton's --accent (hsl(0 0% 96.1%)) is nearly identical to --sidebar
// (hsl(0 0% 96%)) — inside a real sidebar these bars are invisible. See
// .design-sync/NOTES.md.
export const MenuLoading = () => (
  <div className="w-[240px] rounded-md border p-2">
    <SidebarMenu>
      {[0, 1, 2, 3].map((i) => (
        <SidebarMenuItem key={i}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </div>
)

export const WithoutIcons = () => (
  <div className="w-[240px] rounded-md border p-2">
    <SidebarMenu>
      {[0, 1, 2].map((i) => (
        <SidebarMenuItem key={i}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </div>
)
