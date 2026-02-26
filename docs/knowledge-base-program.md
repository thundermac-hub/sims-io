# Knowledge Base Program (Notion-first)

## Objective

Run a two-stage knowledge base pipeline:

1. Use Notion as the drafting, review, and approval system of record.
2. Manually publish only approved content into the in-app knowledge base.

## Scope

- Audience: External end users
- Language: English-first
- Cadence: Daily incremental updates
- QA gate: Human approval required

## Interfaces

### Notion article schema

Required properties:

- `Title` (text)
- `Audience` (`External User`)
- `Category` (select):
  - `Getting Started`
  - `Tickets`
  - `Merchants`
  - `Renewals`
  - `CSAT`
  - `Profile`
  - `Troubleshooting`
- `Feature Area` (multi-select)
- `Status` (select):
  - `Draft`
  - `Ready for Review`
  - `Approved`
  - `Published`
- `App Version` (text)
- `Last Verified Date` (date)
- `Source Refs` (URL/text list)
- `Owner` (person)

### In-app article contract

Implemented at:
- `/Users/hafiz/sims-io/src/lib/knowledge-base.ts`

Fields:
- `slug: string`
- `title: string`
- `summary: string`
- `category: string`
- `bodyMarkdown: string`
- `lastVerifiedDate: string`
- `versionTag: string`
- `relatedArticles: string[]`

## Publication rules

- Only `Status=Approved` can be published.
- Every article must include at least one `Source Ref`.
- Any feature-impacting code/docs change must rollback stale `Published` docs to `Draft` during delta capture.

## Daily automations

### 1) KB Delta Capture (09:00)

Goal:
- Detect product/docs deltas from:
  - `/Users/hafiz/sims-io/docs/PRD.md`
  - `/Users/hafiz/sims-io/docs/TDD.md`
  - `/Users/hafiz/sims-io/src/app/api`
  - `/Users/hafiz/sims-io/src/app/(app)`
- Propose new/updated Notion pages as `Draft`.

### 2) KB QA Gate (10:00)

Goal:
- Validate `Draft` pages for:
  - Broken steps
  - Outdated labels/routes
  - Missing prerequisites
  - Unsupported claims
- Output reviewer checklist.
- Mark each page: `Ready for Review` or `Needs Fix` (tracked in notes/comments).

### 3) KB Publish Queue (16:00)

Goal:
- List `Approved` pages pending in-app publication.
- Include title/category/slug/version/last-verified metadata.
- Generate copy-ready publish notes.

## Pilot workflow

1. Create the Notion KB data source with the schema above.
2. Run one pilot article in `Getting Started`.
3. Review with human QA and publish manually in-app.
4. Run a 3-day cycle and tune automation prompts.

## Validation scenarios

1. Delta detection:
   - Change a user-facing label and verify next run proposes Draft updates.
2. New feature coverage:
   - Add a new route and verify at least one new Draft article appears.
3. QA enforcement:
   - Draft without prerequisites must be flagged `Needs Fix`.
4. Approval gate:
   - `Draft` and `Ready for Review` items never enter publish queue.
5. Metadata completeness:
   - Publish queue always includes slug/category/version/last-verified fields.
6. Freshness SLA:
   - Feature change is reflected in Draft content within 24 hours.
