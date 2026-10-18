# Rationale

## 1. AI in the product

The core problems are fragmented data, uncertain arrival times, and people chasing shipments
manually. AI is used where it removes one of those problems. Its output is always labelled
with its source and confidence, and it never overwrites operator data.

How much automation depends on risk, so customers never wait for a person to see the facts:

| Tier | What | Reaches the customer |
|---|---|---|
| Automatic | Status changes, operator ETAs, summaries, AI ETA predictions in the portal | Within minutes of the operator update (limited by the operator's feed) |
| Automatic above a threshold | Proactive delay alerts | Within minutes if confidence is High; otherwise routed to ops for review |
| Human-approved | Messages written on the company's behalf (incidents, customs issues, commitments) | Within the response target: critical 30 min, warning 2 h |

If an approval-tier item passes its response target, it escalates to the support lead and the
customer automatically receives a factual acknowledgement with no commitments ("We're aware
of an issue with SHP-1043 and are working on it."). The customer always hears something within
the target, even when nobody has acted yet.

An AI prediction decides whether a shipment shows as late from confidence 0.6, but a delay
*alert* needs 0.8. A customer can therefore see "Late" in the portal before getting an alert,
so the ETA status always carries its source: when it comes from the prediction, the badge says
it's AI and shows the confidence.

| Feature | Problem it addresses | In the prototype | In production |
|---|---|---|---|
| **Status normalization** | Every operator uses different formats and vocabularies; some updates arrive by email | Rule/keyword mapping per operator; email parsed with a fixed confidence | Structured feeds (API/EDI) mapped deterministically. Unstructured input (email, PDF) parsed by an LLM with structured output, validated against the schema; low confidence goes to a review queue |
| **ETA prediction** | Operator ETAs update late or not at all | Rule-based delay propagation across legs | Model trained on historical leg durations per lane/operator, plus live signals (vessel position, port congestion). Outputs a range and confidence |
| **Exception triage** | Ops can't see what matters most | Weighted score: severity × customer priority × time left to the response target | Same rules first, tuned with ops feedback on what they actually acted on |
| **Next action + draft** | Repetitive manual follow-ups | Template-based drafts per exception type | LLM drafts grounded in shipment data, with templates and tone guidelines; human approval required |
| **Shipment summary** | Customers need a quick, clear answer | Template from status, leg and ETA | LLM summary from structured data only, with guardrails against stating unconfirmed facts |

**What I deliberately left out:** a free-form chat assistant. It's appealing, but the
summary and proactive alerts answer the customer's main question with far less risk of
inventing information. It's the first candidate for a next step.

## 2. System approach

**Prototype**
- Next.js (App Router) + TypeScript: fast to build, deploys natively on Vercel, and the
  routing maps cleanly to the two roles.
- SCSS Modules: scoped styles with design tokens as CSS custom properties.
- Radix primitives: accessible dialogs, tabs and tooltips without imposing a visual style.
- Zustand: global state is small (current persona, simulated events), so the lightest option.
- Mock data layer mirrors a real integration layer: raw operator payloads → one adapter per
  operator → a single normalized model. Swapping mocks for real feeds changes only the adapters.
- Views that show shipment data are Client Components reading from the Zustand store, which
  holds the current persona and the shipments (seed data plus demo events). Server Components
  can't see either: both live only in the browser, so a server render couldn't filter by role
  or show a simulated event. Static parts (layout, headings) stay Server Components. In
  production, data and access control move to the server (see below).

**Production (proposed)**
- **Ingestion:** operator APIs and webhooks, EDI, inbound email, and optionally a carrier
  visibility aggregator to reduce the number of direct integrations. Vessel position data
  for sea legs.
- **Processing:** event-driven pipeline: raw events stored as received → normalized →
  shipment state recomputed → exceptions and predictions updated.
- **Storage:** PostgreSQL for shipments and events; raw payloads kept for traceability.
- **Freshness:** server push (SSE or websockets) to open views; email/in-app notifications
  for customer alerts.
- **Access control:** enforced server-side by customer, site and role, not just in the UI.

## 3. Assumptions, limitations, next steps

**Assumptions**
- Operators provide updates via API, EDI or email.
- One customer and one origin site per shipment.
- "Stale" = no update for 24h while in transit or at port.
- Response targets (critical 30 min, warning 2 h) and the 0.8 alert threshold are starting
  values to be agreed with the operations team and tuned with real data.

**Known limitations**
- All data and AI output are simulated; no real model quality is demonstrated.
- No authentication: personas simulate access control.
- Real-time updates are simulated with a demo panel.
- No map view; the leg timeline answers "where is it?".
- One time per operator message: `receivedAt` is used both as when a step happened
  (milestone `at`) and as when we last heard from the operator (stale detection). Real
  integrations would carry both: a message sent hours late, such as a batched email, would
  then show the step at the right time without making the shipment look freshly updated.

**Prioritised next steps**
1. Real ingestion for the two highest-volume operators + normalization review queue.
2. Server-side access control and authentication.
3. ETA model trained on historical data, measured against operator ETAs.
4. Customer notification channels (email) with preferences.
5. Conversational assistant grounded in shipment data.
