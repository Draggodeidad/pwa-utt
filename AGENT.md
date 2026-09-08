# AGENT.md

## Project Overview & Architecture

### Purpose and current scope

Build **Laboratorio Inspect**, a Progressive Web App (PWA) for maintenance inspections in university laboratories. It replaces notebooks and spreadsheets, supports technicians working with intermittent connectivity, and gives laboratory coordination a view to prioritize and follow up findings.

The repository is currently a **Next.js starter with synthetic inspection data**. Authentication, backend API, database, IndexedDB persistence, service worker, manifest, installation, real offline operation, synchronization, notifications, and deployment are **not implemented yet**. Treat their documented behavior as target architecture, not existing functionality.

### Technology stack

| Area | Current choice |
| --- | --- |
| Framework | Next.js `14.2.35`, App Router |
| UI | React `18.3.1` / React DOM `18.3.1` |
| Language | TypeScript `5.4.5`, strict mode |
| Runtime | Node.js `20.19+` compatible; CI uses Node `20.19.6` |
| Package manager | npm `10+`; use the committed `package-lock.json` |
| Database / backend | Not implemented or selected |
| PWA runtime | Architecture/contracts only; no active service worker or IndexedDB adapter |
| Testing | Node assertion starter test; no unit/integration framework configured |

### Architectural rules

Use **feature-based architecture + domain separation + reusable design system + decoupled PWA infrastructure**.

```text
src/
├── app/                    # Next routing, layouts, route handlers and feature composition
├── components/
│   ├── ui/                 # Generic visual primitives only
│   ├── layout/             # Global shell/navigation structure
│   └── feedback/           # Generic loading, empty, error and offline states
├── config/                 # Declarative application configuration
├── features/
│   ├── auth/               # Session, user and role concepts
│   ├── dashboard/          # Coordination read models
│   ├── findings/           # Finding lifecycle, priority and follow-up
│   ├── inspections/        # Inspection lifecycle, forms, list and detail
│   ├── profile/            # User and application status
│   └── sync/               # User-visible synchronization concepts
├── lib/
│   ├── api/                # Transport contracts/adapters
│   ├── auth/               # Session persistence contracts/adapters
│   ├── data/               # Transitional starter compatibility exports
│   └── pwa/                # Browser infrastructure: connectivity, cache, local storage, sync queue
└── types/                  # Technical types shared across domains
```

### Dependency direction

```text
app → feature public API → components/ui | components/feedback | lib | config | types
feature service/hook → lib adapter/contract → browser API, local storage, or remote API
```

- Keep `src/app` thin. It composes features and must not hold domain business logic.
- Import a feature only through its public `index.ts`; do not reach into another feature's internal folders.
- `components/ui` and `components/layout` must not import feature business logic.
- `lib` must not import routes or presentation components.
- Use aliases: `@/features/...`, `@/components/...`, `@/lib/...`, `@/config/...`, `@/types/...`.
- Use Server Components by default. Add `"use client"` only at the smallest interactive boundary requiring browser APIs, local state, DOM events, camera, geolocation, dialogs, connectivity hooks, or IndexedDB.

### Domain model and ownership

| Domain | Responsibility | Main entities / states |
| --- | --- | --- |
| `auth` | Authentication, restored session and role navigation | `Session`, `SessionUser`, `technician`, `coordinator` |
| `inspections` | Create, draft, edit, finalize, query and filter inspections | `Inspection`, `draft`, `completed`, derived result |
| `findings` | Capture, priority and follow-up of first-class findings | `Finding`, `low/medium/high`, `pending/in_review/resolved` |
| `dashboard` | Coordination aggregates and drill-downs | `CoordinationSummary` |
| `sync` | Queue/progress/error/conflict states visible to users | `SyncQueueItem`, `pending/syncing/synced/error` |
| `profile` | User and application status | `ProfileView` |
| `lib/pwa` | Browser/infrastructure abstractions | connectivity, cache, offline storage, sync queue |

`Finding` is a first-class entity and belongs to exactly one `Inspection` through `inspectionId`. An inspection has `0..N` findings. Persist workflow separately from the derived inspection result. Do not reintroduce a standalone `findings` counter as the source of truth.

Canonical status vocabulary:

```ts
type InspectionWorkflowStatus = "draft" | "completed";
type InspectionResult = "without_findings" | "requires_attention";
type SyncStatus = "local" | "pending" | "syncing" | "synced" | "error";
type FindingPriority = "low" | "medium" | "high";
type FindingStatus = "pending" | "in_review" | "resolved";
```

### PWA and offline target architecture

PWA behavior is planned, not implemented. When implementing it, keep browser details behind `lib/pwa` and feature services/hooks:

```text
Route/component → feature service or hook → persistence/sync abstraction → IndexedDB, Cache Storage, service worker, API
```

- Use local UUIDs for offline-created inspections and findings.
- Plan stores for `inspections`, `findings`, and `syncQueue`.
- Queue operations per entity: `create`, `update`, `delete`.
- Preserve pending drafts on logout and PWA updates.
- Use the documented initial conflict policy: compare `updatedAt`; detect conflicts and retain information for resolution. Do not silently overwrite divergent records.
- Do not claim offline, PWA install, sync, conflict resolution, API, or authentication is complete until implementation and tests exist.

## Setup & Essential Commands

### Prerequisites

```bash
node --version  # Node.js 20.19+ compatible
npm --version   # npm 10+
```

### Commands

| Goal | Command | Notes |
| --- | --- | --- |
| Clean reproducible install | `npm ci` | Required; do not substitute manual dependency edits |
| Local development | `npm run dev` | Open `http://localhost:3000` |
| Production build | `npm run build` | Runs Next.js compilation and type validation |
| Run production server | `npm start` | Run after a successful build |
| Starter tests | `npm test` | Runs `tests/starter.spec.mjs` |
| Type check | `npm exec tsc -- --noEmit` | No package script exists; run explicitly |
| Full project verification | `npm run verify` | Checks structure, test and build; writes `reports/verification.json` |
| Structure-only check | `bash public-tests/check.sh` | Does not run tests/build or scan secrets |
| Make shortcuts | `make test`, `make build`, `make verify` | Optional; no Make dependency required |

There is currently **no configured lint script, formatter, database migration command, integration-test suite, API test suite, or environment-variable file**. Do not invent commands or claim these tools exist. Propose them separately and wait for approval before adding dependencies or configuration.

## Core Development Guidelines

### TypeScript and code conventions

- Preserve TypeScript strictness. Do not use `any`, `@ts-ignore`, unchecked type assertions, or disable compiler checks to bypass an error.
- Prefer explicit domain types, discriminated unions, `readonly` inputs where appropriate, and narrow types at boundaries.
- Use PascalCase for React components and exported types, camelCase for values/functions/hooks, and kebab-case for non-component filenames such as `inspection.repository.ts`.
- Use named exports unless a Next.js route convention requires a default export.
- Keep data contracts serializable when passing data from Server to Client Components.
- Treat timestamps as ISO strings and IDs as opaque strings; never derive business meaning from the starter's synthetic IDs.
- Preserve existing Spanish product terminology in user-facing text and canonical English enum values in code.

### Validation, error handling, and state

- Put feature-specific input shapes and validation in `features/<domain>/schemas`.
- Surface validation errors beside the relevant field; do not rely only on toasts or generic form errors.
- Keep expected failures typed and actionable. Infrastructure adapters should return/throw contextual errors; feature code maps them to user-visible states.
- Reuse visual states: loading, empty, error/retry, offline, stale/local, pending sync, syncing, synced, sync failed, conflict, success, disabled, validation, and confirmation.
- Never communicate status with color alone; pair icon, text and badge/tooltip as appropriate.
- Do not mix workflow state, derived business result, and synchronization state into a single field.

### UI, responsive behavior, and accessibility

- Design desktop-first: desktop productivity is primary, while tablet and mobile retain equivalent essential actions through adapted interaction.
- Use full tables, horizontal filters, sidebars, context panels, dashboards and multi-column forms where they improve desktop work.
- On tablet, collapse navigation and stack secondary panels when necessary. On mobile, use drawers, list/cards for tables, filter sheets, overflow actions, list-to-detail navigation and one-column forms.
- Reuse the global component system before creating a domain component. Keep business-specific components in their feature.
- Maintain visible labels, keyboard focus, semantic heading hierarchy, appropriate ARIA labels, color contrast, and accessible error/status messages.
- Avoid landing-page layouts, oversized cards, arbitrary gradients, glassmorphism, excessive shadows, artificial empty space, and one-off visual patterns.

### Required patterns and prohibited anti-patterns

| Do | Do not |
| --- | --- |
| Compose routes from feature public APIs | Place business logic in `page.tsx` |
| Create a feature component when it is domain-specific | Put inspection/finding components in global `components/` |
| Add a global UI primitive only after genuine cross-domain reuse | Create a global catch-all `services/`, `hooks/`, or `components/` directory |
| Define a repository port in the owning feature | Couple UI directly to IndexedDB, Cache Storage or `navigator` |
| Add an adapter in `lib` | Import another feature's internals |
| Use variants of a shared component | Duplicate equivalent buttons, badges, dialogs or filters |
| Add routes for real UX responsibilities | Create placeholder pages or one screen per RF |
| Document changes to permissions/state/conflict policies | Silently contradict ADR decisions |

## Agent Rules & Behavioral Constraints

### Before editing

1. Read the applicable files in the Context Index and inspect the current implementation.
2. Check `git status --short`; preserve unrelated user changes.
3. Identify whether the requested capability is already implemented, only architected, or only documented.
4. State any assumption that would alter roles, permissions, state transitions, data ownership, or offline conflict behavior.

### Editing rules

- Make the smallest coherent change that fulfills the request.
- Do not run destructive commands (`git reset --hard`, broad recursive deletion, checkout discard) without explicit authorization.
- Do not delete comments, tests, types, ADR content, documentation, or compatibility exports without a concrete justification and replacement where applicable.
- Do not move a component to global UI merely because it is used once; do not create empty directory trees.
- Preserve `src/lib/data/inspections.ts` as a compatibility re-export until the verification contract and consumers are intentionally updated.
- Keep synthetic data only. Never commit real personal, institutional, credential, laboratory, or equipment data.
- Do not add APIs, route handlers, service workers, auth providers, database schemas, environment variables, or PWA claims as completed work without the requested implementation.

### Dependency and configuration policy

- Do not install, remove, upgrade, or replace dependencies without explicit user authorization.
- Do not modify `package-lock.json` except as a direct, approved consequence of a dependency change.
- Do not add linting, formatting, test frameworks, ORM/database tooling, authentication SDKs, PWA plugins, or environment-variable tooling without approval.
- Do not expose or print secrets. If configuration is needed, document required variable names and request authorization before creating templates or integration code.

### Testing protocol

1. Before a nontrivial change, run the narrowest relevant existing check when practical.
2. Add or update a focused test whenever behavior changes. The current starter test is insufficient for new business behavior.
3. After TypeScript/source changes, run:

   ```bash
   npm exec tsc -- --noEmit
   npm test
   npm run build
   npm run verify
   ```

4. Run `bash public-tests/check.sh` when validating required starter structure.
5. Report exactly which checks ran and whether they passed. Do not describe unimplemented PWA, API, offline, auth, or sync behavior as verified.

`npm run verify` generates `reports/verification.json`, which is intentionally excluded from Git. It verifies structure, test and build, but does not certify secret absence or document quality.

## Context Index / Reference Map

| Task | Read first | Then inspect |
| --- | --- | --- |
| Project constraints, current scope, reproducibility | `README.md`, `docs/requirements.md` | `package.json`, `scripts/verify.mjs`, `ACTIVIDAD-01.md` |
| Architecture, module placement, dependency direction | `docs/architecture.md` | `src/features/`, `src/lib/`, `tsconfig.json` |
| ADR and offline-first model decisions | `docs/decision-record.md`, `plan-mitigacion-gap-hallazgos.md` | `src/features/inspections/types.ts`, `src/features/findings/types.ts`, `src/lib/pwa/` |
| Functional requirements and acceptance criteria | `docs/requirements.md`, `RF-09-a-RF-90.md` | `docs/rf-domain-map.md`, `docs/rf-screen-map.md` |
| Roles and authorization | `docs/actors-and-permissions.md` | `src/features/auth/`, `src/config/navigation.ts` |
| Inspection lifecycle, forms, filters and list/detail UI | `docs/use-cases.md`, `docs/user-flows.md` | `src/features/inspections/`, `docs/screen-inventory.md` |
| Findings, priority and follow-up | `docs/rf-domain-map.md`, `docs/actors-and-permissions.md` | `src/features/findings/`, `plan-mitigacion-gap-hallazgos.md` |
| Coordination dashboard | `docs/use-cases.md`, `docs/screen-inventory.md` | `src/features/dashboard/`, `docs/stitch-prompts/dashboard.md` |
| PWA/offline/sync UX and future implementation | `docs/offline-ux.md`, `docs/ui-states.md`, `docs/decision-record.md` | `src/lib/pwa/`, `src/features/sync/` |
| Responsive layouts and visual system | `docs/layout-system.md`, `docs/design-system.md` | `docs/component-catalog.md`, `docs/ui-reuse-matrix.md`, `src/components/` |
| UX sitemap, screens and flows | `docs/sitemap.md`, `docs/screen-inventory.md`, `docs/user-flows.md` | `docs/stitch-prompts/`, `docs/google-stitch-master-prompt.md` |
| Component reuse and promotion decisions | `docs/component-catalog.md`, `docs/ui-reuse-matrix.md` | `src/components/`, relevant feature `components/` |
| Existing tests and verification limits | `tests/starter.spec.mjs`, `scripts/verify.mjs` | `public-tests/check.sh`, `Makefile` |
| Environment variables, API, database or migrations | No implementation exists | Do not assume configuration; request approval before introducing it |

## Decision Boundaries Requiring Clarification

Ask before implementing or changing either of these unresolved product rules:

1. Whether a `resolved` finding can be reopened or whether follow-up statuses can skip transitions.
2. Whether a technician can set the initial finding priority or whether it belongs exclusively to coordination.

When requirements conflict with an accepted ADR, follow the ADR and document the conflict before changing the design.
