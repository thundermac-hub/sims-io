# n8n workflows — Respond.io → SIMS ticket automation

Four importable workflows, one per Respond.io event, all posting to the same SIMS
endpoint (`POST /api/integrations/respond-io`, see `src/app/api/integrations/respond-io/route.ts`).

| File | Respond.io event | Effect in SIMS |
|---|---|---|
| `sims-respondio-contact-tag-updated.json` | Contact Tag Updated | Creates an open Merchant Success ticket when the tag matches the routing tag |
| `sims-respondio-contact-assignee-updated.json` | Contact Assignee Updated | Sets the ticket's MS PIC by matching the assignee email to `users.email` |
| `sims-respondio-message-sent.json` | New Outgoing Message | Moves the ticket from Open to In Progress on the first outgoing agent message |
| `sims-respondio-conversation-closed.json` | Conversation Closed | Resolves the ticket and stamps `closed_at` |

Each workflow is Trigger → Code (normalize) → HTTP Request (post to SIMS). Two have one
extra **If** node between the Code and HTTP nodes:

- `Tag present?` (tag workflow) drops events carrying no tag, so tag *removals* never
  reach SIMS.
- `Agent message?` (message workflow) drops a message whose normalized direction is
  definitely `incoming`.

Both If nodes leave their false branch deliberately unconnected — a dropped event ends
there, silently.

## Before importing

1. Migrations `024_contacts_directory.sql` and `025_respondio_ticket_automation.sql` applied, in order.
2. `/contacts` and `/integrations` access keys granted in User Management.
3. In **General → Integrations**: set the Merchant Success routing tag and issue a shared
   secret. The secret is shown once — copy it before leaving the page.

## In Respond.io

Respond.io's own **Webhooks** and **HTTP Request** workflow step are both Advanced-plan
features. The **n8n integration** is available on every plan except Starter and carries
triggers for all four events we need, so that is the path this setup uses.

1. **Workspace Settings → Integrations → n8n** → generate an API key. This authenticates
   the Respond.io *trigger* node in n8n. It is unrelated to the SIMS shared secret.
2. Create the routing tag (e.g. `Merchant Success`) and use the same name in SIMS →
   General → Integrations. A tag that does not match logs every event as `ignored`.
3. Confirm each Merchant Success agent's Respond.io email matches their `users.email` in
   SIMS — the assignee sync matches on email and logs an unmatched agent otherwise.
4. Nothing to configure for the outgoing-message workflow: its trigger already restricts
   **Event Source** to `User`, so bot, AI Agent, workflow, Zapier/Make/n8n and Developer
   API sends never advance a ticket. See "Which message counts" below.

No webhook endpoints to register: the trigger node subscribes on its own.

## Import steps

1. Install the community node `@respond-io/n8n-nodes-respond-io` (n8n Cloud: marketplace;
   self-hosted: Settings → Community Nodes).
2. n8n → **Workflows → Import from File**, once per JSON file.
3. **Swap the trigger.** Each imported workflow starts with a generic **Respond.io
   Webhook** node, which only works on an Advanced Respond.io plan. Delete it, add a
   **Respond.io Trigger** node authenticated with the API key above, set its event, and
   connect it to **Normalize for SIMS**:

   | Workflow file | Trigger event |
   |---|---|
   | `...contact-tag-updated.json` | Contact Tag Updated |
   | `...contact-assignee-updated.json` | Contact Assignee Updated |
   | `...message-sent.json` | New Outgoing Message (Event Source: `User`) |
   | `...conversation-closed.json` | Conversation Closed |

   The Code node needs no change — it reads `$json.body ?? $json`, so it handles both the
   webhook shape and the trigger node's flat output.
4. Create the credential (once, shared by all four): **Credentials → New → Header Auth**
   - Name: `SIMS Webhook Secret`
   - Header name: `x-sims-webhook-secret`
   - Header value: the secret issued in SIMS → General → Integrations

   Then open each workflow's **POST SIMS webhook** node and select it — the imported
   `REPLACE_WITH_CREDENTIAL_ID` placeholder shows as unset.
5. In the same node, replace the URL host:
   `https://REPLACE_WITH_STAGING_HOST/api/integrations/respond-io`
6. Open **Normalize for SIMS** in `sims-respondio-contact-tag-updated.json` and set
   `ROUTING_TAG` to the exact tag configured in SIMS (comparison is case-insensitive).
   The other three workflows need no editing.

   That workflow's **Tag present?** If node needs no editing either. Its false branch is
   deliberately unconnected — a tag-removal event ends there, silently. The same goes for
   **Agent message?** in the message workflow.
7. Activate each workflow.

Keeping the Webhook node instead is valid on an Advanced plan: activate the workflow, copy
the node's Production URL, and register it under Workspace Settings → Integrations →
Webhooks against the matching event. That path must answer within 5 seconds, which the
node's `onReceived` response mode already does, and Respond.io disables a webhook after 30
errors in 30 minutes.

## Why the tag workflow gates on a non-empty tag

Respond.io fires **Contact Tag Updated** for removals as well as additions, and a removal
arrives with an empty tag list. Posting those to SIMS is harmless — they land as `ignored`
— but it fills the event log with noise and burns the endpoint's 60 req/min budget. The
`Tag present?` If node checks the normalized `tag` field is not empty and only then calls
SIMS, so the event log shows tag traffic that actually mattered.

## Why the Code node exists

Respond.io's payload field names vary by event and by API version. The Code node flattens
the shapes SIMS's parser accepts (`src/lib/respondio-resolution.ts`) — contact id from
`id`/`contact_id`, name from `name` or `firstName`+`lastName`, tags from a string or an
object list — and fails loudly if there is no contact id, rather than sending a body SIMS
will reject with 400.

## Which message counts

Respond.io calls a team member a **user** and the merchant a **contact**. The workflow
subscribes to **New Outgoing Message** (`newOutgoingMessage`), not New Incoming Message —
a ticket goes In Progress when an agent actually replies, and being assigned is not the
same as being worked on.

Outgoing is not the same as human, so the trigger's **Event Source** is pinned to `User`.
The node offers `user`, `workflow`, `api`, `zapier`, `bot`, `echo`, `make`, `n8n` and
`ai_agent` for this event; everything but `user` is a machine send, and an auto-reply
greeting should not make a ticket look picked up. Widen it only deliberately — if, say,
an AI Agent handling first response really should count as work started.

**Message Type** is left empty, which the node reads as every type: a reply is a reply
whether it is text, an attachment, or a WhatsApp template.

"First message" is not counted anywhere. `handleMessageSent` in `src/lib/respondio.ts`
only advances a ticket whose status is still exactly `Open`, so:

- the first agent reply moves `Open` → `In Progress` and logs a `ticket_history` row;
- every later message on the same conversation returns `noop`;
- a ticket an agent has since moved to `Pending Customer` is never dragged back, and a
  `Resolved` ticket is not reopened.

This means no message ledger to keep in sync, and it makes the retry story trivial.

The **Agent message?** If node is a second line of defence behind the Event Source
filter, reading the `traffic` field Respond.io puts on the message. It passes `outgoing`
*and* `unknown`, dropping only a definite `incoming` — deliberately not "equals outgoing",
so that a payload change that drops the field degrades to the trigger's own guarantee
rather than silently dropping every event.

## Idempotency and retries

The HTTP node retries 3× with a 5s gap. This is safe: SIMS inserts into
`respondio_webhook_events` with a UNIQUE `idempotency_key` before processing, so a
redelivery returns `{"status":"duplicate"}`. Tag events are additionally guarded
server-side — a contact with an already-open ticket returns `noop`, never a second ticket,
and a message event against a ticket that is no longer `Open` returns `noop` too.

Rate limit on the endpoint is 60 requests/minute per source IP; all four workflows share
it if n8n has a single egress IP. The outgoing-message workflow is the noisiest of the
four — it fires on every agent message, not once per conversation — so watch that budget
first if the endpoint starts returning 429.

## Verifying

Tag a test contact in Respond.io, then check **General → Integrations → event log**:

- `processed` — ticket created / PIC set / ticket moved to In Progress / ticket closed
- `ignored` — tag didn't match the routing tag, or the assignee event carried no email
- `noop` — no open ticket for that contact, one was already open, or the ticket had
  already moved past `Open`
- `rejected` — the `x-sims-webhook-secret` header is wrong or missing
- `failed` — the body didn't parse; the reason is stored on the row

## Rotating the secret

Rotation in **General → Integrations** keeps the previous key valid for a grace window.
Update the `SIMS Webhook Secret` credential within that window — all four workflows pick
up the new value with no other change.
