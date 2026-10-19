/**
 * Simulated AI (A1, unstructured): reads an operator email as one shipment step, with a
 * confidence and the reason. Deterministic phrase rules stand in for a language model, so
 * the same email always gets the same reading. Spec: docs/DATA_MODEL.md §6 (Email).
 */
import type { MilestoneType } from "@/lib/types";

/** How the AI read one email: the step (`null` when none), how sure it is, and why. */
export type TextReading = {
  milestone: MilestoneType | null;
  confidence: number;
  /** The words the reading rests on, e.g. `Says "held by UK customs".` */
  note: string;
};

// Checked from the furthest step back, so an email naming several steps ("loaded and
// departed") is read as the furthest one. Cleared comes before hold, so "released by customs
// after the hold" and "customs hold lifted" read as cleared. Up to three words may sit
// between "held by" and "customs" ("held by UK Border Force customs").
const PHRASES: [RegExp, MilestoneType][] = [
  [
    /cleared (?:by )?customs|released by (?:\w+ ){0,3}customs|customs clearance (?:granted|completed)|hold (?:lifted|released)/,
    "customs_cleared",
  ],
  [/held by (?:\w+ ){0,3}customs|customs hold|detained by (?:\w+ ){0,3}customs/, "customs_hold"],
  [/declaration (?:submitted|lodged)|submitted to (?:\w+ ){0,3}customs/, "customs_submitted"],
  [/\bdelivered\b/, "delivered"],
  [/\bdischarged\b|unloaded from the vessel/, "discharged"],
  [/\barrived\b|\bberthed\b|\bcall(?:ed)? at\b/, "arrived"],
  [/\bdeparted\b|\bsailed\b|\bleft (?:the )?port\b/, "departed"],
  [/\bloaded\b/, "loaded"],
  [/\bgate[- ]in\b|\bat the terminal\b/, "gate_in"],
  [/\bin transit\b|\bon the way\b|\bon the road\b/, "in_transit"],
  [/\bpicked up\b|\bcollected\b/, "picked_up"],
];

// Words that say a step did NOT happen ("not delivered", "failed to load"). Then no step is
// read at all: a false alarm only sends the email to a person, a wrong step changes the timeline.
const NEGATIONS = /\bnot\b|n't\b|\bcannot\b|\bfailed\b|\bunable\b|\bundeliver\w*|\bmissed\b|\brefused\b/;

// Words that make the reading uncertain ("might call at", "expected to depart"), and questions
// ("Delivered? Please confirm."). "May" next to a day number is a date, not a hedge. They count
// anywhere in the email, not only next to the step: that sends a few certain steps to review
// ("loaded, expected to depart Friday"), the safe direction. Step phrases are in the past
// tense, so "will arrive" reads as no step at all.
const HEDGES =
  /\bmight\b|(?<!\d )\bmay\b(?! \d)|\bpossibly\b|\bperhaps\b|\bdepending\b|\bexpected to\b|\bshould\b|\bif\b|\bto be confirmed\b|\btbc\b|\bplease confirm\b|\?|\bwill (?:arrive|call|sail|depart|load|deliver)\b/g;

/** A step stated plainly. Matches the Quickfern keyword reading: free text is never certain. */
export const STEP_CONFIDENCE = 0.9;
/** Hedging halves the confidence, which puts it below the 0.6 needed to change the timeline. */
export const HEDGE_FACTOR = 0.5;
/** Nothing recognised, or a step that didn't happen: for a person to review. */
export const UNREAD_CONFIDENCE = 0.2;

/**
 * Reads an operator email (subject and body) as a shipment step. A plain statement gets
 * 0.9; hedged wording gets half that; a negation or no recognised step gets `null` at 0.2.
 */
export function readEmail(subject: string, body: string): TextReading {
  const text = `${subject}\n${body}`;
  const lower = text.toLowerCase();

  const negation = NEGATIONS.exec(lower);
  if (negation) {
    return {
      milestone: null,
      confidence: UNREAD_CONFIDENCE,
      note: `Says something didn't happen ("${quote(text, negation)}"), so no step is read.`,
    };
  }

  for (const [phrase, milestone] of PHRASES) {
    const match = phrase.exec(lower);
    if (!match) continue;
    const said = `Says "${quote(text, match)}"`;
    const hedges = [...new Set([...lower.matchAll(HEDGES)].map((h) => quote(text, h)))];
    if (hedges.length === 0) return { milestone, confidence: STEP_CONFIDENCE, note: `${said}.` };
    return {
      milestone,
      confidence: STEP_CONFIDENCE * HEDGE_FACTOR,
      note: `${said}, but hedged: ${hedges.map((h) => `"${h}"`).join(", ")}.`,
    };
  }

  return { milestone: null, confidence: UNREAD_CONFIDENCE, note: "No shipment step mentioned." };
}

/** The matched words as the operator wrote them, from the original (not lowercased) text. */
function quote(text: string, match: RegExpExecArray | RegExpMatchArray): string {
  const start = match.index ?? 0;
  return text.slice(start, start + match[0].length);
}
