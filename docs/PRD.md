# 📄 Product Requirements Document (PRD)

## Unified Engagement Platform for Support, Sales & Renewal Teams

---

## 🧾 1. TL;DR

We're building a centralized **Support, Sales, and Renewal Engagement Platform** to unify multi-channel messaging (starting with WhatsApp), automate ticketing and renewals, enable scheduling, link every message to the correct POS outlet, and provide full CSAT and analytics dashboards — all within a scalable, role-based, PDPA-compliant system.

---

## 🛠 2. Problem Statement

Current workflows are fragmented: separate tools for messaging, ticketing, sales leads, onboarding scheduling, renewal management, and customer history. This causes:

* Slow first-response times and repeated manual tasks
* Lead leakage and inconsistent handoffs
* Poor visibility into account-level history
* Missed renewals and high churn risk
* No insight into support quality or ticket trends

We need a single, scalable platform for all merchant-facing teams.

---

## 🎯 3. Goals

### 🟢 Business Goals

* 40% reduction in manual workload
* First response time (FRT) under 5 minutes
* CSAT +20% within 2 months of launch
* 60% failed-renewal recovery rate
* 10% winback conversion for churned outlets
* Full analytics visibility (top ticket types, top merchants, agent performance)

### 👤 User Goals

* Agents: respond faster with full merchant context, canned replies, and auto-FID/OID mapping
* Sales: qualify leads, assign quickly, book onboarding
* Renewal: automate reminders, track payment recovery
* Ops: monitor CSAT, SLA breaches, ticket trends, and merchant-level activity

### ❌ Non-Goals

* Full CRM
* Social channels beyond WhatsApp (future phases)
* LLM auto-agent replies (MVP is human-in-the-loop only)

---

## 📦 4. Core Features (MoSCoW Prioritized)

### ✅ Must-Have

* WhatsApp Cloud API integration (webhooks, templates, media, rate limits)
* Unified Inbox with role-based access, threaded view, collision control
* Ticketing system linked to FID/OID (with fallback disambiguation)
* SLA timers (FRT ≤ 5 min), ticket categories, statuses, internal notes, outcomes
* Auto-send CSAT on resolution (1–5 rating + optional comment)
* Renewal system based on outlet.expiry_date with message cadence (D-14, D-7, D-1, D+3)
* POS sync (daily) to fetch franchise/outlet metadata + expiry
* RBAC for roles (agent, sales, renewal, admin)
* Analytics dashboard: CSAT, ticket volume, FRT, ART, top issues, top merchants
* Data export, retention policy, PDPA compliance (right to erasure, audit log)

### 🟡 Should-Have

* Auto-classify inbound messages as lead vs support
* Lead capture (WhatsApp prompt, manual entry)
* Onboarding scheduling (real-time calendar, ICS, reminders)
* Internal KB lookup + canned replies
* BM language support
* Secondary channels: Email and web forms

### 🟠 Could-Have

* SSO (Google/Microsoft/Okta)
* QA tools (scorecards, conversation review)
* Customer portal for merchants

### ❌ Won’t-Have

* CRM replacement
* IG/FB integration (non-MVP)
* AI-only agents

---

## 🔄 5. Functional Workflows

### Inbound Ticket Flow

1. Merchant sends WhatsApp message
2. Ingestor verifies + emits event → creates/updates ticket
3. FID/OID resolved via phone → POS lookup
4. SLA timer starts; agent assigned
5. Agent triages with canned replies, internal notes
6. On resolve → CSAT sent; ticket archived

### Sales Lead Flow

1. New contact → prompt for name, biz, interest
2. If lead → auto-create lead ticket, route to sales manager
3. Sales rep follows up; books onboarding
4. Onboarding calendar shared with Merchant Success team

### Renewal Flow

1. Daily sync pulls outlet.expiry_date
2. Scheduler computes due renewals (within 60d)
3. WhatsApp template reminders sent (D-14, D-7, D-1, D+3)
4. Status updated based on reply or POS API push
5. Recovery attempt logged (with cap on attempts)

### CSAT Flow

1. On ticket `Resolved` → send CSAT template
2. User taps 1–5; optional comment
3. Aggregated by ticket, agent, FID/OID; used in dashboards

---

## 📊 6. Analytics & Insights

* Ticket volume: total, by category, by agent, by merchant
* SLA performance: FRT, ART, backlog aging
* CSAT: score distribution, response rate, agent-specific
* High-touch merchants: outlets with 5+ tickets/month
* Export: CSV, scheduled email summary
* Reopen rate tracking (recurring issues)

---

## ⚙️ 7. Technical Architecture

**Components:**

* WhatsApp Ingestor (webhook handler, signature verify)
* Conversation Orchestrator (template/session logic, retries)
* Ticket Service (CRUD, SLA timers, FID/OID linking, audit log)
* Renewal Scheduler (from outlet.expiry_date)
* CSAT Engine (on resolve trigger)
* POS Adapter (contact → outlet mapping, daily sync)
* Admin Portal (React UI, Inbox, ticket views, dashboards)
* AuthZ: Email/pass login + scoped RBAC (FID/OID scope)

**Infra:**

* MySQL 8.4 (tickets, renewals, users, POS metadata)
* Redis (session, rate limits)
* RabbitMQ (ingestion queue, retries, DLQ)
* MinIO (media files)
* Dockerized apps deployed via Coolify to VPS (Kuala Lumpur)
* TLS via Let’s Encrypt

**Security:**

* PDPA compliant (opt-in, erasure, least-privilege)
* Webhook signature verify
* Role + outlet scope enforcement
* IP allow-listing for admin UI access

---

## 🧠 8. Data Model (Key Tables)

* `ticket(fid, oid, contact_id, status, category, assigned_user, timestamps)`
* `contact(wa_phone_e164, display_name, email)`
* `contact_outlet(contact_id, oid)` ← resolution table
* `csat_response(ticket_id, rating, comment, responded_at)`
* `renewal(fid, oid, due_date, status)` ← computed from `outlet.expiry_date`
* `renewal_attempt(renewal_id, channel, template, result)`
* `message(ticket_id, wa_message_id, content, media_sha256)`
* `user_scope(user_id, fid, oid)` ← RBAC scope

---

## 📅 9. Milestones

**M1 – Ingestion & Ticketing (2 weeks)**

* WhatsApp webhook, ticket creation, FID/OID linking, inbox UI

**M2 – POS Sync + Metadata (1 week)**

* Daily sync of franchises/outlets; contact → outlet resolution

**M3 – Renewal & Scheduler (1 week)**

* Compute renewal reminders; frequency-capped WhatsApp sends

**M4 – CSAT Engine (0.5 week)**

* Trigger 1–5 rating on resolved; dashboards

**M5 – Sales Flow (1 week)**

* Lead capture, manual entry, assignment, onboarding scheduler

**M6 – Analytics Dashboard (1 week)**

* Ticket trends, CSAT, merchant insights

**M7 – Security & Compliance (1 week)**

* PDPA tools, audit log, rate limits, TLS

**M8 – Go-Live (0.5 week)**

* UAT, monitoring, backup validation, launch support

---

## ✅ 10. Success Metrics

| Metric                         | Target               |
| ------------------------------ | -------------------- |
| FRT (Median)                   | < 5 mins             |
| CSAT Response Rate             | > 60%                |
| Failed Renewal Recovery        | > 60%                |
| Winback Success                | > 10%                |
| Manual Workload Reduction      | > 40%                |
| CSAT + Score Delta             | +20% within 2 months |
| Top Merchants by Ticket Volume | Auto-flagged         |

---

## 📌 11. Final Notes

* System will launch with WhatsApp as the only messaging channel, followed by email/web forms.
* All messages and actions logged with audit trail.
* Future extensions: LLM agent replies, customer portal, multilingual auto-replies.
* Codebase will be containerized and deployed via Coolify with CI/CD.
* Initial templates (CSAT + Renewal Reminders) will be defined and localized (EN/BM).

> Updated per technical specification in TDD document【36†TDD.md】.
