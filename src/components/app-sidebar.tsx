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
  Inbox,
  LayoutDashboard,
  ListTree,
  Ticket,
  Users,
  UserPlus,
  Store,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import Image from "next/image"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { getSessionUser } from "@/lib/session"
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
      title: "Ticket Categories",
      url: "/ticket-categories",
      icon: ListTree,
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
  const [sessionUser, setSessionUserState] = React.useState(() => getSessionUser())

  React.useEffect(() => {
    const handleSessionUpdate = () => {
      setSessionUserState(getSessionUser())
    }
    handleSessionUpdate()
    window.addEventListener("storage", handleSessionUpdate)
    window.addEventListener("sims-session-update", handleSessionUpdate)
    return () => {
      window.removeEventListener("storage", handleSessionUpdate)
      window.removeEventListener("sims-session-update", handleSessionUpdate)
    }
  }, [])

  const userDepartment = sessionUser?.department ?? "Merchant Success"
  const isSuperAdmin = sessionUser?.role === "Super Admin"
  const isAdminOrHigher =
    sessionUser?.role === "Super Admin" || sessionUser?.role === "Admin"

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
  const generalItems = markActive(
    data.general.filter(
      (item) => item.title !== "User Management" || isAdminOrHigher
    )
  )

  const departmentItems = {
    "Merchant Success": merchantItems,
    "Sales & Marketing": salesItems,
    "Renewal & Retention": renewalItems,
  }

  const selectedDepartmentItems =
    departmentItems[
      userDepartment as keyof typeof departmentItems
    ] ?? merchantItems

  const allDepartmentGroups = [
    { label: "Merchant Success", items: merchantItems },
    { label: "Sales & Marketing", items: salesItems },
    { label: "Renewal & Retention", items: renewalItems },
  ]

  const visibleDepartments = isSuperAdmin
    ? allDepartmentGroups
    : departmentItems[userDepartment as keyof typeof departmentItems]
      ? [{ label: userDepartment, items: selectedDepartmentItems }]
      : []

  const homeHref =
    userDepartment === "Sales & Marketing"
      ? "/sales/overview"
      : userDepartment === "Renewal & Retention"
        ? "/renewal-retention/overview"
        : userDepartment === "Merchant Success"
          ? "/merchant-success/overview"
          : "/merchants"

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={homeHref}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Image
                    src="/system-logo-v2.png"
                    alt="Unified Engagement"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                    priority
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Unified Engagement</span>
                  <span className="truncate text-xs">{userDepartment}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {visibleDepartments.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
        <NavMain label="General" items={generalItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: sessionUser?.name ?? "User",
            email: sessionUser?.email ?? "user@workspace.local",
            avatar: sessionUser?.avatarUrl ?? null,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
