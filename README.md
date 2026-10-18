# Throughline — Shipment Tracking Prototype

[![CI](https://github.com/fridavbg/throughline-logistics/actions/workflows/ci.yml/badge.svg)](https://github.com/fridavbg/throughline-logistics/actions/workflows/ci.yml)

One view of every shipment across sites, logistics operators and transport modes,
with AI that predicts delays, ranks what needs attention and drafts the follow-up.

**Live demo:** https://throughline-logistics.vercel.app

> Frontend-only prototype. All data, operators and AI output are synthetic.
> The app runs at a fixed demo time, **Wed 21 Oct 2026, 10:00** (Spain), shown in the header,
> so every visit shows the same state. Times like "Updated 2h ago" count from it.

## Demo walkthrough (≈ 3 min)
1. Sign in as **Rick (Ops, all sites)** → the attention inbox ranks the customs hold on
   SHP-1043 first; *Why this rank?* explains it.
2. Click **SHP-1043** → no arrival date while customs holds it, the timeline with each leg and
   the customs step, and the original operator messages next to how they were read.
3. **Request document** → review the AI draft → *Approve & send*.
4. **Back to Attention**, then switch to **Morty (Ops, Terrassa)** → only Terrassa shipments; a
   shorter inbox.
5. Switch to **Summer (Customer, Ostrel Deutschland)** → the delay alert for SHP-1042, and the
   AI-predicted arrival under the operator's ETA.
6. **View details** on SHP-1042 → the plain-language summary, timeline and documents.

## AI features
The AI is simulated on purpose: deterministic rules in `lib/ai/`, no model calls. The same
data and demo clock always give the same output. The point is how AI fits the product
(labelling, confidence, a person in control), not model quality.

| | Feature | What it does | Where you see it |
|---|---|---|---|
| A1 | Status normalization | Reads each operator's own codes and messages as one shared set of milestones, with a confidence | Timeline, original operator messages |
| A2 | ETA prediction | Carries a known delay through to the arrival: a window, a confidence and the reason ("Vessel departed 26h late from Port of Valencia") | Customer cards, ETA block |
| A3 | Exception triage | Finds what needs attention and ranks it by severity × customer priority × time left, saying why | Ops inbox |
| A4 | Next action + draft | Suggests the next step and drafts the customer message; a person approves it | Ops inbox |
| A5 | Shipment summary | A few plain points: where it is, when it arrives, what happens next | Customer cards |

**Rules every AI output follows**
- Marked with an `AI` label, a confidence level and a "Why?".
- Confidence: High (≥ 0.8), Medium (0.6–0.8), and below 0.6 no firm answer ("Needs review"
  for ops, "Awaiting update" for customers).
- Never replaces operator data: the AI window sits below the operator's ETA, and every time
  says where it comes from (confirmed, operator estimate, AI prediction).
- Says only what the data supports: predictions are worded as predictions, and a customs hold
  gets no release date.

**What reaches the customer on its own**
| Tier | Example | How |
|---|---|---|
| Automatic | Status, ETAs, AI prediction, summary | Shown in the portal straight away |
| Automatic above 0.8 | Delay alert | Only with High confidence; below that it goes to ops instead |
| Human-approved | Drafted messages | Never sent automatically. If ops misses the response target, the customer gets a neutral "We're aware of an issue…" |

How each feature would work in production is in [Rationale §1](docs/RATIONALE.md).

## Run locally
```bash
nvm use
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (Vitest) |

## Project structure
```
app/         routes: role picker, ops, customer, shipment detail
components/  UI, shipment, AI and layout components
data/        synthetic seed data and raw operator payloads
lib/         types, normalizers, access rules, mock AI
styles/      design tokens and global styles
docs/        product, data model, design and rationale
```

## Docs
- [Product requirements](docs/PRD.md)
- [Data model](docs/DATA_MODEL.md)
- [Design](docs/DESIGN.md)
- [Rationale](docs/RATIONALE.md)
