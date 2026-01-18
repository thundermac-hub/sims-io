import { AppAuthGate } from "@/components/app-auth-gate"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { ToastProvider } from "@/components/toast-provider"
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppAuthGate>
      <ToastProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarRail />
          <SidebarInset className="bg-background/85 backdrop-blur">
            <AppHeader />
            <div className="flex flex-1 flex-col gap-6 px-4 py-6 md:px-6">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ToastProvider>
    </AppAuthGate>
  )
}
