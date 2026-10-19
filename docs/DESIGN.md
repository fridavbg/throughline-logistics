# Design

## 1. Direction
**Calm control room.** A logistics tool people trust at a glance: quiet neutral surfaces,
strong typographic hierarchy, and color reserved for meaning. When something turns amber or
red, it should stand out because nothing else is competing.

- **Neutral by default, color for meaning.** Status and AI are the only colored elements.
- **Data you can scan.** Monospace for references and codes, tabular numbers for dates and times.
- **Honest data.** Confirmed, estimated and AI-predicted values never look the same.
- Product name: **Throughline**.

## 2. Typography
Loaded with `next/font/google` (no extra dependency).

| Use | Font | Notes |
|---|---|---|
| UI and body | IBM Plex Sans | Industrial, highly legible at small sizes |
| References, codes, raw operator text | IBM Plex Mono | `SHP-1042`, `DEP ESVLC` |

Numbers in tables and ETAs use `font-variant-numeric: tabular-nums`.

**Type scale** (fluid with `clamp()`)
| Token | Size | Use |
|---|---|---|
| `--text-xs` | 12px | Meta, tags, timestamps |
| `--text-sm` | 14px | Table cells, secondary text |
| `--text-md` | 16px | Body (base) |
| `--text-lg` | clamp(18px → 20px) | Card titles |
| `--text-xl` | clamp(20px → 24px) | Section headings |
| `--text-2xl` | clamp(24px → 32px) | Page titles, customer ETA |

Weights: 400 body, 500 labels, 600 headings. Line height 1.5 body, 1.2 headings.

## 3. Color tokens
Light theme only for the prototype. Tokens are CSS custom properties, so a dark theme
can be added later by redefining them.

**Neutrals**
| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#F6F7F9` | App background |
| `--color-surface` | `#FFFFFF` | Cards, tables, panels |
| `--color-surface-muted` | `#EEF1F4` | Hover, table header, skeleton |
| `--color-border` | `#DDE2E8` | Dividers, card borders |
| `--color-text` | `#14202E` | Primary text |
| `--color-text-muted` | `#5B6878` | Secondary text, meta |
| `--color-primary` | `#1E3A5F` | Primary buttons, active nav, links |
| `--color-focus` | `#2F6FED` | Focus ring |

**Semantic** (each has a foreground for text/icons and a soft background)
| Meaning | Token | FG | BG |
|---|---|---|---|
| On time / delivered | `--status-ontime` | `#1F7A4D` | `#E6F4EC` |
| At risk | `--status-risk` | `#A15C00` | `#FDF1DC` |
| Late / incident / hold | `--status-incident` | `#B42318` | `#FDE8E6` |
| Informational / planned | `--status-info` | `#2F5D8A` | `#E7EFF8` |
| AI | `--ai-accent` | `#6941C6` | `#F1ECFB` |

All FG colors meet WCAG AA (4.5:1) on both `--color-surface` and their own BG.
Never use color alone: every status also has an icon and a text label.

## 4. Spacing, radius, elevation
- **Spacing** (4px base): `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 ·
  `--space-5` 24 · `--space-6` 32 · `--space-7` 48
- **Radius:** `--radius-sm` 4px (tags) · `--radius-md` 8px (inputs, buttons) · `--radius-lg` 12px (cards)
- **Elevation:** cards use a border, not a shadow. Shadows only for floating layers:
  `--shadow-pop` (popovers, demo panel), `--shadow-modal` (dialogs).
- **Layout:** max content width 1280px; side gutter 16px mobile, 24px from `md`.

## 5. Icons and motion
- `lucide-react`, 16px inline, 20px in buttons, `stroke-width: 1.75`.
- Motion is functional only: 150ms for hover/focus, 200ms for panels; new items from the
  demo panel highlight briefly with a soft background fade.
- Respect `prefers-reduced-motion`: no transitions or highlight animation.

## 6. Core components

### StatusBadge
Pill with icon + label. Two separate sets, never merged into one badge:
- **`ShipmentStatus`** (where it is): `Planned` (calendar, neutral) · `In transit` (truck / ship
  by mode, info) · `At port` (anchor, info) · `Customs hold` (shield-alert, red) ·
  `Delivered` (package-check, green). Problems such as incidents are exceptions, not a status.
- **`EtaStatus`** (will it make it): `On time` (check-circle, green) · `At risk`
  (clock-alert, amber) · `Late` (alert-triangle, red) · `ETA unknown` (circle-help, neutral)
  when the data gives no firm answer (customs hold, unreadable date).
  Customers see the same tones and icons with plainer words: `On time` · `Up to a day late` ·
  `More than a day late` · `ETA unknown`, matching the AI summary. "At risk" stays an ops (triage) term,
  since a customer can read it as a risk to the goods.

### SourceTag
Shows where a value comes from. Sits next to every ETA and milestone time.
| `source` | Look | Label |
|---|---|---|
| `confirmed` | Solid neutral, check icon | "Confirmed" |
| `estimated` | Dashed outline, neutral | "Operator estimate" |
| `ai_predicted` | Dashed violet outline, `AI` label | "AI prediction" |

### EtaBlock
The answer to "when does it arrive?".
- Large date ("Thu 23 Oct") + `SourceTag` + `etaStatus` badge.
- If an AI prediction differs: a second row marked with the `AI` label, showing the range ("25–26 Oct"), confidence
  and a one-line reason. The operator ETA stays visible above it, never replaced.

### Leg timeline
Vertical on mobile, horizontal leg strip + vertical milestones from `lg`.
- Each leg: mode icon, operator, `from → to`, "Leg 2 of 3".
- Milestones: done (filled dot + time), current (ring, pulsing unless reduced motion),
  upcoming (hollow dot + planned time in muted text).
- Customs appears as its own step between sea arrival and final road leg.

### AI components
All share one marker: a small **`AI` text label** (uppercase, `--text-xs`, weight 600) in a
dashed `--ai-accent` outline, the same visual language as `SourceTag` uses for estimates.
No icon, no tinted backgrounds: the label and the dashed edge are enough to tell AI output
apart from operator data. Longer AI blocks (suggestions, drafts) add a dashed left border.
- **AiSuggestion:** suggested action + reason + action button. "Why?" expands the reasoning.
- **ConfidenceMeter:** three levels, text always shown: **High** (≥ 0.8), **Medium**
  (0.6–0.8), **Needs review** (< 0.6, amber, shows "Review" instead of a firm answer).
  Customers see **Awaiting update** instead of Needs review: they can't review anything, and
  for them a low score only comes from a quiet operator.
- **AiSummary:** the `AI` label, then a short bulleted list (where it is, arrival, what's next),
  regular weight, with a dashed left border. Points, not one long sentence, so it scans on a phone.
- **DraftMessage:** dialog with an editable draft, recipient, linked shipment;
  buttons *Discard* and *Approve & send*. Footer: "Drafted by AI. Review before sending."

### Other
- **FreshnessLabel:** "Updated 12 min ago"; after 24h in transit turns amber: "Stale · 31h".
- **ExceptionRow** (ops inbox): priority marker, ref (mono), customer, exception badge, impact,
  response countdown ("Respond within 25 min", amber under 10 min, red "Overdue · escalated"),
  detected time, AiSuggestion inline. Becomes a card below `md`.
- **ShipmentCard** (customer): destination, big ETA, status badge, AI summary.
- **AlertItem:** icon by severity, message, time, link to shipment; `source` tag if predicted.
- **EmptyState:** icon, one-line message, optional action. **Skeleton:** muted blocks matching
  the final layout.
- **DemoPanel:** floating bottom-right button "Demo" opening a popover with scripted events
  and "Reset demo". Visually separate (dashed border) so it's clearly not product UI.
  After an event the panel closes and a notice says what changed, with a link to the
  shipment, or that it's outside the persona's perimeter. The demo clock lives in the header.
- **RoleSwitcher:** header dropdown showing the current persona (name, role, perimeter).

## 7. Screens

**App shell**
- Header: Throughline logo · page title · demo time ("Demo time: Wed 21 Oct, 10:00") ·
  RoleSwitcher. The demo time is always visible, not only in the demo panel.
- Ops: tabs (Attention, Shipments) under the header at every width; two pages don't need a
  left nav.
- Customer: no nav needed; single page plus detail.

**Ops: Attention inbox**
```
[Filters: type ▾  site ▾]                      12 need attention
┌─────────────────────────────────────────────────────────────┐
│ ● SHP-1043  Thornquist · Zaragoza → Manchester [Customs hold]│
│   Impact: ETA +3 days · Respond within 25 min               │
│   [AI] Request packing list from customer   [Request] [Why?]│
├─────────────────────────────────────────────────────────────┤
│ ● SHP-1045  Ostrel DE · Porto → Hamburg    [Stale · 31h]    │
│   [AI] Contact Saltwren Lines for an update [Contact]       │
└─────────────────────────────────────────────────────────────┘
```

**Ops: Shipments** — dense table, most urgent first; stale rows show an amber FreshnessLabel.
Rows stack into cards with their column names below `md`. Filter bar planned (#20).

**Customer: My shipments**
```
On time 6 · Up to a day late 1 · More than a day late 1 · Delivered 4
[Alerts]  ⚠ SHP-1042 likely to arrive 2 days late (AI prediction)
┌──────────────────────┐ ┌──────────────────────┐
│ Hamburg              │ │ Hamburg              │
│ Thu 23 Oct [Up to a day late] │ │ Mon 27 Oct [On time] │
│ [AI] At sea, expect… │ │ [AI] Picked up in…   │
└──────────────────────┘ └──────────────────────┘
```
One column on mobile, two from `md`, three from `xl`.

**Shipment detail**
- Header: ref (mono), route, status badges, EtaBlock.
- Main: leg timeline. Side (from `lg`) / below (mobile): documents, AI summary (customer)
  or exceptions + raw operator messages (ops).

## 8. Content and voice
- Plain, specific, calm. "Arriving Thu 23 Oct" not "ETA: 2026-10-23T14:00Z".
- Dates: `EEE d MMM` ("Thu 23 Oct"); times 24h ("14:30"); relative for freshness.
- Say what's known: "Operator estimate", "AI prediction", never "probably".
- Empty states say what's good: "Nothing needs attention right now."
- Buttons are verbs: "Notify customer", "Request document", "Approve & send".
