# Throughline — Shipment Tracking Prototype

[![CI](https://github.com/fridavbg/throughline-logistics/actions/workflows/ci.yml/badge.svg)](https://github.com/fridavbg/throughline-logistics/actions/workflows/ci.yml)

One view of every shipment across sites, logistics operators and transport modes,
with AI that predicts delays, ranks what needs attention and drafts the follow-up.

**Live demo:** https://throughline-logistics.vercel.app

**Project board:** https://github.com/users/fridavbg/projects/5

> Frontend-only prototype. All data, operators and AI output are synthetic.
> The app runs at a fixed demo time, **Wed 21 Oct 2026, 10:00** (Spain), shown in the header,
> so every visit shows the same state. Times like "Updated 2h ago" count from it.

## Demo walkthrough (≈ 3 min)
1. Sign in as **Rick (Ops, all sites)** → the attention inbox ranks the customs hold on
   SHP-1043 first; *Why this rank?* explains it.
2. Click **SHP-1043** → no arrival date while customs holds it, the timeline with each leg and
   the customs step, and the original operator messages next to how they were read.
3. **Request document** → review the AI draft → *Approve & send*. The item leaves the inbox;
   the **Shipments** tab lists every shipment, and SHP-1043's detail now shows *Customer notified*.
4. **Back to Attention**, open the **Demo** button (bottom right) → *Vessel delayed at
   Valencia* → a delay for SHP-1042 joins the inbox, ranked by urgency, without a reload.
5. Switch to **Morty (Ops, Terrassa)** → only Terrassa shipments; a shorter inbox.
6. Switch to **Summer (Customer, Ostrel Deutschland)** → the delay alert for SHP-1042, and the
   AI-predicted arrival under the operator's ETA.
7. **View details** on SHP-1042 → the plain-language summary, timeline and documents.

The demo panel has two more events: a vague email for SHP-1048 (ops must review it) and a
delivery for SHP-1044. *Reset demo* goes back to the starting state. A reload keeps your
progress; closing the tab also starts over.

**Not built yet** (planned for v1.2.0, see the
[Breadth milestone](https://github.com/fridavbg/throughline-logistics/milestone/4)): filters
and search on the ops Shipments table (F3), a fourth operator with more seed shipments, a
repeated customs hold on the same leg, and showing ops who received an approved message.

## AI features
The AI is simulated on purpose: deterministic rules in `lib/ai/`, no model calls. The same
data and demo clock always give the same output. The point is how AI fits the product
(labelling, confidence, a person in control), not model quality.

| | Feature | What it does | Where you see it |
|---|---|---|---|
| A1 | Status normalization | Reads each operator's own codes and messages, emails included, as one shared set of milestones, with a confidence and the words it rests on ("Says 'held by UK customs'") | Timeline, original operator messages |
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

Install scripts for `@parcel/watcher` and `unrs-resolver` are denied on purpose (`allowScripts`
in `package.json`): npm installs their prebuilt binary for your platform, so the scripts aren't
needed. If lint fails with a missing native binding (for example after
`npm install --omit=optional`), run `npm install-scripts approve unrs-resolver` and reinstall.

## Project structure
```
app/         routes: role picker, ops, customer, shipment detail
components/  UI, shipment, AI and layout components
data/        synthetic seed data and raw operator payloads
lib/         types, normalizers, access rules, mock AI
styles/      design tokens and global styles
docs/        product, data model, design and rationale
```

## How this was built
Built with Claude Code as an AI pair programmer, as the brief encourages. I set the scope and
priorities, defined the domain rules, tested the app as a user, and reviewed and made every
commit. The logic was discussed before it was built: Claude Code proposed approaches with their
trade-offs, and I chose between them and questioned the results, for example what the demo
keeps across a reload and which part of the ops table to build first. Claude Code wrote most of
the code under the rules in [`CLAUDE.md`](CLAUDE.md): one issue per pull request, no commits of
its own, and a bug review and spec check before each commit.

## Docs
- [Product requirements](docs/PRD.md)
- [Data model](docs/DATA_MODEL.md)
- [Design](docs/DESIGN.md)
- [Rationale](docs/RATIONALE.md)
