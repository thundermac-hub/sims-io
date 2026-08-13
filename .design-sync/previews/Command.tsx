import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "sims"
import { Store, Ticket, Users } from "lucide-react"

export const GlobalSearch = () => (
  <Command className="w-full max-w-[420px] rounded-lg border shadow-sm">
    <CommandInput placeholder="Search merchants, tickets or leads…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Merchants">
        <CommandItem>
          <Store />
          Kopitiam Sentral
        </CommandItem>
        <CommandItem>
          <Store />
          Astoria Cafe
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Tickets">
        <CommandItem>
          <Ticket />
          #4821 · POS terminal not syncing
          <CommandShortcut>⌘4</CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Leads">
        <CommandItem>
          <Users />
          Warung Pak Din
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
)

export const EmptyState = () => (
  <Command className="w-full max-w-[420px] rounded-lg border shadow-sm">
    <CommandInput placeholder="Search…" defaultValue="zzzz" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
    </CommandList>
  </Command>
)
