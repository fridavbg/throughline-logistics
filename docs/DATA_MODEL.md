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
// Lateness is not a status: it lives in EtaStatus ("at_risk" | "late").
// Problems (incident, stale…) are not a status either: they are ShipmentExceptions.

export type EtaStatus = "on_time" | "at_risk" | "late";

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
  priorityReason: string;
  suggestedAction: NextAction;
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

## 5. Derived values (pure functions in `lib/`)
| Function | Returns | Rule |
|---|---|---|
| `getShipmentStatus(s)` | `ShipmentStatus` | Derived, never stored: from latest completed milestone; `customs_hold` wins |
| `getLastUpdateAt(s)` | `string \| null` | Newest `rawEvents[].receivedAt`; `null` when the operator hasn't reported yet. Computed, so a simulated event can't leave it behind |
| `isStale(s, now)` | `boolean` | Status is `in_transit` or `at_port` and `now - getLastUpdateAt(s) > 24h` |
| `getEtaStatus(s, prediction)` | `EtaStatus` | Best available ETA = `prediction.latest` if confidence ≥ 0.6, else `operatorEta`. Minus `plannedEta`: ≤ 0h `on_time`, ≤ 24h `at_risk`, > 24h `late` |
| `isOverdue(e, now)` | `boolean` | `now > respondBy` |
| `getCurrentLeg(s)` | `Leg` | First leg with an incomplete milestone |
| `canView(user, s)` | `boolean` | Customer: `customerId` match. Ops: `siteIds === "all"` or `originSiteId` in `siteIds` |

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

**Raw events:** every operator update on a seed shipment is a `rawEvents` entry, because the
last update time is computed from them.

**Timestamps:** define every seed time relative to `DEMO_NOW` with a small helper
(e.g. `hoursAgo(31)`, `daysFromNow(2)`), not as hardcoded dates. Exception `detectedAt`
values must give the inbox a realistic mix at `DEMO_NOW`: one overdue, one due in under
10 min, and the rest with comfortable time left.

| Ref | Customer | Route | Legs | Scenario |
|---|---|---|---|---|
| SHP-1042 | Ostrel DE | Terrassa → Hamburg | road → sea → road | On time → late via demo event (vessel delay) |
| SHP-1043 | Thornquist | Zaragoza → Manchester | road → sea → road | Customs hold at Southampton, packing list missing |
| SHP-1044 | Calvera | Terrassa → Valencia | road | Domestic, on time |
| SHP-1045 | Ostrel DE | Porto → Hamburg | road → sea → road | Stale: no update for 31h |
| SHP-1046 | Thornquist | Terrassa → Birmingham | road → sea → road | AI predicts late before operator ETA changes |
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
