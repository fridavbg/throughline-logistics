# Throughline — Shipment Tracking Prototype

One view of every shipment across sites, logistics operators and transport modes,
with AI that predicts delays, ranks what needs attention and drafts the follow-up.

**Live demo:** https://throughline-logistics.vercel.app

> Frontend-only prototype. All data, operators and AI output are synthetic.

## Demo walkthrough (≈ 3 min)
1. Sign in as **Rick (Ops, all sites)** → the attention inbox ranks a customs hold first.
2. Open it → the timeline shows each leg, the customs step and the original operator messages.
3. **Notify customer** → review the AI draft → approve.
4. Open **Demo** (bottom right) → *Vessel delayed at Valencia* → a new exception appears.
5. Switch to **Morty (Ops, Terrassa)** → only Terrassa shipments are visible.
6. Switch to **Summer (Customer, Ostrel Deutschland)** → the delay alert and AI-predicted ETA.

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
