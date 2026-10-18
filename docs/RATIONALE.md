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
- The chosen persona is saved in sessionStorage (Zustand `persist`, only the persona id), so a
  reload or a pasted link keeps it and closing the tab resets the demo. The server can't read
  it, so the store is read back after the first render (`skipHydration`) and role pages show a
  skeleton until then, instead of a hydration mismatch or an early redirect to the picker.
- What ops does in the inbox (handled items, approved messages) lives in the store's memory
  only: switching persona keeps it, so an approved message shows up for the customer, and a
  reload starts the demo over. Only an approved message or *Resolve* stops the customer's
  escalation acknowledgement; a snooze or a call to the operator doesn't tell the customer anything.
- Shipment detail (`/shipments/[id]`) is one page per seed shipment, built at deploy time
  (`generateStaticParams`, `dynamicParams = false`), so the demo stays fully static and an
  unknown id gets a real 404. Whether the persona may see it is checked in the browser, and a
  shipment outside their perimeter shows the same "couldn't find" message as an unknown one,
  so a customer can't learn which ids exist. In production this check moves to the server.

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
- Triage weights are starting values too (`lib/ai/triage.ts`): critical 1, warning 0.6; key
  customer 1, standard 0.8. Overdue items get their own band (90–100), so they rank on top
  whatever their weight.
- Response targets (critical 30 min, warning 2 h) and the 0.8 alert threshold are starting
  values to be agreed with the operations team and tuned with real data.
- ETA prediction values are starting values too (`lib/ai/eta.ts`): a delay under 1h is
  ignored, a quarter of a delay can be made up, confidence starts at 0.85 and drops by 0.1
  with customs ahead and 0.3 when stale, but never below 0.6 once a delay has happened:
  the delay is a fact, so a lower score would show a late shipment as on time. The window
  never extends past the known delay, because its end decides lateness: a wider window
  would make shipments look late from uncertainty alone.

**Known limitations**
- All data and AI output are simulated; no real model quality is demonstrated.
- The ETA prediction uses only the latest step's delay, not route history (the PRD's A2
  mentions it): there is no history in synthetic data to learn from. It also gives no
  prediction during a customs hold, because the release time is unknown; the hold is an
  ops exception instead.
- Dates are shown in Spain's time zone for everyone (`formatDay` in `lib/time.ts`), so the
  server, the browser and tests agree on the day. A customer in the UK sees a Spanish date,
  which differs only around midnight; production would use the viewer's time zone.
- Incidents (damage, accidents) aren't detected: no operator feed or field reports one yet, and
  a signal isn't invented. The type, severity and draft exist for when a feed does.
- No authentication: personas simulate access control.
- Real-time updates are simulated with a demo panel.
- No map view; the leg timeline answers "where is it?".
- One time per operator message: `receivedAt` is used both as when a step happened
  (milestone `at`) and as when we last heard from the operator (stale detection). Real
  integrations would carry both: a message sent hours late, such as a batched email, would
  then show the step at the right time without making the shipment look freshly updated. Until
  then, status goes by the furthest step along the route rather than the newest `at`, so a
  late report of a missed step can't move a delivered shipment back to the port. The ETA
  prediction inherits this: a step reported hours after it happened reads as that many
  hours late.
- A second customs hold on the same leg (held, cleared, held again) is ignored when events
  are applied, because a step that already happened isn't repeated. Status stays `at_port`
  instead of `customs_hold`. No demo shipment is held twice (#35).

**Prioritised next steps**
1. Real ingestion for the two highest-volume operators + normalization review queue.
2. Server-side access control and authentication.
3. ETA model trained on historical data, measured against operator ETAs.
4. Customer notification channels (email) with preferences.
5. Conversational assistant grounded in shipment data.
