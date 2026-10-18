# Data Model

All data is synthetic. Types live in `lib/types.ts`; seed data in `data/`.

## 1. Flow
```
data/raw/*  (operator payloads, different formats)
   │  lib/normalize/<operator>.ts   one adapter per operator
   ▼
Shipment[]  (normalized, typed)
   │  lib/access.ts                 filter by the current user's perimeter
   ▼
   │  lib/ai/*                      enrich: ETA prediction, triage, summary
   ▼
components
```

## 2. Demo clock
All time-based logic (stale detection, "updated 3h ago", ETA status) uses a fixed clock:

```ts
// lib/time.ts (kept in lib/ so logic never depends on data/)
export const DEMO_NOW = new Date("2026-10-21T10:00:00+02:00");
```

This keeps the deployed demo identical on every visit. Use `getNow()` from `lib/time.ts`,
never `new Date()` in logic.

## 3. Reference data (`data/seed.ts`)

**Sites** (origin)
| id | name | type | country |
|---|---|---|---|
| `site-terrassa` | Terrassa Plant | factory | ES |
| `site-zaragoza` | Zaragoza Warehouse | warehouse | ES |
| `site-porto` | Porto Plant | factory | PT |

**Customers**
| id | name | type | country | priority |
|---|---|---|---|---|
| `cust-ostrel-de` | Ostrel Deutschland | subsidiary | DE | key |
| `cust-pellow` | Pellow Machinery BV | customer | NL | standard |
| `cust-calvera` | Calvera Suministros | customer | ES | standard |
| `cust-thornquist` | Thornquist Tools Ltd | customer | GB | key |

**Operators** (each reports differently — see §6)
| id | name | modes | feed format |
|---|---|---|---|
| `op-corvala` | Corvala Transport | road | JSON, numeric status codes, ISO timestamps |
| `op-saltwren` | Saltwren Lines | sea | EDI-style event codes (`GIN`, `LOD`, `DEP`…), UTC `YYYYMMDDHHmm` |
| `op-quickfern` | Quickfern | road (last mile) | JSON, free-text English status |
| `op-brennick` | Brennick Freight | road | CSV export, Spanish status text, `DD/MM/YYYY HH:mm` (P2) |

**Users** (demo personas)
| id | name | role | perimeter |
|---|---|---|---|
| `user-summer` | Summer | `customer` | `customerId: cust-ostrel-de` |
| `user-morty` | Morty | `ops` | `siteIds: [site-terrassa]` |
| `user-rick` | Rick | `ops` | `siteIds: all` (support lead) |

## 4. Types (`lib/types.ts`)

```ts
// ---------- Shared ----------
export type OperatorSource = "confirmed" | "estimated";   // AI never writes operator data
export type DataSource = OperatorSource | "ai_predicted";
export type Mode = "road" | "sea";

export type ShipmentStatus =
  | "planned" | "in_transit" | "at_port" | "customs_hold"
  | "delivered";
// Lateness is not a status: it lives in EtaStatus ("at_risk" | "late"; "unknown" when there is no firm answer).
// Problems (incident, stale…) are not a status either: they are ShipmentExceptions.

export type EtaStatus = "on_time" | "at_risk" | "late" | "unknown";
export type EtaStatusWithSource = { status: EtaStatus; source: DataSource };  // who says it's late

// ---------- Reference ----------
export type Site = { id: string; name: string; type: "factory" | "warehouse"; country: string };
export type Customer = {
  id: string; name: string; type: "customer" | "subsidiary"; country: string;
  priority: "standard" | "key";   // used by triage
};
export type Operator = { id: string; name: string; modes: Mode[] };
export type Location = { name: string; country: string; kind: "site" | "port" | "customer" };

export type User =
  | { id: string; name: string; role: "customer"; customerId: string }
  | { id: string; name: string; role: "ops"; siteIds: string[] | "all" };

// ---------- Shipment ----------
export type MilestoneType =
  // road
  | "picked_up" | "in_transit" | "delivered"
  // sea
  | "gate_in" | "loaded" | "departed" | "arrived" | "discharged"
  // customs (only when requiresCustoms)
  | "customs_submitted" | "customs_hold" | "customs_cleared";

export type Milestone = {
  type: MilestoneType;
  at: string | null;            // ISO; null = not happened yet
  plannedAt: string;            // ISO
  source: OperatorSource;
  rawStatus?: string;           // operator's original text/code
};

export type Leg = {
  sequence: number;             // 1, 2, 3… order of travel
  mode: Mode;
  operatorId: string;
  from: Location;
  to: Location;
  milestones: Milestone[];      // sorted by plannedAt
};

export type Eta = {               // the operator's ETA; AI predictions are EtaPrediction
  date: string;                 // ISO
  source: OperatorSource;
};

export type DocumentType =
  | "commercial_invoice" | "packing_list" | "bill_of_lading" | "customs_declaration" | "cmr";

export type ShipmentDocument = {
  type: DocumentType;
  status: "available" | "missing";
  required: boolean;
};

export type Shipment = {
  id: string;                   // "SHP-1042"
  customerId: string;
  originSiteId: string;
  international: boolean;       // crosses a border
  requiresCustoms: boolean;     // leaves the EU customs area (e.g. ES → GB)
  legs: Leg[];                  // sorted by sequence
  operatorEta: Eta;             // from the operator (confirmed | estimated)
  plannedEta: string;           // ISO, promised at booking
  documents: ShipmentDocument[];
  rawEvents: RawEventRef[];     // traceability for ops view; newest = last update
};

export type RawEventRef = {
  operatorId: string;
  receivedAt: string;
  channel: "api" | "edi" | "email" | "csv";
  original: string;             // exactly as received
  normalizedTo: MilestoneType | null;
  confidence: number;           // 0–1, 1 for structured feeds
};

// ---------- Computed / AI (never stored on Shipment) ----------
export type EtaPrediction = {
  earliest: string;
  latest: string;
  confidence: number;           // 0–1
  reason: string;               // "Vessel departed 26h late from Valencia"
  source: "ai_predicted";
};

export type ShipmentSummary = {    // A5, shown to customers with the AI label
  points: string[];             // short points: where, arrival + on time?, quiet operator, next
  confidence: number;           // 0–1
  reason: string;               // "Operator estimate; last update 2h ago"
};

export type ExceptionType =
  | "delay" | "customs_hold" | "stale" | "missing_document" | "incident" | "needs_review";
export type NextAction =
  | "notify_customer" | "contact_operator" | "request_document" | "review_update";
export type Severity = "critical" | "warning";   // critical: customs_hold, incident

export type ShipmentException = {
  id: string;
  shipmentId: string;
  type: ExceptionType;
  detectedAt: string;
  severity: Severity;
  respondBy: string;            // detectedAt + 30 min (critical) or 2 h (warning)
  impact: string;               // "ETA +2 days"
  priorityScore: number;        // 0–100, from triage
  priorityReason: string;       // "Overdue by 10 min · Critical: customs hold · Key customer"
  suggestedAction: NextAction;
  actionReason: string;         // "Customs needs the packing list"
  confidence: number;           // 0–1: the prediction's for an AI delay, else 0.95
};

export type DetectedException = Omit<ShipmentException, "priorityScore" | "priorityReason">;

export type NotificationDraft = {  // A4: an ops user edits and approves; never sent automatically
  exceptionId: string;
  shipmentId: string;
  customerId: string;
  subject: string;
  body: string;                 // facts from the shipment only
};

export type CustomerAlert = {
  id: string;
  shipmentId: string;
  severity: "info" | "warning" | "critical";
  message: string;
  createdAt: string;
  source: DataSource;           // e.g. ai_predicted delay vs confirmed customs hold
  confidence?: number;          // set when source is ai_predicted; alerts need ≥ 0.8
};
```

## 5. Derived values (pure functions in `lib/derived.ts`, `lib/access.ts`, `lib/customer.ts`, `lib/exceptions.ts` and `lib/ai/`)
| Function | Returns | Rule |
|---|---|---|
| `getShipmentStatus(s)` | `ShipmentStatus` | Derived, never stored: an unresolved `customs_hold` (no `customs_cleared` at or after it, by `at`) wins. Otherwise from the furthest completed milestone along the route (leg, then `plannedAt`), not the newest `at`: `at` is the receipt time, so a late report of a missed step would move the shipment backwards. `delivered` on an earlier leg means `at_port`; only on the last leg is the shipment `delivered`. No milestone done: `planned` |
| `getFurthestStep(s)` | `{ milestone, leg } \| undefined` | The completed milestone furthest along the route (leg, then `plannedAt`), never a `customs_hold`; `undefined` before the first step. Shared by `getShipmentStatus` and `predictEta` so both agree on where the shipment is |
| `getLastUpdateAt(s)` | `string \| null` | Newest `rawEvents[].receivedAt`; `null` when the operator hasn't reported yet. Computed, so a simulated event can't leave it behind |
| `isStale(s, now)` | `boolean` | Status is `in_transit` or `at_port` and `now - getLastUpdateAt(s) > 24h` |
| `getEtaStatus(s, prediction?)` | `EtaStatusWithSource` | Best available ETA = `prediction.latest` if confidence ≥ 0.6, else `operatorEta` (also when there is no prediction). Minus `plannedEta`: ≤ 0h `on_time`, ≤ 24h `at_risk`, > 24h `late`. `unknown` during a customs hold (the release time is unknown) and when either date can't be read. `source` is `ai_predicted` when the prediction was used, else the operator ETA's source, so the UI can label who says it's late |
| `isDelayed(status)` | `boolean` | `at_risk` or `late`. Never `unknown`: no firm answer, so no delay exception or customer alert comes from it |
| `predictEta(s, now)` | `EtaPrediction \| undefined` | Simulated AI (A2). None when `planned`, `delivered` or `customs_hold`, or when nothing is known: furthest step < 1h late and not stale. Known delay: `latest` = `plannedEta` + delay, `earliest` = `plannedEta` + 75% of it; none if `operatorEta` is already at or after `latest`. Confidence 0.85, −0.1 while customs is ahead, −0.3 when stale, never below 0.6 (a delay that has happened always counts). Stale with no known delay: `plannedEta` to `plannedEta` + hours since the last update, confidence 0.5 (Needs review). Never changes the shipment |
| `summarizeShipment(s, now)` | `ShipmentSummary` | Simulated AI (A5). Short points: where it is (current leg, port of the latest step, customs hold place, or delivery), the arrival worded by its source ("arriving" only when confirmed, "(operator estimate)", "AI predicts" only at confidence ≥ 0.6) with on time / up to a day late / more than a day late from `getEtaStatus`, a "No operator update for 31h" point when stale, and the next step not yet done. Customs hold: no date, the release time is unknown. Stale without a known delay: no on-time claim. Confidence = the `predictEta` confidence if any (so 0.5 when stale), else 0.95. Dates as `EEE d MMM` in Spain's time zone (`formatDay`) |
| `customerShipments(list, now)` | `CustomerShipment[]` | F4. Each shipment with status, `getEtaStatus`, a prediction only at confidence ≥ 0.6, the summary, and `delivery` (`at`, `source`) once delivered. Late, at risk, ETA unknown, on time, then delivered (newest first); within a group the earliest arrival first, an unreadable date last. Deliveries older than 30 days drop out |
| `countByEta(views)` | `EtaCounts` | Active shipments by `etaStatus` (including `unknown`), plus `delivered`; from the same list as the cards so they always match |
| `customerAlerts(views)` | `CustomerAlert[]` | Only an AI prediction with confidence ≥ 0.8 that makes the shipment at risk or late (PRD §6); dated when the late step was reported. Newest first |
| `isOverdue(e, now)` | `boolean` | `now > respondBy` |
| `detectExceptions(s, now)` | `DetectedException[]` | A3 rules, one row per problem. `customs_hold`: unresolved hold, detected when reported; a missing required document is folded in (action `request_document`, else `contact_operator`). `missing_document`: required and missing, not held or delivered; detected `now` (documents carry no time). `stale`: `isStale`, detected at last update + 24h, `contact_operator`. `delay`: `getEtaStatus` at risk or late (never `unknown`), not held or delivered; from an AI prediction it's detected at the furthest step and its action is `contact_operator` when confidence ≥ 0.8 (the customer was alerted) else `notify_customer`; from the operator ETA, `notify_customer`. `needs_review`: the latest raw event is unread or below 0.6, `review_update`. `incident`: never detected, nothing reports one yet. `respondBy` = `detectedAt` + 30 min (critical: hold, incident) or 2 h |
| `rankExceptions(list, customers, now)` | `ShipmentException[]` | A3 triage. Weight = severity (critical 1, warning 0.6) × customer priority (key 1, standard 0.8). Overdue: score 90 + 10 × weight. Otherwise 89 × weight × urgency, urgency from 0.5 (just detected) to 1 (at the deadline). Highest first, then earliest deadline, then id |
| `draftNotification(e, s, customer, now)` | `NotificationDraft \| undefined` | A4. Only when the action writes to the customer (`notify_customer`, `request_document`). Templates per type with shipment facts only: AI arrival "(our estimate)", operator "(the carrier's estimate)", a delay within the planned day in hours; a hold names the missing document and never a release date. None for `stale` and `needs_review` |
| `inboxItems(list, customers, sites, handledIds, now)` | `InboxItem[]` | F2 (`lib/inbox.ts`). `rankExceptions` for the persona's shipments, minus handled ones, each with customer, origin site and draft |
| `filterInbox(items, filter)` | `InboxItem[]` | Exception type and origin site, both optional, order kept |
| `responseLabel(e, now)` | `{ text, tone }` | "Overdue · escalated" past `respondBy`; "Respond within 8 min", amber under 10 min |
| `approvedAlert(draft, severity, text, now)` | `CustomerAlert` | The message as ops edited it, `source: confirmed`; only built on approval |
| `escalationAlerts(exceptions, approvedIds, now)` | `CustomerAlert[]` | PRD §6: an overdue exception whose action writes to the customer and whose draft isn't approved gives "We're aware of an issue with SHP-1043 and are working on it.", dated at `respondBy` |
| `getCurrentLeg(s)` | `Leg \| undefined` | The latest leg with a completed milestone, or the next leg once all its milestones are done, so a skipped operator report doesn't hold it back. First leg before departure, last leg once delivered; `undefined` only without legs |
| `canView(user, s)` | `boolean` | Customer: `customerId` match. Ops: `siteIds === "all"` or `originSiteId` in `siteIds` |
| `visibleShipments(user, list)` | `Shipment[]` | The shipments `canView` allows, in the same order |

## 6. Raw operator formats (`data/raw/`)
The same real-world event ("left the port") looks different per operator. Adapters map
each to a `MilestoneType`.

**Corvala Transport (JSON, numeric codes)**
```json
{ "shipment_ref": "SHP-1042", "status_code": 30, "ts": "2026-10-17T08:15:00+02:00" }
```
`10 → picked_up`, `20 → in_transit`, `30 → delivered`

**Saltwren Lines (EDI-style)**
```
SHP-1042|DEP|ESVLC|202610180630
```
`GIN → gate_in`, `LOD → loaded`, `DEP → departed`, `ARR → arrived`, `DIS → discharged`

**Quickfern (free text)**
```json
{ "ref": "SHP-1047", "update": "Delivered - signed by R. Gomez", "time": "2026-10-20T15:40:00Z" }
```
Keyword matching → `in_transit` / `delivered`; unknown text → `null` + low confidence.

**Brennick Freight (CSV, Spanish)**
```
referencia;estado;fecha
SHP-1051;Recogido en origen;19/10/2026 11:20
```
`Recogido en origen → picked_up`, `En tránsito → in_transit`, `Entregado → delivered`

**Email (unstructured, AI normalization demo)**
```
Subject: RE: SHP-1043 container status
Hi, the container is held by UK customs at Southampton pending the packing list. Will advise.
```
→ `customs_hold`, confidence 0.82, flags `packing_list` as missing.

## 7. Seed scenarios
Every shipment exists to demonstrate something. Build SHP-1042 → SHP-1050 first (P0, covers
every demo step); SHP-1051 → SHP-1055 are P2 and add variety.

**Building shipments:** `data/bookings.ts` holds each booked plan, `data/raw` the operator
feeds, and `getShipments()` (`data/shipments.ts`) is the single entry point that applies them
with `applyEvents` (`lib/shipments.ts`):
- an event completes the first matching step on **one** leg run by that operator;
- a step that already happened isn't changed again, and an exact duplicate message is stored once;
- events below 0.6 confidence are kept for review but don't change the timeline;
- unplanned steps (a customs hold) are added to the leg the operator is working on.

Customs milestones sit on the sea leg, after `discharged`, at the arrival port. Seed emails carry
a precomputed reading; the email normalizer is #19.

**Exception timing:** an exception's `detectedAt` is the arrival time of the operator event
that revealed it (a stale shipment: last update + 24h). Seed events are timed so the inbox at
`DEMO_NOW` has one overdue item (SHP-1043 customs hold), one due within 10 min (SHP-1045
stale) and the rest with at least 30 min left.

**Raw events:** every operator update on a seed shipment is a `rawEvents` entry, because the
last update time is computed from them.

**Timestamps:** define every seed time relative to `DEMO_NOW` with a small helper
(e.g. `hoursAgo(31)`, `daysFromNow(2)`), not as hardcoded dates. Exception `detectedAt`
values must give the inbox a realistic mix at `DEMO_NOW`: one overdue, one due in under
10 min, and the rest with comfortable time left.

| Ref | Customer | Route | Legs | Scenario |
|---|---|---|---|---|
| SHP-1042 | Ostrel DE | Terrassa → Hamburg | road → sea → road | Vessel left Valencia 26h late, 1h ago; operator ETA unchanged. AI predicts late with High confidence (0.85), so the customer is alerted. In the seed because F6 (demo panel) is cut, so demo step 6 has its delay |
| SHP-1043 | Thornquist | Zaragoza → Manchester | road → sea → road | Customs hold at Southampton, packing list missing (the one overdue item: tops the inbox) |
| SHP-1044 | Calvera | Terrassa → Valencia | road | Domestic, on time |
| SHP-1045 | Ostrel DE | Porto → Hamburg | road → sea → road | Stale: no update for ~26h (due for review in under 10 min). AI prediction 0.5: Needs review |
| SHP-1046 | Thornquist | Terrassa → Birmingham | road → sea → road | Vessel left Barcelona ~24h late; AI predicts at risk before the operator ETA changes. Medium confidence (0.75, customs ahead), so it becomes an ops exception, not a customer alert |
| SHP-1047 | Calvera | Zaragoza → Murcia | road | Delivered |
| SHP-1048 | Pellow | Terrassa → Rotterdam | road → sea → road | Low-confidence email update (0.45) → `needs_review`. Arrives via the demo event if F6 is built, otherwise included in seed |
| SHP-1049 | Ostrel DE | Zaragoza → Hamburg | road | Long-haul road, at risk |
| SHP-1050 | Thornquist | Porto → Leeds | road → sea → road | Planned, not departed |
| SHP-1051 | Calvera | Porto → Madrid | road | Brennick Freight CSV feed, in transit |
| SHP-1052 | Ostrel DE | Terrassa → Hamburg | road → sea → road | Delivered (history) |
| SHP-1053 | Pellow | Zaragoza → Antwerp | road | Incident: damaged pallet reported |
| SHP-1054 | Thornquist | Terrassa → Southampton | road → sea | At port, on time |
| SHP-1055 | Calvera | Terrassa → Sevilla | road | Missing CMR document |

Mix of origin sites ensures the Terrassa ops persona sees a subset, and the support lead sees all.
