# design-sync notes — sims

Repo-specific gotchas for future syncs of `src/components/ui` → claude.ai/design.

## Shape

- SIMS is a **Next.js app, not a publishable package**: no `dist/`, no `exports`, no Storybook.
  The converter runs the **package shape in synth-entry mode**, bundling from `src/components/ui`
  (`cfg.srcDir`). 28 source files → **139 exported components** (shadcn compound parts).

## Required setup that is NOT in the repo (regenerate before every sync)

Three generated inputs are gitignored and must be rebuilt before running the converter:

1. **`node_modules/sims` symlink** — the converter resolves the package under `node_modules/<pkg>`,
   which npm won't self-install. Without it the build dies with
   `ENOENT … node_modules/sims/package.json`.
   ```sh
   ln -sfn ../ node_modules/sims
   ```
2. **`types/` + root `index.d.ts`** — prop extraction is **`.d.ts`-only** (ts-morph). In synth-entry
   mode there are no declarations, so every `<Name>Props` came out as a bare
   `[key: string]: unknown` index signature — a silent, total loss of the API contract the design
   agent codes against. Fix is to emit real declarations from the repo's own TypeScript:
   ```sh
   npx tsc -p .design-sync/tsconfig.types.json     # → types/**/*.d.ts
   node -e 'const fs=require("fs");fs.writeFileSync("index.d.ts",fs.readdirSync("types/components/ui").filter(f=>f.endsWith(".d.ts")).map(f=>`export * from "./types/components/ui/${f.replace(/\.d\.ts$/,"")}";`).join("\n")+"\n")'
   ```
   `findTypesRoot` auto-discovers `types/`; the root `index.d.ts` barrel is what
   `projectFor` uses as the export entry (it looks for `<pkgDir>/index.d.ts` when
   `package.json` has no `types` field — deliberately left unset so the app's
   `package.json` stays untouched).
3. **`.design-sync/compiled.css`** — Tailwind v4 utilities compiled from
   `.design-sync/tailwind-entry.css` (which wraps the app's real `src/app/globals.css`):
   ```sh
   ./.ds-sync/node_modules/.bin/tailwindcss -i .design-sync/tailwind-entry.css -o .design-sync/compiled.css
   ```
   `tailwind-entry.css` also carries an **`@source inline(...)` safelist** for the semantic
   utility vocabulary documented in `conventions.md` (`ring-ring`, `font-sans`, the full
   `{bg,text,border,ring}-{token}` matrix, the radius scale). Designs built in Claude Design
   receive only this stylesheet, and Tailwind only emits classes it *finds* — without the
   safelist, utilities the design agent is told to use but that no repo file happens to use
   (verified: `ring-ring`, `font-sans`) resolve to nothing. **If you edit conventions.md's class
   table, update the safelist to match.**

   **Recompile this after editing any preview.** `tailwind-entry.css` adds
   `@source "./previews"` precisely because utilities used *only* inside authored previews are
   otherwise never generated — the first pass silently dropped `w-[380px]` and the cards rendered
   at the wrong width with no error anywhere.

## Config decisions

- `cssEntry` points at the **compiled** stylesheet, never `globals.css` (raw Tailwind source
  would ship `@import "tailwindcss"` and no utilities at all).
- `guidelinesGlob` is deliberately pointed at a non-existent `docs/design-guidelines/`.
  The default glob swept `docs/*.md`, which would have uploaded **PRD.md and TDD.md** (internal
  product/technical detail) into the design project. Nothing in `docs/` is design guidance.
- `docsDir: .design-sync/docs` holds **139 frontmatter-only stubs** whose sole content is
  `category:`. They exist to group cards (Actions / Forms / Overlays / Navigation / Layout /
  Data Display) — without them all 139 land in one flat `general` group. A frontmatter-only stub
  yields an empty `docBody`, so the converter still synthesizes the full `.prompt.md` from props +
  examples. **Regenerate these if components are added** (see the generator in this run's history);
  a stub with real prose in it would *replace* the synthesized doc.
- `dtsPropsFor` covers 5 components typed as `React.ComponentProps<typeof OtherComponent>`
  (FieldLabel, SidebarTrigger, SidebarInput, SidebarSeparator, CommandDialog) — that cross-module
  indirection defeats the extractor and yields empty props.
- `extraEntries: ["recharts"]` — **required for charts to render at all.** Previews that
  `import { AreaChart } from "recharts"` otherwise bundle a *second* recharts instance, and
  `ResponsiveContainer` (from the copy inlined in `_ds_bundle.js`) silently refuses foreign
  children: the chart area renders as an empty box with **no console error**.
  Known consequence: `[EXPORT_COLLISION]` on `Tooltip` and `Label` — recharts exports both names
  and the main package wins, which is correct (`window.SimsUI.Tooltip` is the SIMS tooltip).
  Use `ChartTooltip`/`ChartLegend` for charts.
- `runtimeFontPrefixes: ["SF Pro", …]` suppresses `[FONT_MISSING]`. **User decision (accepted
  2026-08-13):** SF Pro/SF Mono are Apple system fonts that cannot be licensed into the bundle;
  the theme's existing fallback chain (`-apple-system` → Segoe UI → Helvetica Neue → Arial) is
  used as-is, exactly matching the app's own behaviour off-Apple. Do not "fix" this by
  substituting a webfont without asking again.

## Known render warns

None outstanding — the final validate is fully clean (139/139, zero warn lines).
Previously triaged and now resolved:
- `[GRID_OVERFLOW]` on Card and Field → `cardMode: "column"`.
- Overlay components (Dialog, ConfirmDialog, Sheet, DropdownMenu, Popover, Tooltip, Sidebar)
  need `cardMode: "single"` + an explicit `viewport`, else the open state escapes the grid cell.

## Design-system findings (worth fixing in the repo, not in the sync)

- **`SidebarMenuSkeleton` is effectively invisible in its own context.** `Skeleton` paints
  `bg-accent` = `hsl(0 0% 96.1%)`; `--sidebar` = `hsl(0 0% 96%)`. Inside a real `<Sidebar>` the
  loading bars differ from their background by 0.1% lightness. This is an app bug, not a preview
  bug — the preview deliberately renders it on the default surface so the card is legible, and
  says so in a comment. Consider a dedicated `--sidebar-accent`-based skeleton token.

## Re-sync risks

- **All three generated inputs above are gitignored.** On a fresh clone the build will fail
  (or worse, silently regress prop contracts to `[key: string]: unknown`) until they are
  regenerated. Always run all three steps, then check a `.d.ts` in the output has real props
  before uploading.
- **Preview utilities depend on the CSS recompile.** If `compiled.css` is stale relative to
  `previews/`, cards render with missing utilities and *nothing warns*. Recompile, always.
- `types/` is emitted with `rootDir: ../src`, so declarations land at
  `types/components/ui/*.d.ts`. If `src/` layout moves, fix `.design-sync/tsconfig.types.json`
  and the barrel generator together.
- Preview grades live in the gitignored `.design-sync/.cache/`; durable verification state is the
  uploaded `_ds_sync.json`. `.design-sync/previews/` (31 authored files) **is** committed.
- 105 of 139 components ship the **floor card** by design — all the compound sub-parts
  (DialogTitle, SelectItem, SidebarMenuButton…). They are fully importable and documented; their
  parent's preview shows them composed. Authoring more is a standing, incremental option.
- Bundle is ~2.3 MB after adding recharts. If that becomes a problem, the alternative is dropping
  `extraEntries` and skipping the ChartContainer previews — the charts cannot render without it.
