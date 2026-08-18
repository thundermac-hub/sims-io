# SIMS design system — how to build with it

SIMS is an internal merchant-engagement platform (support tickets, merchant directory, sales
leads, renewals, appointments). This library is its real shipped UI layer: shadcn/ui-style
components on Radix primitives, styled with **Tailwind v4 utilities bound to semantic CSS
variables**. Build screens out of these components; do not hand-roll lookalikes.

## Importing and wrapping

Every component is on `window.SimsUI`. There is **no global theme provider** — the design tokens
live in `:root` in `styles.css`, so components are correctly styled as soon as that stylesheet is
loaded. Two families do need a wrapper:

- **`Tooltip` must be inside `TooltipProvider`** (once, near the root of your tree).
- **The whole `Sidebar*` family must be inside `SidebarProvider`.** `SidebarProvider` owns the
  open/collapsed state and the `--sidebar-width` variables; `Sidebar`, `SidebarTrigger`,
  `SidebarMenuButton` and friends read that context and will throw without it. For a static,
  always-visible nav use `<Sidebar collapsible="none">`.

```jsx
const { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem,
        SidebarMenuButton, TooltipProvider, Button, Card, CardHeader, CardTitle,
        CardContent } = window.SimsUI

<TooltipProvider>
  <SidebarProvider>
    <Sidebar collapsible="none" className="border-r">
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive>Tickets</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
    <main className="bg-background text-foreground flex-1 p-6">
      <Card className="w-[380px]">
        <CardHeader><CardTitle>Kopitiam Sentral</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          3 outlets · renewal in 42 days
        </CardContent>
      </Card>
      <Button className="mt-4">Create ticket</Button>
    </main>
  </SidebarProvider>
</TooltipProvider>
```

## The styling idiom: Tailwind utilities over semantic tokens

Style your own layout glue with Tailwind utility classes. **Always reach for the semantic colour
utilities below rather than raw palette colours** (`bg-red-500`, `#fff`) — they are what make a
screen look like SIMS, and they are what makes dark mode work.

| Role | Surface / text utilities |
|---|---|
| Page | `bg-background` `text-foreground` |
| Cards, panels | `bg-card` `text-card-foreground` |
| Popovers, menus, dialogs | `bg-popover` `text-popover-foreground` |
| Primary action (SIMS brand red) | `bg-primary` `text-primary-foreground` |
| Secondary action | `bg-secondary` `text-secondary-foreground` |
| Muted / de-emphasised text | `bg-muted` `text-muted-foreground` |
| Hover + subtle highlight | `bg-accent` `text-accent-foreground` |
| Danger / destructive | `bg-destructive` `text-destructive` |
| Borders, inputs, focus rings | `border-border` `border-input` `ring-ring` |
| Sidebar surface | `bg-sidebar` `text-sidebar-foreground` `border-sidebar-border` `bg-sidebar-accent` |
| Chart series | `--chart-1` … `--chart-5` |

Radius follows one `--radius` scale: `rounded-sm` `rounded-md` `rounded-lg` `rounded-xl`
(plus `rounded-2xl`/`3xl`/`4xl`). Type uses the `--font-geist-sans` / `--font-geist-mono` stacks —
just use `font-sans` / `font-mono` and the normal `text-*` sizes.

**Dark mode is class-based**, not media-query based: the variant is `&:is(.dark *)`. Put `.dark`
on a wrapping element and every token flips. Never write `dark:bg-neutral-900` against a raw
colour — use the semantic utility and let it flip for you.

## Component API conventions

- **Variants are props, not classes.** `Button` takes `variant`
  (`default` | `secondary` | `outline` | `ghost` | `link` | `destructive`) and `size`
  (`default` | `sm` | `lg` | `icon` | `icon-sm` | `icon-lg`). Read the component's `.d.ts` for the
  exact union before inventing a value.
- **`className` is always merged**, never replaced (`cn()` = clsx + tailwind-merge), so passing
  `className="w-[380px]"` is the intended way to size a component.
- **`asChild`** (on `Button`, `Label`, `Separator`, most Radix triggers) renders the child element
  instead of the default tag — use it to make a `Button` an anchor.
- **Compound components are flat named exports**, not dotted: `Card` + `CardHeader` + `CardTitle` +
  `CardDescription` + `CardAction` + `CardContent` + `CardFooter`. Same pattern for `Dialog*`,
  `Select*`, `DropdownMenu*`, `Sheet*`, `Command*`, `Field*`, `Breadcrumb*`, `Pagination*`,
  `Sidebar*`, `Tabs*`, `Avatar*`.
- **Icons** are `lucide-react`, bundled. Buttons auto-size any nested `svg` to 16px.
- **Forms**: prefer the `Field*` family (`FieldSet` › `FieldLegend` › `FieldGroup` › `Field` ›
  `FieldLabel` / `FieldDescription` / `FieldError`) over hand-built label+input stacks. Set
  `aria-invalid` on the control and `data-invalid` on the `Field` to get the error styling.
- **Dates and times**: `DateTimePicker` (`mode="date" | "datetime"`, value `"yyyy-MM-dd"` or
  `"yyyy-MM-ddTHH:mm"`) and `TimeSelect` (24h `"HH:mm"`, `stepMinutes` / `startHour` / `endHour`)
  are controlled — always pass `value` **and** `onChange`.
- **Confirmations**: use `ConfirmDialog` (`destructive` prop) for any irreversible action rather
  than assembling a `Dialog` yourself.

## Charts

`recharts` ships in this bundle and its exports are on `window.SimsUI` too. Wrap every chart in
`ChartContainer` with a `config` object — each config key becomes a `var(--color-<key>)` you
reference from `fill`/`stroke`:

```jsx
const { ChartContainer, ChartTooltip, ChartTooltipContent, AreaChart, Area, XAxis } = window.SimsUI
<ChartContainer config={{ total: { label: "Leads", color: "#2563eb" } }} className="h-[220px] w-full">
  <AreaChart data={data}>
    <XAxis dataKey="label" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Area dataKey="total" type="monotone" stroke="var(--color-total)" fill="var(--color-total)" fillOpacity={0.2} />
  </AreaChart>
</ChartContainer>
```

Give the `ChartContainer` an explicit height and a parent with a real width — recharts measures its
parent, so a chart inside an auto-width box renders as an empty area. Use `ChartTooltip` and
`ChartLegend` (not recharts' own `Tooltip`/`Label`: those two names collide with the SIMS `Tooltip`
and `Label` components, and the SIMS ones win).

## Where the truth is

- **Tokens and the full class vocabulary**: `_ds/<folder>/styles.css` and the `@import`ed
  `_ds_bundle.css`. Read them before inventing a colour.
- **Per-component API**: `components/<group>/<Name>/<Name>.d.ts` — the `<Name>Props` interface is
  generated from the repo's real TypeScript, including exact variant unions.
- **Per-component usage**: `components/<group>/<Name>/<Name>.prompt.md`.

Content note: realistic SIMS copy is merchant/ticket/lead domain language — merchant and outlet
names, ticket numbers, agent names, renewal dates. Avoid lorem ipsum and generic "Item 1" labels.
