"use client"

import * as React from "react"
import { format } from "date-fns"

import { formatDateTime } from "@/lib/dates"
import { getSessionUser } from "@/lib/session"
import { DateRangePicker, type DateRangeValue } from "@/components/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type TicketRow = {
  id: string
  customerName: string | null
  customerPhone: string | null
  franchiseName: string | null
  outletName: string | null
  fid: string | null
  oid: string | null
  status: string
  category: string | null
  subcategory1: string | null
  subcategory2: string | null
  createdAt: string
  lastMessageAt: string | null
  msAgentName: string | null
}

const statusOptions = [
  "new",
  "open",
  "pending_merchant",
  "pending_internal",
  "resolved",
  "closed",
]

const formatStatusLabel = (value: string) => {
  const label = value.replace(/_/g, " ")
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : value
}

const perPageOptions = [10, 25, 50, 100]
const dateFilterCookie = "tickets_date_filter"

function getPaginationItems(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, 4, "ellipsis", total]
  }

  if (current >= total - 2) {
    return [1, "ellipsis", total - 3, total - 2, total - 1, total]
  }

  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total]
}

function parseCookieValue(value: string | null): DateRangeValue {
  if (!value) {
    return { start: null, end: null }
  }

  try {
    const decoded = decodeURIComponent(value)
    const parsed = JSON.parse(decoded) as { start?: string; end?: string }
    const start = parseDateInput(parsed.start ?? null)
    const end = parseDateInput(parsed.end ?? null)
    return { start, end }
  } catch {
    return { start: null, end: null }
  }
}

function parseDateInput(value: string | null) {
  if (!value) {
    return null
  }
  const [year, month, day] = value.split("-").map((part) => Number(part))
  if (!year || !month || !day) {
    return null
  }
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.valueOf()) ? null : date
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null
  }
  const prefix = `${name}=`
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))
  return value ? value.slice(prefix.length) : null
}

function setCookieValue(name: string, value: string | null) {
  if (typeof document === "undefined") {
    return
  }
  if (!value) {
    document.cookie = `${name}=; Max-Age=0; Path=/`
    return
  }
  const maxAgeSeconds = 60 * 60 * 12
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/`
}

export default function MerchantSuccessTicketsPage() {
  const [tickets, setTickets] = React.useState<TicketRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchInput, setSearchInput] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateRange, setDateRange] = React.useState<DateRangeValue>(() =>
    parseCookieValue(getCookieValue(dateFilterCookie))
  )
  const [page, setPage] = React.useState(1)
  const [perPage, setPerPage] = React.useState(25)
  const [total, setTotal] = React.useState(0)

  const { startDate, endDate } = React.useMemo(() => {
    if (!dateRange.start) {
      return { startDate: "", endDate: "" }
    }
    const start = format(dateRange.start, "yyyy-MM-dd")
    const end = dateRange.end ? format(dateRange.end, "yyyy-MM-dd") : start
    return { startDate: start, endDate: end }
  }, [dateRange.end, dateRange.start])

  React.useEffect(() => {
    if (!dateRange.start && !dateRange.end) {
      setCookieValue(dateFilterCookie, null)
      return
    }
    const payload = encodeURIComponent(
      JSON.stringify({
        start: dateRange.start ? format(dateRange.start, "yyyy-MM-dd") : null,
        end: dateRange.end ? format(dateRange.end, "yyyy-MM-dd") : null,
      })
    )
    setCookieValue(dateFilterCookie, payload)
  }, [dateRange.end, dateRange.start])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const paginationItems = React.useMemo(
    () => getPaginationItems(page, totalPages),
    [page, totalPages]
  )

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  React.useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, startDate, endDate, perPage])

  const loadTickets = React.useCallback(async () => {
    const user = getSessionUser()
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) {
        params.set("q", searchQuery)
      }
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter)
      }
      if (startDate) {
        params.set("start_date", startDate)
      }
      if (endDate) {
        params.set("end_date", endDate)
      }
      params.set("page", String(page))
      params.set("per_page", String(perPage))

      const response = await fetch(`/api/tickets?${params.toString()}`, {
        headers: { "x-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error("Unable to load tickets.")
      }
      const data = (await response.json()) as {
        tickets: TicketRow[]
        total: number
      }
      setTickets(data.tickets ?? [])
      setTotal(data.total ?? 0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, startDate, endDate, page, perPage])

  React.useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) {
      return
    }
    setPage(nextPage)
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merchant Success Tickets
        </h1>
        <p className="text-muted-foreground text-sm">
          Review tickets across channels with date and status filters.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Tickets overview</CardTitle>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <Input
                placeholder="Search customer, outlet, FID, OID"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[170px] text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                className="w-[240px]"
              />
              <Select
                value={String(perPage)}
                onValueChange={(value) => setPerPage(Number(value))}
              >
                <SelectTrigger className="h-9 w-[120px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {perPageOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-muted-foreground text-sm">
              Loading tickets...
            </div>
          ) : tickets.length ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Franchise</th>
                      <th className="px-4 py-3">Outlet</th>
                      <th className="px-4 py-3">FID / OID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">MS Agent</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket, index) => (
                      <tr
                        key={ticket.id}
                        className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                      >
                        <td className="px-4 py-3 font-medium">{ticket.id}</td>
                        <td className="px-4 py-3">
                          <div>{ticket.customerName ?? "--"}</div>
                          <div className="text-xs text-muted-foreground">
                            {ticket.customerPhone ?? "No phone"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ticket.franchiseName ?? "--"}
                        </td>
                        <td className="px-4 py-3">{ticket.outletName ?? "--"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {ticket.fid ? `FID ${ticket.fid}` : "FID --"}
                          <br />
                          {ticket.oid ? `OID ${ticket.oid}` : "OID --"}
                        </td>
                        <td className="px-4 py-3">
                          {formatStatusLabel(ticket.status)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>{ticket.category ?? "--"}</div>
                          <div className="text-muted-foreground">
                            {ticket.subcategory1 ?? "--"}
                            {ticket.subcategory2
                              ? ` · ${ticket.subcategory2}`
                              : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ticket.msAgentName ?? "--"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDateTime(ticket.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 ? (
                <div className="flex flex-col gap-3 pt-2">
                  <Separator />
                  <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground md:flex-row">
                    <span>
                      Page {page} of {totalPages} · {total} records
                    </span>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            aria-disabled={page === 1}
                            tabIndex={page === 1 ? -1 : undefined}
                            className={
                              page === 1
                                ? "pointer-events-none opacity-50"
                                : undefined
                            }
                            onClick={(event) => {
                              event.preventDefault()
                              handlePageChange(page - 1)
                            }}
                          />
                        </PaginationItem>
                        {paginationItems.map((item, index) => (
                          <PaginationItem key={`${item}-${index}`}>
                            {item === "ellipsis" ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                href="#"
                                isActive={item === page}
                                onClick={(event) => {
                                  event.preventDefault()
                                  handlePageChange(item as number)
                                }}
                              >
                                {item}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            aria-disabled={page === totalPages}
                            tabIndex={page === totalPages ? -1 : undefined}
                            className={
                              page === totalPages
                                ? "pointer-events-none opacity-50"
                                : undefined
                            }
                            onClick={(event) => {
                              event.preventDefault()
                              handlePageChange(page + 1)
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              No tickets match the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
