/**
 * The normalized domain model, shared by every layer of the app.
 * Operator feeds are converted into these types, and the UI only ever reads these.
 * Spec: docs/DATA_MODEL.md §4. All times are ISO 8601 strings.
 */

// ---------- Shared ----------

/**
 * Where an operator's own data comes from: confirmed or estimated by the operator.
 * AI never writes operator data, so an AI value in an operator field doesn't compile.
 */
export type OperatorSource = "confirmed" | "estimated";

/**
 * Where a value comes from: the operator, or a prediction by our AI.
 * Every time and status in the UI shows one of these.
 */
export type DataSource = OperatorSource | "ai_predicted";

/** How a leg travels. */
export type Mode = "road" | "sea";

/**
 * Where the shipment is, as shown in the UI. Worked out from its milestones, never stored.
 * Lateness is not a status: "at risk" and "late" live in {@link EtaStatus}. Problems such
 * as an incident aren't a status either: they are exceptions in the ops inbox
 * ({@link ShipmentException}).
 */
export type ShipmentStatus =
  | "planned"
  | "in_transit"
  | "at_port"
  | "customs_hold"
  | "delivered";

/**
 * Whether the shipment will arrive when promised.
 * Separate from {@link DataSource}: one says how sure we are, this says how it's going.
 */
export type EtaStatus = "on_time" | "at_risk" | "late";

/**
 * An {@link EtaStatus} together with whose ETA it was judged from, so the UI can say who
 * thinks the shipment is late: the operator, or our AI prediction.
 */
export type EtaStatusWithSource = {
  status: EtaStatus;
  source: DataSource;
};

// ---------- Reference ----------

/** A factory or warehouse that shipments leave from. */
export type Site = {
  id: string;
  name: string;
  type: "factory" | "warehouse";
  /** ISO country code, e.g. "ES". */
  country: string;
};

/** A company that receives shipments: an outside customer or one of our subsidiaries. */
export type Customer = {
  id: string;
  name: string;
  type: "customer" | "subsidiary";
  /** ISO country code, e.g. "DE". */
  country: string;
  /** Key customers rank higher when ops triages exceptions. */
  priority: "standard" | "key";
};

/** A logistics company that moves one or more legs of a shipment. */
export type Operator = {
  id: string;
  name: string;
  /** The transport modes this operator handles. */
  modes: Mode[];
};

/** A named place where a leg starts or ends. */
export type Location = {
  name: string;
  /** ISO country code, e.g. "GB". */
  country: string;
  kind: "site" | "port" | "customer";
};

/**
 * A demo persona. Customers see only their own shipments; ops users see only the
 * shipments leaving their sites, or every site when `siteIds` is "all".
 */
export type User =
  | { id: string; name: string; role: "customer"; customerId: string }
  | { id: string; name: string; role: "ops"; siteIds: string[] | "all" };

// ---------- Shipment ----------

/**
 * A step a leg passes through. Road and sea legs have different steps; the customs
 * steps only appear on shipments that leave the EU.
 */
export type MilestoneType =
  // road
  | "picked_up"
  | "in_transit"
  | "delivered"
  // sea
  | "gate_in"
  | "loaded"
  | "departed"
  | "arrived"
  | "discharged"
  // customs (only when the shipment requires customs)
  | "customs_submitted"
  | "customs_hold"
  | "customs_cleared";

/** One step on a leg: when it was planned and, once it has happened, when it did. */
export type Milestone = {
  type: MilestoneType;
  /** When it happened. `null` means it hasn't happened yet. */
  at: string | null;
  /** When it was supposed to happen. */
  plannedAt: string;
  source: OperatorSource;
  /** The operator's original code or text, kept so ops can check our reading of it. */
  rawStatus?: string;
};

/** One segment of a shipment, with a single mode and a single operator. */
export type Leg = {
  /** Order of travel, starting at 1. */
  sequence: number;
  mode: Mode;
  operatorId: string;
  from: Location;
  to: Location;
  /** Sorted by planned time, earliest first. */
  milestones: Milestone[];
};

/**
 * The operator's arrival time, either confirmed or estimated.
 * AI predictions are a separate type ({@link EtaPrediction}) and never stored here.
 */
export type Eta = {
  date: string;
  source: OperatorSource;
};

/** Paperwork that can travel with a shipment. A CMR is the consignment note for road transport. */
export type DocumentType =
  | "commercial_invoice"
  | "packing_list"
  | "bill_of_lading"
  | "customs_declaration"
  | "cmr";

/** Whether a document is on file, and whether this shipment needs it. */
export type ShipmentDocument = {
  type: DocumentType;
  status: "available" | "missing";
  required: boolean;
};

/** An operator message exactly as we received it, next to how we read it. */
export type RawEventRef = {
  operatorId: string;
  receivedAt: string;
  channel: "api" | "edi" | "email" | "csv";
  /** The message exactly as received, never edited. */
  original: string;
  /** The milestone we read it as, or `null` when we couldn't tell. */
  normalizedTo: MilestoneType | null;
  /** How sure the reading is, from 0 to 1. Structured feeds are always 1. */
  confidence: number;
};

/** An operator event after its adapter has read it, tagged with the shipment it belongs to. */
export type NormalizedEvent = {
  shipmentId: string;
  event: RawEventRef;
};

/**
 * A shipment from one origin site to one customer, made of legs in order of travel,
 * e.g. road → sea → road. Status, staleness, lateness and the time of the last operator
 * update are computed from it, not stored.
 */
export type Shipment = {
  /** Shipment reference, e.g. "SHP-1042". */
  id: string;
  customerId: string;
  originSiteId: string;
  /** Crosses a border. */
  international: boolean;
  /** Leaves the EU customs area, e.g. Spain to the UK. Spain to Germany doesn't. */
  requiresCustoms: boolean;
  /** Sorted by sequence. */
  legs: Leg[];
  /** The operator's current ETA, either confirmed or estimated. */
  operatorEta: Eta;
  /** The arrival time promised at booking. */
  plannedEta: string;
  documents: ShipmentDocument[];
  /**
   * Every operator message for this shipment, shown to ops for traceability. The newest
   * one is the shipment's last update, which is how stale shipments are found.
   */
  rawEvents: RawEventRef[];
};

// ---------- Computed / AI (never stored on Shipment) ----------

/**
 * How sure the AI is, in words the UI shows next to every AI output.
 * Worked out from a 0–1 confidence by `confidenceLevel()` in lib/ai/confidence.ts.
 */
export type ConfidenceLevel = "high" | "medium" | "needs_review";

/** The AI's predicted arrival window. Always shown apart from the operator's ETA. */
export type EtaPrediction = {
  earliest: string;
  latest: string;
  /** From 0 to 1. Below 0.6 the UI shows "Needs review" instead of a firm answer. */
  confidence: number;
  /** The main reason, in plain words, e.g. "Vessel departed 26h late from Valencia". */
  reason: string;
  source: "ai_predicted";
};

/** The AI's short answer to a customer's "where is it?". Shown with the `AI` label. */
export type ShipmentSummary = {
  /**
   * Short points, shown as a list: where the shipment is, when it arrives and whether
   * that's on time, a quiet operator if so, and what happens next.
   */
  points: string[];
  /** From 0 to 1. Lowered when the sentence leans on a prediction or the operator is quiet. */
  confidence: number;
  /** What the sentence is based on, in plain words, e.g. "Operator estimate; last update 2h ago". */
  reason: string;
};

/** Why a shipment needs an ops user's attention. */
export type ExceptionType =
  | "delay"
  | "customs_hold"
  | "stale"
  | "missing_document"
  | "incident"
  | "needs_review";

/** The next step the AI suggests to resolve an exception. */
export type NextAction =
  | "notify_customer"
  | "contact_operator"
  | "request_document"
  | "review_update";

/** Customs holds and incidents are critical; everything else is a warning. */
export type Severity = "critical" | "warning";

/** An item in the ops attention inbox. */
export type ShipmentException = {
  id: string;
  shipmentId: string;
  type: ExceptionType;
  detectedAt: string;
  severity: Severity;
  /** Response deadline: 30 minutes after detection when critical, 2 hours when a warning. */
  respondBy: string;
  /** What it means for the shipment, e.g. "ETA +2 days". */
  impact: string;
  /** Triage rank from 0 to 100; the inbox lists the highest first. */
  priorityScore: number;
  /** Why it ranks where it does, shown to the ops user. */
  priorityReason: string;
  suggestedAction: NextAction;
};

/** A message shown to a customer about one of their shipments. */
export type CustomerAlert = {
  id: string;
  shipmentId: string;
  severity: "info" | "warning" | "critical";
  message: string;
  createdAt: string;
  /** For example, an AI-predicted delay versus a customs hold the operator confirmed. */
  source: DataSource;
  /** Set for AI predictions. Those only reach the customer at 0.8 or higher. */
  confidence?: number;
};
