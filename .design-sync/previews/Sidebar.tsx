import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarSeparator,
} from "sims"
import { Ticket, Store, Users, CalendarDays, Map } from "lucide-react"

export const AppNavigation = () => (
  <SidebarProvider>
    <Sidebar collapsible="none" className="h-[460px] border-r">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold">SIMS</div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Merchant success</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <Ticket />
                  Tickets
                </SidebarMenuButton>
                <SidebarMenuBadge>24</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Store />
                  Merchants
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sales</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Users />
                  Leads
                </SidebarMenuButton>
                <SidebarMenuBadge>7</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <CalendarDays />
                  Appointments
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Map />
                  Maps
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="text-muted-foreground px-2 py-1.5 text-xs">
          hafiz.hamidon
        </div>
      </SidebarFooter>
    </Sidebar>
  </SidebarProvider>
)
