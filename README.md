# VETTO

VETTO is a brand-content intelligence and review platform. It checks uploaded content against a stored brand identity, visual direction, and governance rules, then routes the result through a human review workflow. Every finding points back to extracted evidence or a configured rule, and every decision is recorded.

## Current status

Phases 1-9 are implemented. On 2026-11-18, `scripts/run-qa.ps1` passed on Node 24.17.0 against an isolated PostgreSQL 18 QA database: `npm run lint`, `npm run typecheck`, `npm run build`, 27 API checks, and 12 browser workflow checks. The run covered role access, Manager-to-Supervisor assignment, review history, audit logging, malformed AI output, provider outage, unsupported and oversized uploads, and file access controls. Four generated files (3.77-6.20 MiB) completed upload, extraction, and analysis in 0.7-4.2 seconds per file. The configured local PostgreSQL database was also migrated and queried successfully with the SupervisorAssignment relation. AI validation and provider failure were tested with a local mock, not a live AI provider. Deployment is still blocked on production credentials and a Git remote; see [Deployment status](#deployment-status).

- **Foundation:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, PostgreSQL + Prisma, responsive editorial shell, security headers.
- **Auth and roles:** database-backed sessions with HttpOnly cookies, server-enforced permissions, seeded Creator/Supervisor/Manager/Admin accounts, **fully functional registration with Creator role assignment**, admin user management (create, change role, deactivate), server-side validation, rate limiting, and audit logging. No email verification or password recovery (documented limitation).
- **Brand identity:** original split-V symbol with copper accent, custom monoline VETTO wordmark, full lockup and app-icon system; used consistently across UI, favicon, and Apple touch icon.
- **Authentication experience:** cinematic 1.7s intro (logo → tagline → glass panel), Apple-style glassmorphism, warm neutral palette, reduced-motion support, animated form height switching between Sign In and Create Account.
- **Brand intelligence:** create/edit brands, profile, approved palette, fonts, assets, and rule configuration with audit history.
- **Uploads and storage:** validated image/PDF/DOCX intake, magic-byte detection, private local or S3-compatible storage, authenticated file delivery.
- **Extraction:** Sharp image metadata and palette extraction, Tesseract OCR with word evidence, unpdf text extraction, mammoth DOCX extraction.
- **Analysis:** deterministic brand-rule checks, visual quality checks, palette alignment, heuristic logo matching, optional AI reasoning, weighted scores, findings with evidence and limitations.
- **Review workflow:** submit for review, approve, request changes, comments, finding triage (open/acknowledged/resolved/dismissed), review timeline, and audit records.
- **Operations:** live health endpoint, system-readiness panel, role-aware dashboards and queues, demo seed data.

## Stack

- Next.js 16.4 + React 19.3 + TypeScript
- Tailwind CSS 4, Fraunces and Inter
- PostgreSQL 18 + Prisma 6
- Zod for validation
- Sharp, Tesseract.js, unpdf, mammoth, file-type for extraction
- Optional OpenAI-compatible chat-completions provider for contextual review

## Brand identity

The VETTO mark consists of an original geometric split-V symbol and a custom monoline VETTO wordmark.

- **Symbol (`public/brand/vetto-symbol.svg`)** – two tapered blades forming a V; the left blade is charcoal, the right blade is copper (`#a85c40`). An inverted version (`vetto-symbol-inverted.svg`) uses surface white and bright copper (`#c57b5c`) for dark backgrounds.
- **Wordmark (`public/brand/vetto-wordmark.svg`)** – monoline geometric uppercase letters, stroke-based, colour `currentColor` for easy theming. Inverted variant available.
- **Lockup (`public/brand/vetto-lockup.svg`)** – symbol + wordmark horizontal composition, 224×44 viewBox.
- **App icon (`src/app/icon.svg`)** – rounded-square dark background with centred symbol; `apple-icon.png` (180×180) generated at build time.
- All UI instances use the `BrandMark` component which composes the symbol, wordmark, and optional tagline. The old square “V” placeholder and “VETTO ROUND 2 · Internal preview” label have been removed.

## Requirements

- Node.js **24 or newer** (`unpdf` requires Node 24)
- npm
- PostgreSQL with a database and connection string

## Run VETTO on your computer

```bash
npm ci
```

Create your local environment file from the template:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to a PostgreSQL database you created for VETTO. The example value is a template, not a working database connection. Keep `.env` private and never commit it. For a local PostgreSQL server, a connection string has this form:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/vetto?schema=public"
```

Apply the schema, add fictional demo data, and start the app:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The root route redirects to `/dashboard`. To use the demo seed accounts, see [Demo accounts](#demo-accounts).

### Open the running app on another device on your Wi-Fi

This shares the app running on your computer with devices on the same local network. Only the computer running VETTO needs Node.js and the database; the other devices use a browser.

1. Connect the host computer and the other device to the same trusted Wi-Fi or LAN.
2. On the host computer, find its private IPv4 address. On Windows, run `ipconfig` and look for the Wi-Fi adapter's **IPv4 Address** (for example, `192.168.1.25`). On macOS or Linux, use your network settings to find its IPv4 address.
3. Set `NEXT_PUBLIC_APP_URL` in the host computer's `.env` to that address, including the port, for example `NEXT_PUBLIC_APP_URL="http://192.168.1.25:3000"`. Restart the app after changing it.
4. Start Next.js listening on the network interface:

   ```bash
   npm run dev -- --hostname 0.0.0.0
   ```

5. On the other device, open `http://192.168.1.25:3000` using the host's actual IPv4 address.

If the page does not load, allow Node.js or inbound TCP port 3000 on the host computer's **Private network** firewall profile, and check that the Wi-Fi does not isolate devices from each other. Do not expose this development server to the public internet. Local uploads and the database remain on the host computer.

### Install VETTO on another computer

Each computer running VETTO needs Node.js 24+, npm, PostgreSQL, a copy of the repository, and its own `.env` file. Once the project has been pushed to GitHub, clone it on the other computer and run:

```bash
git clone https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
npm ci
```

Create `.env` from `.env.example` using the Windows or macOS/Linux command above. Set `DATABASE_URL` to a PostgreSQL database reachable from that computer, then run:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

This creates a separate VETTO instance and database. If several people need to work in the same workspace, run one shared server and database, then have their devices use the LAN or deployed URL instead. Do not point different developer machines at the same database while using the demo seed or test scripts.

The seed creates demo users, a fictional `Aurelia Coffee Roasters` brand, rules, colors, fonts, a logo, and sample assets. The fictional poster, brief, and offer PDF in `public/demo/` are included for local testing; they do not represent a real company or customer.

### Sample and large test files

Use the small synthetic sample files in `public/demo/` to try upload, extraction, and analysis. To generate four larger synthetic image, PDF, and DOCX fixtures (3-6 MiB each) for stress testing, run:

```bash
node scripts/create-large-fixtures.mjs
```

The generated files are written to `.vetto-qa/fixtures/`, which is git-ignored so test data does not inflate the repository. The fixtures contain fabricated Aurelia campaign copy and random filler; do not treat the results as real brand assessments.

### Demo accounts

Development seed accounts use the password `Vetto!Dev123` (override with `SEED_PASSWORD`). The demo seed refuses to run in production unless `VETTO_ALLOW_DEMO_SEED_IN_PRODUCTION=true` and a custom `SEED_PASSWORD` of at least 16 characters are explicitly set. Avoid demo seed accounts in a public production workspace.

| Email               | Role    | Purpose                                      |
| ------------------- | ------- | -------------------------------------------- |
| `admin@vetto.test`  | ADMIN   | Full workspace and settings access           |
| `manager@vetto.test`| MANAGER | Approve content or request changes           |
| `supervisor@vetto.test` | SUPERVISOR | Review Manager-approved content assigned to them and triage its findings |
| `creator@vetto.test`| CREATOR | Upload, analyze, and submit content          |

### Role and data-access matrix

Enforced on the server in `src/lib/auth/permissions.ts`, `src/lib/auth/guards.ts`, and every server action; navigation only mirrors it. The workspace is single-tenant: every signed-in member can read brand configuration and brand assets. Managers/Admins can view all content; Creators can view their own; Supervisors can view only Manager-approved items assigned to them.

| Capability | Creator | Supervisor | Manager | Admin |
| --- | --- | --- | --- | --- |
| Upload/process own content | Yes | No | No | Yes |
| Submit own content for review | Yes | No | No | Yes (any) |
| View all content in the workspace | No | Only approved items assigned to them | Yes | Yes |
| Record approve / request-changes decisions | No | No | Yes | Yes |
| Assign a Manager-approved review to a Supervisor | No | No | Yes | No |
| Submit a secondary review on assigned approved content | No | Yes | No | No |
| Triage findings (open, acknowledge, resolve, dismiss) | No | Yes | Yes | Yes |
| Manage brands, palette, fonts, assets, rules | No | No | No | Yes |
| Manage users | No | No | No | Yes |
| Workspace settings and readiness | No | No | No | Yes |

Deliberate decisions in this build:

- **Supervisor reviews are assigned by Managers.** Supervisors only see approved content assigned to them, can submit a secondary review note and triage its findings, and cannot change the Manager's approval.
- **Only Admins configure brands.** Managers review content and triage findings; they see brand configuration read-only, matching what the role description and navigation already said.
- **Dismissing a finding is a waiver** and requires a written reason. The reason, the previous status, and a waiver flag are written to the audit log.
- **Severity is surfaced as Block / Warn / Suggest** (`CRITICAL` + `HIGH` → Block, `MEDIUM` → Warn, `LOW` + `INFO` → Suggest) while the stored severity value stays unchanged for scoring and audit.

### Suggested walkthrough

1. Sign in as `creator@vetto.test` and open **Content -> Upload content**.
2. Upload `public/demo/aurelia-poster.png`; the UI uploads, extracts, and analyzes it in one flow.
3. Inspect the extracted text, palette, scores, findings, and limitations on the detail page.
4. Submit the content for review with an optional note.
5. Sign in as `manager@vetto.test`, open **Reviews**, and approve or request changes. Finding statuses can be triaged on the same detail page.
6. As Manager, assign the approved item to `supervisor@vetto.test`. Sign in as the Supervisor, add a secondary review, then triage a finding. Choosing **Dismissed** without a reason is rejected; with a reason it is saved and audited.
7. Sign in as `admin@vetto.test` and open **Settings** for live readiness checks.

## Routes

| Route                          | Behaviour                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| `/`                            | Redirects to `/dashboard`                                        |
| `/login`                       | Session login                                                    |
| `/dashboard`                   | Role-aware metrics, review queue, recent content, and activity   |
| `/brands`                      | Brand list                                                       |
| `/brands/new`                  | Create a brand with optional profile intelligence                |
| `/brands/[id]`                 | Profile, palette, fonts, assets, rules, and delete actions       |
| `/content`                     | Accessible content list with latest score and findings           |
| `/content/new`                 | Upload and process a new asset                                   |
| `/content/[id]`                | Preview, extraction evidence, scores, findings, review workflow  |
| `/reviews`                     | Review queue and recent review activity                          |
| `/users`                       | Workspace members, roles, and activation (Admin only)            |
| `/settings`                    | System readiness and runtime details (Admin only)                |
| `/api/health`                  | Database connectivity health check                               |
| `/api/brands/[id]/assets`      | Authenticated brand asset upload                                 |
| `/api/brand-assets/[assetId]`  | Authenticated brand asset download                               |
| `/api/content`                 | Authenticated content upload                                     |
| `/api/content/[id]/file`       | Authenticated original-file download/preview                     |
| `/api/content/[id]/extract`    | Run extraction                                                   |
| `/api/content/[id]/analyze`    | Run deterministic analysis and optional AI review                |

## Scripts

| Command              | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the development server             |
| `npm run build`      | Create a production build                |
| `npm run start`      | Run the production build                 |
| `npm run lint`       | Run ESLint                               |
| `npm run typecheck`  | Run TypeScript without emitting files    |
| `npm run db:migrate` | Create and apply development migrations  |
| `npm run db:deploy`  | Apply committed migrations in production |
| `npm run db:seed`    | Seed demo users, brand, and assets       |
| `npm run db:generate`| Regenerate the Prisma client             |
| `npm run db:studio`  | Open Prisma Studio                       |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-qa.ps1` | Run isolated database, build, large-file, AI-fallback, role, and browser review verification on Windows |
| `npm run verify:api` | Role/upload/analysis checks against a running server |
| `npm run verify:review` | Drives the review loop and waivers in headless Chrome |

The QA harness requires PostgreSQL 18 and Google Chrome on Windows. It creates an isolated cluster, uses a local mock AI provider (no external AI key), and writes generated files, uploads, and logs under the ignored `.vetto-qa/` directory. It does not use or modify the `DATABASE_URL` database configured in `.env`.

## Verification

Both verification scripts create real sessions, use the seeded demo brand, and assert on persisted records. They need a running server built from the current source and a seeded database:

```bash
npm run build
npx next start -p 3101

BASE_URL=http://127.0.0.1:3101 npm run verify:api
BASE_URL=http://127.0.0.1:3101 npm run verify:review
```

Last recorded run (Node 24.17.0, Next.js 16.4.6, local PostgreSQL 18):

- `npm run lint`, `npm run typecheck`, and `npm run build` pass from a clean `.next`.
- `verify:api` — 27/27 checks in the full harness. Covers logged-out redirects, per-role page access, creator-only upload, PNG/PDF/DOCX/WebP extraction and analysis, original-file download and 401/403/404 handling, unsupported and 21 MB rejection, archived-brand rejection, cross-user content denial, upload audit rows, and submission locking.
- `verify:review` — 12/12 checks. Covers the creator/manager decision loop, denied unassigned Supervisor access, Manager assignment, secondary review without changing approval, review history, waiver reasons, audit metadata, and post-approval locking.
- The scripts add content and audit rows to the database each run. Delete `scripts/verify-*` content records if you need a pristine demo.

## Environment variables

Names only; never commit values.

| Name                    | Required    | Purpose                                                        |
| ----------------------- | ----------- | -------------------------------------------------------------- |
| `DATABASE_URL`          | Yes         | PostgreSQL connection string                                   |
| `NEXT_PUBLIC_APP_URL`   | Recommended | Canonical application URL (defaults to `http://localhost:3000`) |
| `STORAGE_DRIVER`        | Production  | `local` (development default) or `s3`                          |
| `S3_ENDPOINT`           | S3 only     | S3-compatible endpoint                                         |
| `S3_REGION`             | S3 only     | Bucket region                                                  |
| `S3_BUCKET`             | S3 only     | Bucket name                                                    |
| `S3_ACCESS_KEY_ID`      | S3 only     | S3 access key                                                  |
| `S3_SECRET_ACCESS_KEY`  | S3 only     | S3 secret key                                                  |
| `S3_FORCE_PATH_STYLE`   | S3 only     | Set `true` for path-style endpoints                            |
| `AI_API_KEY`            | Optional    | Enables contextual AI review; deterministic analysis always runs |
| `AI_BASE_URL`           | Optional    | OpenAI-compatible base URL (default `https://api.openai.com/v1`) |
| `AI_MODEL`              | Optional    | Chat-completions model (default `gpt-4o-mini`)                 |

In production, startup configuration fails if storage is not explicitly configured. Local disk storage is intended for development only.

## How analysis works

1. The file is validated by magic bytes and stored with a private, generated key.
2. Extraction records the source text and visual metadata:
   - Images: dimensions, dominant palette, OCR text, confidence, and word boxes.
   - PDFs: embedded text per page.
   - DOCX: raw document text.
3. Deterministic checks compare extracted evidence against the brand profile and active rules: forbidden/required phrases, required disclaimers, claim patterns, keywords, palette alignment, visual quality, and approved-logo similarity.
4. Scores are computed per available category and renormalized using the configured weights. Missing evidence is reported as unavailable, never as a pass.
5. If `AI_API_KEY` is configured, contextual reasoning adds low/medium-severity findings and a brand-vibe score. AI failure is recorded but never blocks deterministic results.
6. A creator can submit review-ready content. A manager approves it or requests changes. The content is locked from processing while submitted or approved.

## Known limitations

- OCR does not reliably expose font metadata, so typography matching is not scored.
- Logo detection is a perceptual-hash heuristic; cropped, recolored, or composited logos can be missed and the UI says so.
- Palette extraction is quantized and sampled by coverage; small intentional accents may appear as off-palette findings.
- PDF extraction reads embedded text only; scanned PDFs without a text layer are not OCRed in this build.
- Only PNG, JPEG, WebP, PDF, and DOCX are accepted. SVG is rejected for upload safety; legacy DOC is not supported.
- Local disk storage and background work are single-instance. Production needs object storage, and serverless platforms impose request-size limits that may require direct-to-storage uploads.
- Reviewers are not notified by email; queues update when pages are refreshed or revalidated.
- Supervisor assignment covers Manager-approved reviews. There is no separate escalation object or escalation workflow for findings.
- The audit log is written for every decision, upload, and finding change, but only the review history is readable in the UI; raw audit rows are inspected through Prisma Studio or SQL.
- A finding's method and confidence are shown with its evidence. Confidence is the engine's confidence in the match, not a probability that the content is non-compliant.
- AI scoring depends on the configured provider and model and is optional.
- **Authentication:** no email verification or password recovery flows exist. Accounts are active immediately after registration. Rate limiting is in-memory and single-instance; a multi-instance deployment would need a shared store (e.g., Redis).
- **Brand assets:** the logo system uses static SVG files; dynamic recoloring is not supported beyond the provided inverted variant.

## Deployment status

No public deployment exists yet, so the app has not been verified with the development laptop off. Deployment is blocked on credentials, a Git remote, and an account owner.

What is ready: a passing Webpack production build, verified migrations in both the isolated QA database and the configured local PostgreSQL database, a `/api/health` endpoint that reports database connectivity, production refusal to start with unconfigured object storage, secure session cookies in production, rate limiting on sign-in and registration, and the full environment-variable list above. A production database, S3-compatible storage, and a public deployment were not available during this audit. No Git remote is configured and the project files are currently untracked, so source control setup is still required.

What is required from the account owner:

1. A hosting provider that can run a Next.js 16 server (not a static export) with request limits that allow 20 MB uploads and 60-second extraction/analysis requests.
2. A managed PostgreSQL database and an S3-compatible bucket. Set `STORAGE_DRIVER=s3` plus the `S3_*` values in the host secret store, never in the repository.
3. A Git remote, then `npm run db:deploy` against production. Use an intentional account bootstrap process; demo seeding is blocked by default in production.
4. `NEXT_PUBLIC_APP_URL` set to the public URL so redirects and readiness checks are accurate.

After deploying, repeat the two verification scripts against the public URL and confirm `/api/health` reports `"database":"connected"` before calling the project deployed.

## Five-minute demo script

1. Sign in as `creator@vetto.test` and land on **My Work**.
2. **Upload content** for Aurelia Coffee Roasters using `public/demo/aurelia-poster.png`; show the extracted text, dominant palette, OCR confidence, and overall score.
3. Open one finding and read its evidence excerpt, method, confidence, and recommendation; point out the **Block · High** decision label and the listed limitations.
4. Submit for review with a short note, then show the item is locked from reprocessing.
5. Sign in as `manager@vetto.test`, request changes with a note, sign back in as the creator, resubmit, then approve as the manager. Expand **Review history** to show each actor and timestamp.
6. As Manager, assign the approved item to a Supervisor. Verify the Supervisor cannot open an unassigned item, then submit a secondary review and dismiss a finding without a reason (rejected) and with a reason (saved).
7. Sign in as `admin@vetto.test` for **Settings** readiness and the brand rule list, then state the deployment status and known limitations plainly.

Avoid claiming during the demo: font matching, scanned-PDF OCR, escalation queues, email notifications, or AI results when `AI_API_KEY` is unset.
