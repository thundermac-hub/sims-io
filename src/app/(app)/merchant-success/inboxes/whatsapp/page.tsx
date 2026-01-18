"use client"

import * as React from "react"
import { Mail, Phone, Send } from "lucide-react"

import { formatDateTime, parseDate } from "@/lib/dates"
import { getSessionUser } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

type Conversation = {
  id: string
  contactNumber: string
  contactName: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  ticket: {
    id: string
    status: string | null
    category: string | null
    subcategory1: string | null
    fid: string | null
    oid: string | null
  } | null
}

type Message = {
  id: string
  direction: "inbound" | "outbound"
  body: string
  createdAt: string
}

type TicketDetails = {
  id: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  franchise_name: string | null
  outlet_name: string | null
  fid: string | null
  oid: string | null
  ms_agent_id: string | null
  ms_agent_name: string | null
  category: string | null
  subcategory_1: string | null
  subcategory_2: string | null
  issue_description: string | null
  internal_notes: string | null
  csat_link: string | null
  csat_score: number | null
  csat_response: string | null
}

type TicketDraft = {
  customerName: string
  customerPhone: string
  franchiseName: string
  outletName: string
  fid: string
  oid: string
  msAgentName: string
  status: string
  category: string
  subcategory1: string
  subcategory2: string
  issueDescription: string
  internalNotes: string
  csatLink: string
  csatScore: string
  csatResponse: string
}

type MerchantOption = {
  id: string
  name: string
  fid: string | null
  externalId: string
  company: string | null
}

type OutletOption = {
  id: string
  name: string
  externalId: string
}

type AgentOption = {
  id: string
  name: string
  email: string
}

type CategoryOption = {
  id: string
  name: string
  sortOrder: number
  subcategories: CategoryOption[]
}

const TICKET_STATUSES = [
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

const matchesQuery = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase())

function formatRelativeTime(value: string | null, now: number) {
  if (!value) {
    return "--"
  }
  const parsed = parseDate(value)
  if (!parsed) {
    return "--"
  }
  const diffMs = now - parsed.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) {
    return "now"
  }
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function MerchantSuccessWhatsAppInboxPage() {
  const [conversations, setConversations] = React.useState<Conversation[]>([])
  const [messages, setMessages] = React.useState<Message[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [loadingConversations, setLoadingConversations] = React.useState(true)
  const [loadingMessages, setLoadingMessages] = React.useState(false)
  const [ticketDetails, setTicketDetails] = React.useState<TicketDetails | null>(
    null
  )
  const [ticketDraft, setTicketDraft] = React.useState<TicketDraft | null>(null)
  const [loadingTicket, setLoadingTicket] = React.useState(false)
  const [ticketSaving, setTicketSaving] = React.useState(false)
  const [ticketNotice, setTicketNotice] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const ticketNoticeTimeoutRef =
    React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [messageInput, setMessageInput] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [now, setNow] = React.useState(() => Date.now())
  const [merchantOptions, setMerchantOptions] = React.useState<MerchantOption[]>(
    []
  )
  const [merchantSearch, setMerchantSearch] = React.useState("")
  const [loadingMerchants, setLoadingMerchants] = React.useState(false)
  const [selectedMerchantId, setSelectedMerchantId] = React.useState<
    string | null
  >(null)
  const [outletOptions, setOutletOptions] = React.useState<OutletOption[]>([])
  const [outletSearch, setOutletSearch] = React.useState("")
  const [loadingOutlets, setLoadingOutlets] = React.useState(false)
  const [selectedOutletId, setSelectedOutletId] = React.useState<string | null>(
    null
  )
  const [categoryOptions, setCategoryOptions] = React.useState<CategoryOption[]>(
    []
  )
  const [loadingCategories, setLoadingCategories] = React.useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    string | null
  >(null)
  const [selectedSubcategory1Id, setSelectedSubcategory1Id] = React.useState<
    string | null
  >(null)
  const [selectedSubcategory2Id, setSelectedSubcategory2Id] = React.useState<
    string | null
  >(null)
  const [agentOptions, setAgentOptions] = React.useState<AgentOption[]>([])
  const [loadingAgents, setLoadingAgents] = React.useState(false)
  const [agentSearch, setAgentSearch] = React.useState("")
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(
    null
  )
  const lastFidLookupRef = React.useRef<string | null>(null)
  const lastOidLookupRef = React.useRef<string | null>(null)

  const showTicketNotice = React.useCallback(
    (notice: { type: "success" | "error"; message: string }) => {
      if (ticketNoticeTimeoutRef.current) {
        clearTimeout(ticketNoticeTimeoutRef.current)
      }
      setTicketNotice(notice)
      ticketNoticeTimeoutRef.current = setTimeout(() => {
        setTicketNotice(null)
      }, 3000)
    },
    []
  )

  const updateTicketDraft = React.useCallback(
    (updates: Partial<TicketDraft>) => {
      setTicketDraft((current) => (current ? { ...current, ...updates } : current))
    },
    []
  )

  const loadMerchants = React.useCallback(async (query?: string) => {
    const user = getSessionUser()
    if (!user?.id) {
      return
    }
    setLoadingMerchants(true)
    try {
      const params = new URLSearchParams()
      if (query?.trim()) {
        params.set("q", query.trim())
      }
      const response = await fetch(
        `/api/merchants/options?${params.toString()}`,
        {
          headers: { "x-user-id": user.id },
        }
      )
      if (!response.ok) {
        throw new Error("Unable to load franchises.")
      }
      const data = (await response.json()) as { merchants: MerchantOption[] }
      setMerchantOptions(data.merchants ?? [])
    } catch (loadError) {
      console.error(loadError)
    } finally {
      setLoadingMerchants(false)
    }
  }, [])

  const loadOutlets = React.useCallback(async (merchantId: string) => {
    const user = getSessionUser()
    if (!user?.id) {
      return
    }
    setLoadingOutlets(true)
    try {
      const response = await fetch(`/api/merchants/${merchantId}/outlets`, {
        headers: { "x-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error("Unable to load outlets.")
      }
      const data = (await response.json()) as {
        outlets: Array<{ id: string; name: string; external_id: string }>
      }
      setOutletOptions(
        (data.outlets ?? []).map((outlet) => ({
          id: outlet.id,
          name: outlet.name,
          externalId: outlet.external_id,
        }))
      )
    } catch (loadError) {
      console.error(loadError)
    } finally {
      setLoadingOutlets(false)
    }
  }, [])

  const loadCategories = React.useCallback(async () => {
    const user = getSessionUser()
    if (!user?.id) {
      return
    }
    setLoadingCategories(true)
    try {
      const response = await fetch("/api/ticket-categories", {
        headers: { "x-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error("Unable to load categories.")
      }
      const data = (await response.json()) as { categories: CategoryOption[] }
      setCategoryOptions(data.categories ?? [])
    } catch (loadError) {
      console.error(loadError)
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  const loadAgents = React.useCallback(async () => {
    const user = getSessionUser()
    if (!user?.id) {
      return
    }
    setLoadingAgents(true)
    try {
      const response = await fetch("/api/users/agents", {
        headers: { "x-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error("Unable to load agents.")
      }
      const data = (await response.json()) as { users: AgentOption[] }
      setAgentOptions(data.users ?? [])
    } catch (loadError) {
      console.error(loadError)
    } finally {
      setLoadingAgents(false)
    }
  }, [])

  const loadConversations = React.useCallback(async (query?: string) => {
    const user = getSessionUser()
    if (!user?.id) {
      setLoadingConversations(false)
      return
    }
    setLoadingConversations(true)
    try {
      const params = new URLSearchParams()
      if (query?.trim()) {
        params.set("q", query.trim())
      }
      const response = await fetch(
        `/api/whatsapp/conversations?${params.toString()}`,
        {
          headers: { "x-user-id": user.id },
        }
      )
      if (!response.ok) {
        throw new Error("Unable to load conversations.")
      }
      const data = (await response.json()) as {
        conversations: Conversation[]
      }
      setConversations(data.conversations ?? [])
      if (!selectedId && data.conversations?.length) {
        setSelectedId(data.conversations[0].id)
      }
      setError(null)
    } catch (loadError) {
      console.error(loadError)
      setError("Unable to load conversations.")
    } finally {
      setLoadingConversations(false)
    }
  }, [selectedId])

  React.useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  React.useEffect(() => {
    void loadCategories()
    void loadAgents()
  }, [loadCategories, loadAgents])

  React.useEffect(() => {
    const handle = setTimeout(() => {
      void loadConversations(search)
    }, 300)
    return () => clearTimeout(handle)
  }, [search, loadConversations])

  React.useEffect(() => {
    const handle = setTimeout(() => {
      void loadMerchants(merchantSearch)
    }, 300)
    return () => clearTimeout(handle)
  }, [merchantSearch, loadMerchants])

  React.useEffect(() => {
    if (!selectedMerchantId) {
      setOutletOptions([])
      setSelectedOutletId(null)
      return
    }
    void loadOutlets(selectedMerchantId)
  }, [selectedMerchantId, loadOutlets])

  const loadMessages = React.useCallback(async () => {
    const user = getSessionUser()
    if (!user?.id || !selectedId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    try {
      const response = await fetch(
        `/api/whatsapp/conversations/${selectedId}/messages`,
        {
          headers: { "x-user-id": user.id },
        }
      )
      if (!response.ok) {
        throw new Error("Unable to load messages.")
      }
      const data = (await response.json()) as { messages: Message[] }
      setMessages(data.messages ?? [])
      setError(null)
    } catch (loadError) {
      console.error(loadError)
      setError("Unable to load messages.")
    } finally {
      setLoadingMessages(false)
    }
  }, [selectedId])

  React.useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const loadTicket = React.useCallback(async () => {
    const user = getSessionUser()
    if (!user?.id || !selectedId) {
      setTicketDetails(null)
      return
    }
    setLoadingTicket(true)
    try {
      const response = await fetch(
        `/api/whatsapp/conversations/${selectedId}/ticket`,
        {
          headers: { "x-user-id": user.id },
        }
      )
      if (!response.ok) {
        throw new Error("Unable to load ticket.")
      }
      const data = (await response.json()) as { ticket: TicketDetails | null }
      setTicketDetails(data.ticket)
      setError(null)
    } catch (loadError) {
      console.error(loadError)
      setError("Unable to load ticket details.")
    } finally {
      setLoadingTicket(false)
    }
  }, [selectedId])

  React.useEffect(() => {
    void loadTicket()
  }, [loadTicket])

  React.useEffect(() => {
    if (!ticketDetails) {
      setTicketDraft(null)
      return
    }

    setTicketDraft({
      customerName: ticketDetails.customer_name ?? "",
      customerPhone: ticketDetails.customer_phone ?? "",
      franchiseName: ticketDetails.franchise_name ?? "",
      outletName: ticketDetails.outlet_name ?? "",
      fid: ticketDetails.fid ?? "",
      oid: ticketDetails.oid ?? "",
      msAgentName: ticketDetails.ms_agent_name ?? "",
      status: ticketDetails.status ?? "new",
      category: ticketDetails.category ?? "",
      subcategory1: ticketDetails.subcategory_1 ?? "",
      subcategory2: ticketDetails.subcategory_2 ?? "",
      issueDescription: ticketDetails.issue_description ?? "",
      internalNotes: ticketDetails.internal_notes ?? "",
      csatLink: ticketDetails.csat_link ?? "",
      csatScore:
        ticketDetails.csat_score === null ||
        ticketDetails.csat_score === undefined
          ? ""
          : String(ticketDetails.csat_score),
      csatResponse: ticketDetails.csat_response ?? "",
    })
  }, [ticketDetails])

  React.useEffect(() => {
    if (!ticketDraft) {
      setSelectedMerchantId(null)
      setSelectedOutletId(null)
      setSelectedCategoryId(null)
      setSelectedSubcategory1Id(null)
      setSelectedSubcategory2Id(null)
      return
    }

    if (!selectedMerchantId && merchantOptions.length) {
      const match = merchantOptions.find((merchant) => {
        if (ticketDraft.fid && merchant.fid) {
          return merchant.fid === ticketDraft.fid
        }
        if (ticketDraft.franchiseName) {
          return (
            merchant.name.toLowerCase() ===
            ticketDraft.franchiseName.toLowerCase()
          )
        }
        return false
      })
      if (match) {
        setSelectedMerchantId(match.id)
      }
    }
  }, [ticketDraft, merchantOptions, selectedMerchantId])

  React.useEffect(() => {
    if (!ticketDraft) {
      return
    }
    if (!selectedOutletId && outletOptions.length) {
      const match = outletOptions.find((outlet) => {
        if (ticketDraft.oid) {
          return outlet.externalId === ticketDraft.oid
        }
        if (ticketDraft.outletName) {
          return (
            outlet.name.toLowerCase() ===
            ticketDraft.outletName.toLowerCase()
          )
        }
        return false
      })
      if (match) {
        setSelectedOutletId(match.id)
      }
    }
  }, [ticketDraft, outletOptions, selectedOutletId])

  React.useEffect(() => {
    if (!ticketDraft || !categoryOptions.length) {
      return
    }
    if (!selectedCategoryId && ticketDraft.category) {
      const match = categoryOptions.find(
        (category) =>
          category.name.toLowerCase() === ticketDraft.category.toLowerCase()
      )
      if (match) {
        setSelectedCategoryId(match.id)
      }
    }
  }, [ticketDraft, categoryOptions, selectedCategoryId])

  React.useEffect(() => {
    if (!ticketDraft || !selectedCategoryId) {
      return
    }
    const category = categoryOptions.find(
      (item) => item.id === selectedCategoryId
    )
    if (!category) {
      return
    }
    if (!selectedSubcategory1Id && ticketDraft.subcategory1) {
      const match = category.subcategories.find(
        (subcategory) =>
          subcategory.name.toLowerCase() ===
          ticketDraft.subcategory1.toLowerCase()
      )
      if (match) {
        setSelectedSubcategory1Id(match.id)
      }
    }
  }, [ticketDraft, categoryOptions, selectedCategoryId, selectedSubcategory1Id])

  React.useEffect(() => {
    if (!ticketDraft || !selectedCategoryId || !selectedSubcategory1Id) {
      return
    }
    const category = categoryOptions.find(
      (item) => item.id === selectedCategoryId
    )
    const subcategory = category?.subcategories.find(
      (item) => item.id === selectedSubcategory1Id
    )
    if (!subcategory) {
      return
    }
    if (!selectedSubcategory2Id && ticketDraft.subcategory2) {
      const match = subcategory.subcategories.find(
        (item) =>
          item.name.toLowerCase() === ticketDraft.subcategory2.toLowerCase()
      )
      if (match) {
        setSelectedSubcategory2Id(match.id)
      }
    }
  }, [
    ticketDraft,
    categoryOptions,
    selectedCategoryId,
    selectedSubcategory1Id,
    selectedSubcategory2Id,
  ])

  React.useEffect(() => {
    if (!ticketDraft) {
      setSelectedAgentId(null)
      return
    }
    if (!selectedAgentId && ticketDraft.msAgentName && agentOptions.length) {
      const match = agentOptions.find(
        (agent) =>
          agent.name.toLowerCase() === ticketDraft.msAgentName.toLowerCase()
      )
      if (match) {
        setSelectedAgentId(match.id)
      }
    }
  }, [ticketDraft, agentOptions, selectedAgentId])

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  React.useEffect(() => {
    return () => {
      if (ticketNoticeTimeoutRef.current) {
        clearTimeout(ticketNoticeTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    const user = getSessionUser()
    if (!user?.id || !selectedId) {
      return
    }

    const params = new URLSearchParams()
    params.set("conversationId", selectedId)
    params.set("userId", user.id)

    const eventSource = new EventSource(
      `/api/whatsapp/stream?${params.toString()}`
    )

    const handleMessage = () => {
      void loadMessages()
      void loadConversations(search)
    }

    eventSource.addEventListener("message", handleMessage)

    return () => {
      eventSource.close()
    }
  }, [selectedId, search, loadMessages, loadConversations])

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId
  )
  const selectedCategory = categoryOptions.find(
    (category) => category.id === selectedCategoryId
  )
  const subcategory1Options = selectedCategory?.subcategories ?? []
  const selectedSubcategory1 = subcategory1Options.find(
    (subcategory) => subcategory.id === selectedSubcategory1Id
  )
  const subcategory2Options = selectedSubcategory1?.subcategories ?? []
  const filteredMerchants = merchantOptions.filter((merchant) => {
    if (!merchantSearch.trim()) {
      return true
    }
    return (
      matchesQuery(merchant.name, merchantSearch) ||
      (merchant.fid ? matchesQuery(merchant.fid, merchantSearch) : false) ||
      (merchant.company ? matchesQuery(merchant.company, merchantSearch) : false)
    )
  })

  const filteredOutlets = outletOptions.filter((outlet) => {
    if (!outletSearch.trim()) {
      return true
    }
    return (
      matchesQuery(outlet.name, outletSearch) ||
      matchesQuery(outlet.externalId, outletSearch)
    )
  })

  const filteredAgents = agentOptions.filter((agent) => {
    if (!agentSearch.trim()) {
      return true
    }
    return (
      matchesQuery(agent.name, agentSearch) ||
      matchesQuery(agent.email, agentSearch)
    )
  })

  const handleSend = async () => {
    const user = getSessionUser()
    if (!user?.id || !selectedId) {
      return
    }
    const messageBody = messageInput.trim()
    if (!messageBody) {
      return
    }
    setIsSending(true)
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          conversationId: selectedId,
          body: messageBody,
        }),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? "Unable to send message.")
      }
      setMessageInput("")
      await loadMessages()
      await loadConversations(search)
    } catch (sendError) {
      console.error(sendError)
      setError(
        sendError instanceof Error ? sendError.message : "Unable to send message."
      )
    } finally {
      setIsSending(false)
    }
  }

  const ensureMerchantOption = React.useCallback((merchant: MerchantOption) => {
    setMerchantOptions((current) => {
      if (current.some((item) => item.id === merchant.id)) {
        return current
      }
      return [merchant, ...current]
    })
  }, [])

  const ensureOutletOption = React.useCallback((outlet: OutletOption) => {
    setOutletOptions((current) => {
      if (current.some((item) => item.id === outlet.id)) {
        return current
      }
      return [outlet, ...current]
    })
  }, [])

  const handleMerchantSelect = (merchantId: string) => {
    const merchant = merchantOptions.find((item) => item.id === merchantId)
    setSelectedMerchantId(merchantId)
    setSelectedOutletId(null)
    setOutletSearch("")
    updateTicketDraft({
      franchiseName: merchant?.name ?? "",
      fid: merchant?.fid ?? "",
      outletName: "",
      oid: "",
    })
  }

  const handleOutletSelect = (outletId: string) => {
    const outlet = outletOptions.find((item) => item.id === outletId)
    setSelectedOutletId(outletId)
    updateTicketDraft({
      outletName: outlet?.name ?? "",
      oid: outlet?.externalId ?? "",
    })
  }

  const handleFidLookup = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === lastFidLookupRef.current) {
      return
    }
    lastFidLookupRef.current = trimmed
    const user = getSessionUser()
    if (!user?.id) {
      return
    }
    try {
      const response = await fetch(
        `/api/merchants/lookup?fid=${encodeURIComponent(trimmed)}`,
        {
          headers: { "x-user-id": user.id },
        }
      )
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? "Franchise not found.")
      }
      const data = (await response.json()) as {
        merchant: MerchantOption
      }
      const merchant = data.merchant
      ensureMerchantOption(merchant)
      setSelectedMerchantId(merchant.id)
      setSelectedOutletId(null)
      setOutletSearch("")
      updateTicketDraft({
        franchiseName: merchant.name,
        fid: merchant.fid ?? trimmed,
        outletName: "",
        oid: "",
      })
    } catch (lookupError) {
      console.error(lookupError)
      showTicketNotice({
        type: "error",
        message:
          lookupError instanceof Error
            ? lookupError.message
            : "Unable to find franchise.",
      })
    }
  }

  const handleOidLookup = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === lastOidLookupRef.current) {
      return
    }
    lastOidLookupRef.current = trimmed
    const user = getSessionUser()
    if (!user?.id) {
      return
    }
    try {
      const response = await fetch(
        `/api/merchants/lookup?oid=${encodeURIComponent(trimmed)}`,
        {
          headers: { "x-user-id": user.id },
        }
      )
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? "Outlet not found.")
      }
      const data = (await response.json()) as {
        merchant: MerchantOption
        outlet: OutletOption
      }
      const merchant = data.merchant
      const outlet = data.outlet
      ensureMerchantOption(merchant)
      ensureOutletOption(outlet)
      setSelectedMerchantId(merchant.id)
      setSelectedOutletId(outlet.id)
      setOutletSearch("")
      updateTicketDraft({
        franchiseName: merchant.name,
        fid: merchant.fid ?? "",
        outletName: outlet.name,
        oid: outlet.externalId,
      })
    } catch (lookupError) {
      console.error(lookupError)
      showTicketNotice({
        type: "error",
        message:
          lookupError instanceof Error
            ? lookupError.message
            : "Unable to find outlet.",
      })
    }
  }

  const handleCategorySelect = (categoryId: string) => {
    const category = categoryOptions.find((item) => item.id === categoryId)
    setSelectedCategoryId(categoryId)
    setSelectedSubcategory1Id(null)
    setSelectedSubcategory2Id(null)
    updateTicketDraft({
      category: category?.name ?? "",
      subcategory1: "",
      subcategory2: "",
    })
  }

  const handleSubcategory1Select = (subcategoryId: string) => {
    const subcategory = subcategory1Options.find(
      (item) => item.id === subcategoryId
    )
    setSelectedSubcategory1Id(subcategoryId)
    setSelectedSubcategory2Id(null)
    updateTicketDraft({
      subcategory1: subcategory?.name ?? "",
      subcategory2: "",
    })
  }

  const handleSubcategory2Select = (subcategoryId: string) => {
    const subcategory = subcategory2Options.find(
      (item) => item.id === subcategoryId
    )
    setSelectedSubcategory2Id(subcategoryId)
    updateTicketDraft({
      subcategory2: subcategory?.name ?? "",
    })
  }

  const handleAgentSelect = (agentId: string) => {
    const agent = agentOptions.find((item) => item.id === agentId)
    setSelectedAgentId(agentId)
    updateTicketDraft({
      msAgentName: agent?.name ?? "",
    })
  }

  const handleSaveTicket = async () => {
    const user = getSessionUser()
    if (!user?.id || !selectedId || !ticketDraft) {
      return
    }
    setTicketSaving(true)
    try {
      const response = await fetch(
        `/api/whatsapp/conversations/${selectedId}/ticket`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id,
          },
          body: JSON.stringify({
            customerName: ticketDraft.customerName,
            customerPhone: ticketDraft.customerPhone,
            franchiseName: ticketDraft.franchiseName,
            outletName: ticketDraft.outletName,
            fid: ticketDraft.fid,
            oid: ticketDraft.oid,
            msAgentName: ticketDraft.msAgentName,
            status: ticketDraft.status,
            category: ticketDraft.category,
            subcategory1: ticketDraft.subcategory1,
            subcategory2: ticketDraft.subcategory2,
            issueDescription: ticketDraft.issueDescription,
            internalNotes: ticketDraft.internalNotes,
            csatLink: ticketDraft.csatLink,
            csatScore: ticketDraft.csatScore,
            csatResponse: ticketDraft.csatResponse,
          }),
        }
      )
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? "Unable to update ticket.")
      }
      await loadTicket()
      showTicketNotice({ type: "success", message: "Ticket updated." })
    } catch (saveError) {
      console.error(saveError)
      showTicketNotice({
        type: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Unable to update ticket.",
      })
    } finally {
      setTicketSaving(false)
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merchant Success WhatsApp Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Live conversations from WhatsApp support (Twilio).
        </p>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Queue</CardTitle>
              <Input
                placeholder="Search by name or number"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingConversations ? (
                <div className="text-muted-foreground text-sm">
                  Loading conversations...
                </div>
              ) : null}
              {!loadingConversations && conversations.length === 0 ? (
                <div className="text-muted-foreground text-sm">
                  No WhatsApp conversations yet.
                </div>
              ) : null}
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                  className={[
                    "flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition",
                    conversation.id === selectedId
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-muted/60",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        {conversation.contactName ??
                          conversation.contactNumber ??
                          "Unknown contact"}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {conversation.contactNumber || "No number"}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatRelativeTime(conversation.lastMessageAt, now)}
                    </span>
                  </div>
                  <div className="text-sm">
                    {conversation.lastMessagePreview ?? "No messages yet."}
                  </div>
                  <div className="text-muted-foreground text-xs">
                  {conversation.ticket?.status
                    ? formatStatusLabel(conversation.ticket.status)
                    : "No ticket"}
                    {conversation.ticket?.fid
                      ? ` · FID ${conversation.ticket.fid}`
                      : ""}
                    {conversation.ticket?.oid
                      ? ` · OID ${conversation.ticket.oid}`
                      : ""}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="flex max-h-[calc(100vh-18rem)] flex-col">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Chatbox</CardTitle>
              <div>
                <div className="text-sm font-semibold">
                  {selectedConversation?.contactName ??
                    selectedConversation?.contactNumber ??
                    "Select a conversation"}
                </div>
                <p className="text-muted-foreground text-xs">
                  {selectedConversation?.contactNumber ?? "No contact selected"}
                </p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 min-h-0">
              {error ? (
                <div className="text-destructive text-sm">{error}</div>
              ) : null}
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                {loadingMessages ? (
                  <div className="text-muted-foreground text-sm">
                    Loading messages...
                  </div>
                ) : null}
                {!loadingMessages && messages.length === 0 ? (
                  <div className="text-muted-foreground text-sm">
                    No messages in this conversation yet.
                  </div>
                ) : null}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.direction === "outbound"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={[
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                        message.direction === "outbound"
                          ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border/80 shadow-sm dark:bg-sidebar-accent dark:text-sidebar-accent-foreground"
                          : "bg-primary/5 text-foreground border border-primary/20 shadow-sm dark:bg-primary/10 dark:border-primary/30 dark:text-foreground",
                      ].join(" ")}
                    >
                      <div>{message.body}</div>
                      <div className="mt-1 text-[11px] opacity-70">
                        {formatDateTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-auto space-y-3">
                <Separator />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Phone className="size-3" />
                    {selectedConversation?.contactNumber ?? "--"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="size-3" />
                    WhatsApp via Twilio
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Reply to merchant"
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void handleSend()
                      }
                    }}
                    disabled={!selectedId || isSending}
                  />
                  <Button
                    size="icon"
                    onClick={() => void handleSend()}
                    disabled={!selectedId || isSending}
                  >
                    <Send />
                  </Button>
                </div>
                <div className="text-muted-foreground text-xs">
                  SLA clock paused while waiting on merchant response.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Ticket details</CardTitle>
              <p className="text-muted-foreground text-xs">
                Update ticket metadata and customer context for this
                conversation.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSaveTicket()}
              disabled={!ticketDraft || loadingTicket || ticketSaving}
            >
              {ticketSaving ? "Saving..." : "Save ticket"}
            </Button>
          </CardHeader>
          <CardContent>
            {ticketNotice ? (
              <div
                className={[
                  "mb-4 text-sm",
                  ticketNotice.type === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                ].join(" ")}
              >
                {ticketNotice.message}
              </div>
            ) : null}
            {loadingTicket ? (
              <div className="text-muted-foreground text-sm">
                Loading ticket...
              </div>
            ) : !ticketDraft ? (
              <div className="text-muted-foreground text-sm">
                No ticket created for this conversation yet.
              </div>
            ) : (
              <div className="grid gap-6 text-sm">
                <div>
                  <div className="text-sm font-semibold">Customer details</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ticket-customer-name">
                        Merchant/Customer Name
                      </Label>
                      <Input
                        id="ticket-customer-name"
                        value={ticketDraft.customerName}
                        onChange={(event) =>
                          setTicketDraft((current) =>
                            current
                              ? { ...current, customerName: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-customer-phone">Phone Number</Label>
                      <Input
                        id="ticket-customer-phone"
                        value={ticketDraft.customerPhone}
                        disabled
                        className="bg-muted/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Franchise</Label>
                      <Select
                        value={selectedMerchantId ?? undefined}
                        onValueChange={handleMerchantSelect}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select franchise" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Search franchise"
                              value={merchantSearch}
                              onChange={(event) =>
                                setMerchantSearch(event.target.value)
                              }
                            />
                          </div>
                          {loadingMerchants ? (
                            <SelectItem value="__loading__" disabled>
                              Loading franchises...
                            </SelectItem>
                          ) : filteredMerchants.length ? (
                            filteredMerchants.map((merchant) => (
                              <SelectItem key={merchant.id} value={merchant.id}>
                                {merchant.name}
                                {merchant.fid ? ` · FID ${merchant.fid}` : ""}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__empty__" disabled>
                              No franchises found.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Outlet</Label>
                      <Select
                        value={selectedOutletId ?? undefined}
                        onValueChange={handleOutletSelect}
                        disabled={!selectedMerchantId || loadingOutlets}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              selectedMerchantId
                                ? "Select outlet"
                                : "Select franchise first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Search outlet"
                              value={outletSearch}
                              onChange={(event) =>
                                setOutletSearch(event.target.value)
                              }
                              disabled={!selectedMerchantId}
                            />
                          </div>
                          {loadingOutlets ? (
                            <SelectItem value="__loading__" disabled>
                              Loading outlets...
                            </SelectItem>
                          ) : filteredOutlets.length ? (
                            filteredOutlets.map((outlet) => (
                              <SelectItem key={outlet.id} value={outlet.id}>
                                {outlet.name}
                                {outlet.externalId
                                  ? ` · OID ${outlet.externalId}`
                                  : ""}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__empty__" disabled>
                              No outlets found.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">Ticket metadata</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ticket-fid">FID</Label>
                      <Input
                        id="ticket-fid"
                        value={ticketDraft.fid}
                        onChange={(event) =>
                          updateTicketDraft({ fid: event.target.value })
                        }
                        onBlur={(event) =>
                          void handleFidLookup(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void handleFidLookup(event.currentTarget.value)
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-oid">OID</Label>
                      <Input
                        id="ticket-oid"
                        value={ticketDraft.oid}
                        onChange={(event) =>
                          updateTicketDraft({ oid: event.target.value })
                        }
                        onBlur={(event) =>
                          void handleOidLookup(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void handleOidLookup(event.currentTarget.value)
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-agent">MS Agent</Label>
                      <Select
                        value={selectedAgentId ?? undefined}
                        onValueChange={handleAgentSelect}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select MS agent" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Search agents"
                              value={agentSearch}
                              onChange={(event) =>
                                setAgentSearch(event.target.value)
                              }
                            />
                          </div>
                          {loadingAgents ? (
                            <SelectItem value="__loading__" disabled>
                              Loading agents...
                            </SelectItem>
                          ) : filteredAgents.length ? (
                            filteredAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__empty__" disabled>
                              No agents found.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={ticketDraft.status}
                        onValueChange={(value) =>
                          setTicketDraft((current) =>
                            current ? { ...current, status: value } : current
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {formatStatusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">Issue details</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={selectedCategoryId ?? undefined}
                        onValueChange={handleCategorySelect}
                        disabled={loadingCategories || !categoryOptions.length}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              loadingCategories
                                ? "Loading categories"
                                : "Select category"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.length ? (
                            categoryOptions.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__empty__" disabled>
                              No categories configured.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subcategory 1</Label>
                      <Select
                        value={selectedSubcategory1Id ?? undefined}
                        onValueChange={handleSubcategory1Select}
                        disabled={!selectedCategoryId || !subcategory1Options.length}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              selectedCategoryId
                                ? "Select subcategory"
                                : "Select category first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategory1Options.length ? (
                            subcategory1Options.map((subcategory) => (
                              <SelectItem
                                key={subcategory.id}
                                value={subcategory.id}
                              >
                                {subcategory.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__empty__" disabled>
                              No subcategories available.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {subcategory2Options.length ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Subcategory 2</Label>
                        <Select
                          value={selectedSubcategory2Id ?? undefined}
                          onValueChange={handleSubcategory2Select}
                          disabled={!selectedSubcategory1Id}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select subcategory" />
                          </SelectTrigger>
                          <SelectContent>
                            {subcategory2Options.map((subcategory) => (
                              <SelectItem
                                key={subcategory.id}
                                value={subcategory.id}
                              >
                                {subcategory.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="ticket-issue-description">
                        Issue description
                      </Label>
                      <textarea
                        id="ticket-issue-description"
                        value={ticketDraft.issueDescription}
                        onChange={(event) =>
                          setTicketDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  issueDescription: event.target.value,
                                }
                              : current
                          )
                        }
                        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">CSAT</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ticket-csat-link">CSAT survey link</Label>
                      <Input
                        id="ticket-csat-link"
                        value={ticketDraft.csatLink}
                        onChange={(event) =>
                          setTicketDraft((current) =>
                            current
                              ? { ...current, csatLink: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-csat-score">CSAT result</Label>
                      <Input
                        id="ticket-csat-score"
                        value={ticketDraft.csatScore}
                        onChange={(event) =>
                          setTicketDraft((current) =>
                            current
                              ? { ...current, csatScore: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="ticket-csat-response">
                        CSAT response
                      </Label>
                      <textarea
                        id="ticket-csat-response"
                        value={ticketDraft.csatResponse}
                        onChange={(event) =>
                          setTicketDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  csatResponse: event.target.value,
                                }
                              : current
                          )
                        }
                        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">Internal notes</div>
                  <div className="mt-3">
                    <Label htmlFor="ticket-notes" className="sr-only">
                      Ticket Notes for MS reference
                    </Label>
                    <textarea
                      id="ticket-notes"
                      value={ticketDraft.internalNotes}
                      onChange={(event) =>
                        setTicketDraft((current) =>
                          current
                            ? {
                                ...current,
                                internalNotes: event.target.value,
                              }
                            : current
                        )
                      }
                      className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      placeholder="Ticket notes for MS reference"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
