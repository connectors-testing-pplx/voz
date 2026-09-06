# Voz — Compliance-first bilingual messaging platform

Voz is a compliance-first, bilingual (English/Spanish) A2P messaging platform designed for U.S. SMS, WhatsApp, and political use cases. It treats consent, opt-out enforcement, carrier registration, and per-channel policy controls as first-class concerns rather than afterthoughts.

> Built for the Latino U.S. market: every campaign uses language-aware templates, opt-in text, opt-out confirmations, HELP replies, survey trees, and dashboards segmented by English/Spanish preference. WhatsApp is treated as a parallel channel with its own opt-in and template-approval path — not a simple SMS extension.

## Architecture

A TypeScript monorepo mirroring the recommended production stack (Next.js app, Postgres/Supabase, Twilio SMS, WhatsApp Business Platform, worker/queue layer):

```
apps/
  web/        Bilingual dashboard + campaign builder (Vite + React + Tailwind, static GitHub Pages build)
  worker/     Production send jobs, webhook ingestion, suppression enforcement, report generation
packages/
  compliance/ Keyword handling (STOP/HELP/REVOKE), quiet hours, consent validation, suppression list, disclosure templates, per-campaign-type policy profiles, send gate
  flows/      Survey graph schema (message · question · branch · unsubscribe · tag · agent · completion) + executor
  reports/    KPI aggregation, funnel + drop-off, audit appendix, CSV + HTML/PDF export
  ui/         Reusable bilingual admin components + i18n context
```

Every outbound message is tied to a campaign, contact, consent artifact, language, segment, and policy profile so you can prove who was contacted, why, with what disclosure basis, and what happened next.

## Core modules

1. **Campaign Builder** — bilingual templates, branching flow editor (node graph), disclosure preview, policy profile, and launch approval checklist.
2. **Contact & Consent Management** — import with dedupe, consent validation, suppression matching, removal reasons, and per-contact language preference.
3. **Live Reporting** — KPI cards (sent, delivered, failed, opted out, response rate, completion rate, sentiment split, response-by-language) fed by materialized metrics.
4. **Post-Campaign Reporting** — totals, conversion funnel, flow drop-off, opt-out rate, answer distribution, language/segment breakdown, audit appendix (consent/disclosure versions), CSV + HTML/PDF export.

## Compliance baseline

- Documented consent with source, language, disclosure version, timestamp, IP/user agent, and document evidence
- Clear call-to-action disclosures (EN/ES) with message-frequency disclosure and revocation handling
- CTIA / TCPA-style opt-out keyword handling: STOP family, HELP, START/UNSTOP, plus advanced keywords (REVOKE, OPTOUT, CANCELAR, etc.) with auto-reply confirmation and suppression across the sender pool
- Federal quiet-hours gating (21:00–08:00 local civil time, state-aware)
- Per-campaign-type policy profiles (political, nonprofit, employer, commercial) inheriting different rules, disclosures, and approval checks
- A2P 10DLC campaign registration/vetting via The Campaign Registry surfaced as required approvals
- WhatsApp opt-in stored and managed separately from SMS, with its own template-approval path

### Send gate

Every outbound message — even a manual "press send" by a staffer, which still counts as A2P business messaging in carrier policy — is gated before dispatch by: consent status, quiet hours, sender eligibility, channel eligibility, and suppression screening. Blocked sends are recorded with their reason and never dispatched.

## Survey flow model

A node graph powers branching survey flows (political polling, employer satisfaction, customer experience, voter-intent):

- **Message** — send a static, language-aware message
- **Question** — ask a question, store the answer, branch by option
- **Branch** — route based on a stored variable
- **Unsubscribe** — enforce opt-out + suppression
- **Tag** — apply tags to the contact
- **Agent** — hand off to a human agent
- **Completion** — terminal completion node

Edges carry optional conditions (e.g. `consent == yes`) so a Question node can route "Yes"/"No"/"Unsure"/"Sí"/"No (es)" answers to different downstream nodes — the flow diagrams of potential answers surfaced in the builder UI.

## Data model

Main objects: Organizations, clients, and subaccounts; Contacts, lists, suppression lists, and reassigned-number status; Consent records (source, language, disclosure version, timestamp, IP/user agent, evidence); Campaigns, templates, flow nodes, sends, deliveries, responses, opt-outs, and reports.

## Running locally

```bash
npm install          # at monorepo root (npm workspaces)
npm run dev          # starts the web app (Vite)
npm run build        # production build -> apps/web/dist
```

The static `apps/web` build deploys to GitHub Pages via the included Actions workflow.

## Deployment — GitHub Pages

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds `apps/web` and publishes to GitHub Pages. Enable it in repo Settings → Pages → Source: GitHub Actions.

## Disclaimer

Voz is a reference implementation. Carrier registration, legal review, and disclosure language must be validated for your specific use case and jurisdiction before production use.

## License

MIT
