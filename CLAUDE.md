# CLAUDE.md — Throughline

## What this is
Throughline is a frontend-only prototype of a shipment visibility tool for manufacturers that
ship from multiple sites, via several logistics operators, by road and sea (often
multimodal), domestically and internationally. Tracking that is normally spread across
operator portals, email and phone is unified in one view.

Deployed on Vercel. Design decisions are documented in `docs/RATIONALE.md`.
Prioritise depth and polish on the core flows over breadth of features.

## Hard constraints (never break)
- **Frontend only.** No API routes, no server actions, no database, no external calls.
- **Synthetic data only.** All sites, operators, customers, shipments, documents are invented.
- **Simulated AI.** AI outputs come from deterministic mock logic in `lib/ai/`. No LLM calls.
- **Never invent a status or ETA in the UI.** Every time/status shown must come from data
  and carry a `source`: `confirmed` | `estimated` | `ai_predicted` (type `DataSource`).

## Stack
- Next.js (App Router) + TypeScript (strict)
- SCSS Modules (`sass`) for styling — no Tailwind
- Radix UI primitives (unstyled) for accessible Dialog, Tabs, Tooltip, Popover; styled with SCSS
- Zustand for client state (current role/user, simulated events, notifications)

Approved utilities: `lucide-react`, `date-fns`, `vitest` (dev). Ask before adding any other dependency.

## Architecture
```
app/
  page.tsx                  # Role picker (demo login)
  ops/                      # Internal operations view
    page.tsx                # Exceptions inbox (default)
    shipments/page.tsx      # Portfolio table (filters: site, operator, mode, status)
  customer/
    page.tsx                # My shipments + alerts
  shipments/[id]/page.tsx   # Shared detail; content adapts to role
components/
  ui/                       # Base components: Button, Badge, Card, Dialog (Radix + SCSS)
  shipment/                 # Timeline, LegCard, StatusBadge, EtaBlock, SourceTag
  ai/                       # AiSuggestion, ConfidenceMeter, AiSummary, DraftMessage
  layout/                   # AppShell, RoleSwitcher, DemoPanel
data/
  raw/                      # Operator payloads in DIFFERENT formats/vocabularies
  seed.ts                   # Sites, operators, customers, users
  bookings.ts               # Booked plan per seed shipment (legs, planned times, documents)
  plan.ts, locations.ts     # Builders for legs and documents; ports and addresses
  shipments.ts              # getShipments(): the single entry point for shipment data
lib/
  types.ts                  # Normalized domain model (source of truth)
  normalize/                # One adapter per operator: raw -> normalized Shipment
  ai/                       # Mock AI: eta.ts, triage.ts, summarize.ts, normalizeText.ts
  access.ts                 # Role/perimeter filtering
  store.ts                  # Zustand store
  time.ts                   # getNow(): fixed demo clock
styles/
  _tokens.scss              # Design tokens as CSS custom properties (colors, spacing, radius, type)
  _mixins.scss              # Breakpoints, focus ring, truncate, etc.
  globals.scss              # Reset + base typography; imported once in app/layout.tsx
docs/                       # PRD, DATA_MODEL, DESIGN, RATIONALE
```

Data flow: `data/raw` → `lib/normalize` → normalized `Shipment[]` → `lib/access`
(filter by role) → `lib/ai` (enrich) → components. Components never read `data/raw`.

## Domain rules
- A shipment is made of one or more **legs**, in sequence. A leg is one segment with a single
  mode (`road` | `sea`) and operator, e.g. road → sea → road.
- Milestones differ by mode. Sea: gate-in, loaded, departed, arrived, discharged.
  Road: picked-up, in-transit, delivered. Shipments leaving the EU (e.g. to the UK) add customs milestones.
- `ShipmentStatus` (normalized, shown in UI): `planned`, `in_transit`, `at_port`,
  `customs_hold`, `delivered`. Lateness is `etaStatus`, not a status, and problems
  (incident, stale…) are exceptions in the ops inbox, not a status. The operator's original text is kept
  in `rawStatus` for traceability.
- `source` (where a value comes from) ≠ `etaStatus` (`on_time` | `at_risk` | `late`, is it
  going to make it?). Never mix the two.
- Time-based logic uses `getNow()` from `lib/time.ts` (fixed `DEMO_NOW`), never `new Date()`.
- **Stale** = no operator update in > 24h while in transit or at port (computed, not stored).
- `ShipmentStatus` is derived from milestones, never stored, so simulated events can't leave it out of date.
- Access: customers see only their `customerId`; ops users see only their `siteIds`.

## AI features (all mocked, all labelled)
1. Status normalization: raw operator text → `ShipmentStatus` + confidence; original operator message viewable.
2. ETA prediction: range + reason, always visually distinct from the confirmed ETA.
3. Exception triage: ranked attention list + suggested next action.
4. Drafted customer notification: an ops user must approve; nothing is sent automatically.
5. Plain-language shipment summary for customers.
Every AI output displays: the `AI` text label (no icons), a confidence level, and the "why".
Customer delivery follows risk tiers (`docs/PRD.md` §6): portal data is automatic; AI delay
alerts reach customers only with High confidence (≥ 0.8), otherwise they become an ops exception.

## UI principles
- Calm, professional logistics tool. Neutral palette; color only for meaning
  (green on-time, amber at-risk, red incident, violet AI).
- Customers: clarity and confidence ("Arriving Thu 23 Oct, on time").
- Ops: density and triage. The most urgent item is always at the top.
- Show freshness everywhere ("Updated 12 min ago" / "Stale: 31h").
- Accessible: semantic HTML, keyboard reachable, never color alone for status.
- Responsive, mobile-first CSS: base styles target small screens, enhance with
  `@include bp(md)` / `bp(lg)` from `_mixins.scss` (sm 480, md 768, lg 1024, xl 1280).
  - Customer views must work well on a phone (they check "where is it?" on the go).
  - Ops views are optimized for desktop, but stay usable on tablet/phone: tables collapse
    into stacked cards below `md`, side panels become full-screen drawers.
  - No horizontal page scroll at any width ≥ 360px; touch targets ≥ 44px.
  - Use CSS grid/flex + `clamp()` for fluid spacing and type; avoid fixed pixel widths.

## Conventions
- Functional components, named exports, props typed with `type`.
- Server Components by default; add `"use client"` only where state or interactivity is needed.
  Views that show shipment data are Client Components: they read the persona and shipments
  from the Zustand store, which the server can't see (`docs/RATIONALE.md` §2).
- Pure functions in `lib/` with no React imports, so they're easy to test.
- Small files (< ~200 lines). Extract components when they grow.
- No `any`. Domain types only from `lib/types.ts`.

## Code quality
- **Readable over clever.** Plain functions and clear names. No generic plugin systems,
  factories or abstractions for one use case. Abstract only on the third repetition.
- **Prefer well-known patterns.** Before introducing a non-obvious pattern or an unfamiliar
  library feature (e.g. a Zustand middleware, an advanced Radix prop), explain the approach
  and trade-off, then implement.
- **Every view handles its states:** loading (skeleton), empty ("No shipments need attention"),
  and error/not-found (e.g. unknown shipment id → friendly 404).
- **Types do the work.** Union types for statuses, exhaustive `switch` with a `never`
  check, no type assertions (`as`) unless justified in a comment.
- **Test the logic, not the pixels.** Vitest unit tests for pure functions in `lib/`:
  normalizers, access filtering, stale detection, triage ranking. No UI snapshot tests.
- **Consistency.** Same folder structure, naming and patterns everywhere; follow existing
  code before inventing a new approach.
- **Small, focused changes.** Finish one logical change at a time so each maps to one commit
  (see Git rules).
- **README** explains: what it is, how to run, demo walkthrough (which role, what to click),
  and the project structure in a few lines.

## Styling (SCSS)
- One `Component.module.scss` next to each component; import as `styles`.
- Never hardcode colors/spacing: use tokens from `styles/_tokens.scss` (`var(--color-...)`).
- Pull in mixins with `@use "@/styles/mixins" as *;`. Use `@use`, never `@import`.
- Keep nesting to max 3 levels; BEM-like class names inside modules (`.card`, `.cardHeader`).
- Status/AI colors come only from semantic tokens (`--status-ontime`, `--status-risk`,
  `--status-incident`, `--ai-accent`).

## Workflow for Claude Code
- Read `docs/PRD.md` and `docs/DATA_MODEL.md` before building a feature, and
  `docs/DESIGN.md` before building or styling UI.
- Work in small steps; after each step run
  `npm run lint && npm run typecheck && npm run test && npm run build`.
- Explain non-obvious decisions in a short code comment or in the suggested commit message.
- Build in priority order (`docs/PRD.md` §5): finish all P0 before starting P1 or P2.
- Before adding scope, check `docs/PRD.md` → "Out of scope". Ask if unsure.
- Keep `docs/RATIONALE.md` notes updated when making an architectural or AI decision.

## Git rules
The maintainer makes all commits, pushes, merges and PRs. Claude reads git state,
suggests commits, and may create GitHub issues and leave PR review comments (see below).
- **Never** run `git add`, `git commit`, `git push`, `git merge`, `git rebase` or `git reset`.
- **Never** run `gh pr create`, `gh pr merge`, or close/delete PRs, branches or issues.
- Read-only git is fine: `git status`, `git diff`, `git log`.
- After each logical change, suggest:
  - the files that belong in the commit
  - a Conventional Commit message: `type(scope): #<issue> summary` in the imperative,
    ≤ 72 chars, e.g. `chore(deps): #1 add state, UI primitive and styling dependencies`
    (types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`), plus a short body
    explaining *why* when it isn't obvious
  - a footer referencing the same issue: `Refs #<n>`. Use `Closes #<n>`
    only in the PR description, so the issue closes when the PR merges, not on a
    partial commit
  - a branch name if starting new work: `feat/<short-name>`, `fix/<short-name>`

Allowed with `gh`:
- **Code review on PRs:** `gh pr view`, `gh pr diff`, `gh pr review --comment`.
  Never `--approve` or `--request-changes`; those decisions belong to the maintainer.
- **Issues:** `gh issue create`, `gh issue list`, `gh issue view`, `gh issue comment`.
  Use a clear title, context, acceptance criteria, and a label (`bug`, `feature`, `chore`).

## Commands
- `npm run dev`: local dev
- `npm run build`: must pass before suggesting a commit
- `npm run lint`
- `npm run typecheck`: `tsc --noEmit`
- `npm run test`: Vitest unit tests for `lib/` (`npm run test:watch` while coding)
