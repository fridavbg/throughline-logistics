# PRD — Throughline

## 1. Problem
Industrial manufacturers often ship from several factories and warehouses to customers and
subsidiaries, domestically and internationally. Shipments travel with several logistics
operators, by road and sea, often combining both in one shipment (road → port → vessel →
port → road), with customs when goods leave the EU (e.g. to the UK).

Usually there is no single place to see shipment status. Tracking is spread across each operator's
portal, email and phone calls. Each operator reports in its own format and status vocabulary.

**Goal:** one consolidated, reliable, end-to-end view of every shipment, with intelligence
that surfaces problems early and guides people toward resolving them.

## 2. Users

| Role | Who | Core question | Sees |
|---|---|---|---|
| **Customer** | A customer or subsidiary (self-service) | "Is it on time, and when does it arrive?" | Only their own shipments |
| **Operations** | Logistics / customer support staff | "What needs my attention right now?" | Shipments for their sites |

## 3. Objectives
- **Customer:** know where a shipment is, whether it's on time and when it arrives, without
  calling anyone. Hear about problems *before* they happen.
- **Operations:** stop chasing shipments one by one. The system highlights what matters and
  proposes the next action.

## 4. Product principles
1. **Never invent data.** Every status and ETA shows its `source`: confirmed by the operator,
   estimated by the operator, or predicted by AI.
2. **Manage by exception.** Ops starts from what is wrong, not from a list of everything.
3. **Automation matches risk.** Facts and confident predictions reach customers immediately,
   clearly labelled. Messages written on the company's behalf are drafted by AI and approved
   by an ops user.
4. **Freshness is visible.** Every shipment shows when it was last updated; stale data is flagged.

## 5. Scope — in

### Priorities
The goal is a complete end-to-end story for both roles before adding breadth.
Build in priority order; P2 is cut first if time runs short.

| Priority | Features | Why |
|---|---|---|
| **P0** must ship | F1, F2, F4, F5 · A1 (structured feeds), A2, A3, A4, A5 | Both roles served end to end, AI visible in each |
| **P1** if time allows | F6 demo panel · A1 email parsing | Shows freshness and unstructured normalization live |
| **P2** cut first | F3 portfolio table · Brennick Freight (4th operator) · seed data beyond 10 shipments | Adds breadth, not new insight |

If F6 is cut, the demo script starts from seed data that already contains the delay
and customs scenarios (step 4 is skipped).

### F1. Demo login (role picker) · P0
Pick a persona to enter the app. No real auth.
- **Personas:** Customer (Ostrel Deutschland), Ops (Terrassa site), Ops (all sites, support lead).
- **AC:** choosing a persona routes to that role's home; a switcher in the header changes
  persona at any time; each persona only sees its own perimeter.

### F2. Ops — Attention inbox (home) · P0
A ranked list of shipments that need action.
- **Exception types:** `delay`, `customs_hold`, `stale`, `missing_document`, `incident`,
  `needs_review` (low-confidence update or prediction).
- **Severity and response target:** critical (`customs_hold`, `incident`) 30 min;
  warning (all others) 2 h.
- Each item shows: shipment ref, customer, route, exception type, impact (e.g. "ETA +2 days"),
  time since detected, **time left to respond** ("Respond within 25 min"), and an
  **AI-suggested next action**.
- **AC:**
  - Sorted by AI priority score; the reason for the rank is visible on hover/expand.
  - Items past their response target show "Overdue · escalated" and stay at the top.
  - Filter by exception type and site.
  - Actions per item: *Notify customer* (opens AI draft), *Contact operator*, *Request document*.
  - Resolving or snoozing an item removes it from the list (local state only).
  - Empty state: "Nothing needs attention right now."

### F3. Ops — Shipment portfolio · P2
Table of all shipments in the user's perimeter.
- **Columns:** ref, customer, origin site, destination, current mode, operator, status,
  ETA (with source), last update.
- **AC:** filter by site, operator, mode, status; search by ref or customer; stale rows
  flagged; rows collapse into cards below the `md` breakpoint.

### F4. Customer — My shipments · P0
- **Summary bar:** counts of on time / at risk / late / delivered (last 30 days).
- **Shipment cards:** ref, destination, `etaStatus` badge, ETA date with source, one-line
  AI summary.
- **Alerts panel:** proactive alerts ("Your shipment SHP-1042 is likely to arrive about a day late").
  AI-predicted alerts appear only with High confidence and are labelled as predictions.
- **AC:** only the customer's own shipments; at-risk and late shipments listed first; works
  well on a phone.

### F5. Shipment detail (shared, adapts to role) · P0
- **Header:** ref, route, `ShipmentStatus`, `etaStatus`, ETA block.
- **ETA block:** operator ETA (`confirmed` or `estimated`) and, if different, the AI-predicted
  range with confidence and reason. The two are visually distinct.
- **Leg timeline:** legs in sequence; each leg shows mode, operator, from → to, and its
  milestones (done / current / upcoming) with timestamps and `source`.
- **Customs** step shown for shipments that require customs (leaving the EU).
- **Documents:** list (commercial invoice, packing list, bill of lading, customs declaration)
  with status `available` / `missing`.
- **Ops only:** raw operator messages (original text next to the normalized status),
  exception history, action buttons.
- **Customer only:** plain-language summary, contact-support link.
- **AC:** unknown id shows a friendly not-found page; a customer cannot open another
  customer's shipment (not-found, not an error).

### F6. Demo panel (event simulator) · P1
A small floating panel that pushes scripted events into the app, so anyone running the demo can see the
system react in real time.
- **Events** (each targets one seed shipment):
  - "Vessel delayed at Valencia" → SHP-1042 becomes late; customer alert + ops exception.
  - "Email update received" → SHP-1048 gets a low-confidence update; `needs_review` exception.
  - "Delivery confirmed" → SHP-1044 delivered; its exception (if any) is cleared.
- **AC:** triggering an event updates the shipment timeline, recomputes ETA prediction and
  `etaStatus`, adds a customer alert, and adds/removes an ops exception, all without reload.
  A "Reset demo" button restores the seed state.

## 6. AI features (simulated)
All AI output carries an AI marker, a confidence level, and a short "why".
Logic lives in `lib/ai/` as deterministic functions over the mock data.

| # | Feature | Where | What it does | Why it's worth it |
|---|---|---|---|---|
| A1 | **Status normalization** (structured feeds P0, email P1) | Detail (ops), demo email event | Maps raw operator text/codes to `ShipmentStatus` with confidence; low confidence is flagged for review | Core value of the product: heterogeneous formats → one vocabulary |
| A2 | **ETA prediction** | ETA block, customer cards | Predicts an arrival range from leg progress, known delays and route history; gives the main reason | Customers hear about delays before the operator updates its ETA |
| A3 | **Exception triage** | Ops inbox | Scores exceptions by severity × customer priority × time left to the response target, and ranks them | Ops works on what matters first, before targets are missed |
| A4 | **Next best action + draft message** | Ops inbox, detail | Suggests the action; drafts the customer notification for an ops user to edit and approve | Removes repetitive writing; keeps a human in control |
| A5 | **Shipment summary** | Customer cards, detail | A few plain-language points: where it is, whether it's on time, what happens next | Answers the customer's real question at a glance |

**Rules**
- AI never overwrites operator data; predictions are stored and shown separately.
- Confidence below 0.6 → show "Needs review" (ops) or "Awaiting update" (customers) instead of a firm answer.
- **Customer delivery tiers:**
  - *Automatic:* status, operator ETA, summary (A5) and ETA prediction (A2) shown in the portal.
  - *Automatic above threshold:* proactive delay alerts go out only with High confidence (≥ 0.8);
    lower confidence creates an ops exception instead.
  - *Human-approved:* drafted messages (A4) are never sent automatically. If not approved
    within the response target, the item escalates and the customer gets a factual
    acknowledgement with no commitments.

## 7. Scope — out (and why)
| Out | Why |
|---|---|
| Real backend, auth, integrations | Prototype is frontend-only; integration approach is described in the rationale |
| Interactive map | High effort, low decision value; the leg timeline answers "where is it" more clearly |
| Natural-language chat assistant | Strong next step, but the summary + alerts cover the core customer need with less risk |
| Document upload / storage | Shown as status only; upload is a "Request document" action |
| Notification channels (email/SMS) | Shown as in-app alerts; channels are a production concern |
| Settings, user management, analytics | Not needed to demonstrate the core value |

## 8. Demo script (≈ 3 min)
1. **Ops (all sites)** → attention inbox: a customs hold is ranked first; expand to see why.
2. Open it → timeline shows the sea leg and customs step; raw operator message next to the
   normalized status.
3. *Notify customer* → review the AI draft → approve.
4. Demo panel → "Vessel delayed at Valencia" → a new delay exception joins the inbox, ranked
   by triage (below the overdue customs hold).
5. Switch to **Ops (Terrassa)** → only Terrassa shipments are visible; the inbox is shorter.
6. Switch to **Customer (Ostrel Deutschland)** → alert for that delay; card shows "Late"
   with the AI-predicted range next to the operator ETA.
7. Open detail → plain-language summary, timeline, documents.

## 9. Assumptions
- Operators provide updates via API, EDI or email; the prototype mocks all three.
- A shipment has one customer and one origin site.
- "Stale" = in transit or at port with no operator update for more than 24h.
- Response targets: critical 30 min, warning 2 h. AI delay alerts go to customers at ≥ 0.8 confidence.
- The demo runs at a fixed time (`DEMO_NOW`) so results are the same on every visit.
