"use client"

import * as React from "react"
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  CalendarCheck2,
  CalendarClock,
  CalendarRange,
  Command,
  Inbox,
  LayoutDashboard,
  Ticket,
  Users,
  UserPlus,
  Store,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
    isActive?: boolean
  }[]
}

const data = {
  user: {
    name: "Farah A.",
    email: "farah@engage.local",
    avatar: "/avatars/farah.svg",
  },
  merchantSuccess: [
    {
      title: "Overview",
      url: "/merchant-success/overview",
      icon: LayoutDashboard,
    },
    {
      title: "Inboxes",
      url: "#",
      icon: Inbox,
      items: [
        {
          title: "WhatsApp",
          url: "/merchant-success/inboxes/whatsapp",
        },
        {
          title: "Email",
          url: "/merchant-success/inboxes/email",
        },
        {
          title: "Form",
          url: "/merchant-success/inboxes/form",
        },
      ],
    },
    {
      title: "Tickets",
      url: "/merchant-success/tickets",
      icon: Ticket,
    },
    {
      title: "Analytics",
      url: "/merchant-success/analytics",
      icon: BarChart3,
    },
    {
      title: "SLA Breaches",
      url: "/merchant-success/sla-breaches",
      icon: AlertTriangle,
    },
  ] satisfies NavItem[],
  sales: [
    {
      title: "Overview",
      url: "/sales/overview",
      icon: LayoutDashboard,
    },
    {
      title: "Inboxes",
      url: "#",
      icon: Inbox,
      items: [
        {
          title: "WhatsApp",
          url: "/sales/inboxes/whatsapp",
        },
        {
          title: "Form",
          url: "/sales/inboxes/form",
        },
      ],
    },
    {
      title: "Leads",
      url: "/sales/leads",
      icon: UserPlus,
    },
    {
      title: "Analytics",
      url: "/sales/analytics",
      icon: BarChart3,
    },
    {
      title: "Sales Appointment",
      url: "/sales/appointments",
      icon: CalendarCheck2,
    },
  ] satisfies NavItem[],
  renewalRetention: [
    {
      title: "Overview",
      url: "/renewal-retention/overview",
      icon: LayoutDashboard,
    },
    {
      title: "Inbox",
      url: "/renewal-retention/inbox",
      icon: Inbox,
    },
    {
      title: "Analytics",
      url: "/renewal-retention/analytics",
      icon: BarChart3,
    },
    {
      title: "Renewal Due",
      url: "/renewal-retention/renewal-due",
      icon: CalendarClock,
    },
  ] satisfies NavItem[],
  general: [
    {
      title: "Merchants",
      url: "/merchants",
      icon: Store,
    },
    {
      title: "Onboarding Appointment",
      url: "/onboarding-appointments",
      icon: CalendarRange,
    },
    {
      title: "Knowledge Base",
      url: "/knowledge-base",
      icon: BookOpen,
    },
    {
      title: "AI Chatbot Settings",
      url: "/ai-chatbot-settings",
      icon: Bot,
    },
    {
      title: "User Management",
      url: "/user-management",
      icon: Users,
    },
  ] satisfies NavItem[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  const markActive = React.useCallback(
    (items: NavItem[]) =>
      items.map((item) => {
        const subItems =
          item.items?.map((subItem) => ({
            ...subItem,
            isActive: pathname === subItem.url,
          })) ?? item.items
        const isActive =
          pathname === item.url ||
          Boolean(subItems?.some((subItem) => subItem.isActive))
        return {
          ...item,
          isActive,
          items: subItems,
        }
      }),
    [pathname]
  )

  const merchantItems = markActive(data.merchantSuccess)
  const salesItems = markActive(data.sales)
  const renewalItems = markActive(data.renewalRetention)
  const generalItems = markActive(data.general)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/merchant-success/overview">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Unified Engagement</span>
                  <span className="truncate text-xs">Merchant Ops</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Merchant Success" items={merchantItems} />
        <NavMain label="Sales" items={salesItems} />
        <NavMain label="Renewal & Retention" items={renewalItems} />
        <NavMain label="General" items={generalItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
