# VETTO

VETTO is a brand-content intelligence and review platform. It checks uploaded content against a stored brand identity, visual direction, and governance rules, then routes the result through a human review workflow. Every finding points back to extracted evidence or a configured rule, and every decision is recorded.

## Current status

VETTO is being prepared for the Round 3 evaluation. The promised improvements are evidence-gated AI claim/tone review, Manager-to-Supervisor escalation, and an Admin rule-clarity signal. OCR for scanned PDF pages, available font metadata matching, email verification, and password reset are also implemented. Deployment and live-provider behavior must be verified against the current build before claiming those checks pass. The Windows QA harness runs isolated lint, typecheck, production build, API, upload, and browser workflow checks against a temporary database; see [Verification](#verification).

- **Foundation:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, PostgreSQL + Prisma, responsive editorial shell, security headers.
- **Auth and roles:** database-backed sessions with HttpOnly cookies, server-enforced permissions, Creator-only public registration, email verification, password reset, seeded Creator/Supervisor/Manager/Admin accounts, Admin user management (create, change role, deactivate), server-side validation, rate limiting, and audit logging.
- **Brand identity:** original split-V symbol with copper accent, custom monoline VETTO wordmark, full lockup and app-icon system; used consistently across UI, favicon, and Apple touch icon.
- **Authentication experience:** cinematic 1.7s intro (logo → tagline → glass panel), Apple-style glassmorphism, warm neutral palette, reduced-motion support, animated form height switching between Sign In and Create Account.
- **Brand intelligence:** create/edit brands, profile, approved palette, fonts, assets, and rule configuration with audit history.
- **Uploads and storage:** validated image/PDF/DOCX intake, magic-byte detection, private local or S3-compatible storage, authenticated file delivery.
- **Extraction:** Sharp image metadata and palette extraction, Tesseract OCR with word evidence, unpdf text extraction, mammoth DOCX extraction.
- **Analysis:** deterministic brand-rule checks, visual quality checks, palette alignment, heuristic logo matching, optional AI claim/tone reasoning tied to an active rule and an exact extracted quote, weighted scores, findings with evidence and limitations.
- **Review workflow:** submit for review, approve, request changes, Manager escalation to an assigned Supervisor, Supervisor decision returned to the Manager, comments, finding triage (open/acknowledged/resolved/dismissed), review timeline, and audit records.
- **Operations:** live health endpoint, system-readiness panel, role-aware dashboards and queues, an Admin signal for repeatedly waived rules, and demo seed data.

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

### Demo accounts and judge access

Public sign-up creates Creator accounts only. Admins can assign Supervisor, Manager, or Admin access from user management. The login page's role cards identify which account the user intends to use; the role is loaded from the authenticated database account.

#### Judge demo accounts

Choose a role account for the judge walkthrough. All four seeded accounts use the same password:

- **Admin:** `admin@vetto.test`
- **Manager:** `manager@vetto.test`
- **Supervisor:** `supervisor@vetto.test`
- **Creator:** `creator@vetto.test`
- **Shared password:** `fy2232b3rfhnf4u5h98fj4i5f3eewe5`

For these credentials to work, set Render's `SEED_PASSWORD` to this same value and seed the isolated judge database. Use these accounts only for judging with fictional demo data.

**Security:** public registration cannot assign elevated roles. Use a separate demo database and storage bucket containing fictional/demo data; never use demo credentials for real customer data. For the seeded judge account, run the production seed with `VETTO_ALLOW_DEMO_SEED_IN_PRODUCTION=true` and a custom `SEED_PASSWORD` of at least 16 characters. Seeding resets demo accounts and brand configuration.

| Email               | Role    | Purpose                                      |
| ------------------- | ------- | -------------------------------------------- |
| `admin@vetto.test`  | ADMIN   | Full workspace and settings access           |
| `manager@vetto.test`| MANAGER | Approve content or request changes           |
| `supervisor@vetto.test` | SUPERVISOR | Review Manager-approved content assigned to them and triage its findings |
| `creator@vetto.test`| CREATOR | Upload, analyze, and submit content          |

Demo users share the same records, so their actions can change what the next judge sees. Re-run the seed to restore seeded accounts and brand configuration; it does not remove all uploaded or test records.

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

### Demo brand and sample file library

The demo seed provides three fictional brands with separate profiles, palettes, approved fonts, rules, logo assets, and campaign artwork:

| Brand | Sample campaign upload | Sample brief |
| --- | --- | --- |
| Aurelia Coffee Roasters | `public/demo/aurelia-poster.png` | `public/demo/aurelia-brief.docx` |
| Luma Field Botanicals | `public/demo/luma-field-botanicals-campaign.png` | `public/demo/luma-field-botanicals-brief.docx` |
| Trailform Outdoor Co. | `public/demo/trailform-outdoor-campaign.png` | `public/demo/trailform-outdoor-brief.docx` |

`public/demo/aurelia-offer.pdf` is also available for the PDF upload flow. Luma Field's brief intentionally includes unsupported skincare claims and omits its disclaimer; Trailform's brief includes an absolute weatherproofing claim. Upload each file against the matching brand to demonstrate rule findings and review. The additional campaign PNGs are designed demo artwork, not product photography.

To add just the two new brands to an existing local database without resetting demo account passwords or rewriting Aurelia's profile, run this in PowerShell:

```powershell
$env:DEMO_BRANDS_ONLY = "true"
npm run db:seed
Remove-Item Env:DEMO_BRANDS_ONLY
```

This creates the new brand records and generated sample files. The normal seed still resets the demo accounts and Aurelia configuration; it now preserves an existing `public/demo/aurelia-brief.docx` instead of replacing it. To generate only the sample files without a database connection, set `DEMO_FILES_ONLY` instead.

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
| `RESEND_API_KEY`         | Production  | Resend API key for verification and password reset email      |
| `AUTH_EMAIL_FROM`        | Production  | Verified sender address, e.g. `VETTO <accounts@yourdomain.com>` |
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
   - PDFs: embedded text per page, OCR for pages without usable text, and embedded font-family metadata where available.
   - DOCX: raw document text and declared font-family metadata where available.
3. Deterministic checks compare extracted evidence against the brand profile and active rules: forbidden/required phrases, required disclaimers, claim patterns, keywords, palette alignment, visual quality, approved-logo similarity, and available font metadata.
4. Scores are computed per available category and renormalized using the configured weights. Missing evidence is reported as unavailable, never as a pass.
5. If `AI_API_KEY` is configured, contextual reasoning adds low/medium-severity findings and a brand-vibe score. AI failure is recorded but never blocks deterministic results.
6. A creator can submit review-ready content. A manager approves it or requests changes. The content is locked from processing while submitted or approved.

## Known limitations

- Font matching compares embedded PDF/DOCX metadata when present. OCR/image sources often lack font metadata, so those files report font matching as unavailable.
- Logo detection is a perceptual-hash heuristic; cropped, recolored, or composited logos can be missed and the UI says so.
- Palette extraction is quantized and sampled by coverage; small intentional accents may appear as off-palette findings.
- Scanned PDF OCR is limited to the first 12 pages that need OCR and can be less accurate on low-resolution, skewed, or non-English pages.
- New self-registered accounts must verify email before sign-in. Configure `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and `NEXT_PUBLIC_APP_URL` for production verification and password reset mail. Development shows the generated verification link on screen when email delivery is not configured.
- Password reset links expire after one hour and can be used once; completing a reset revokes all existing sessions for that account.
- Only PNG, JPEG, WebP, PDF, and DOCX are accepted. SVG is rejected for upload safety; legacy DOC is not supported.
- Local disk storage and background work are single-instance. Production needs object storage, and serverless platforms impose request-size limits that may require direct-to-storage uploads.
- Reviewers are not notified by email; queues update when pages are refreshed or revalidated.
- The unclear-rule signal is heuristic: it checks each content item's latest completed analysis and flags active rules with at least three findings and two or more currently dismissed findings. It is a prompt for human review, not proof that a rule is unclear.
- Supervisor escalations pause a submitted content decision until the assigned Supervisor responds; they do not send notifications.
- The audit log is written for every decision, upload, and finding change, but only the review history is readable in the UI; raw audit rows are inspected through Prisma Studio or SQL.
- A finding's method and confidence are shown with its evidence. Confidence is the engine's confidence in the match, not a probability that the content is non-compliant.
- AI scoring depends on the configured provider and model and is optional.
- Rate limiting is in-memory and single-instance; a multi-instance deployment would need a shared store (e.g., Redis).
- **Brand assets:** the logo system uses static SVG files; dynamic recoloring is not supported beyond the provided inverted variant.

## Deployment status

The project is deployed on Render. The `prestart` script runs `prisma migrate deploy` before the Next.js server starts, so pending migrations are applied during deployment. New source changes are not live until committed and deployed. Verify the health endpoint and test sign-in, verification email delivery, password reset, and one AI review after each deployment. Set `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and the public Render URL in `NEXT_PUBLIC_APP_URL` before relying on production verification or password reset mail.

## Five-minute demo script

1. Sign in as `creator@vetto.test` and land on **My Work**.
2. **Upload content** for Aurelia Coffee Roasters using `public/demo/aurelia-poster.png`; show the extracted text, dominant palette, OCR confidence, and overall score.
3. Open one finding and read its evidence excerpt, method, confidence, and recommendation; point out the **Block · High** decision label and the listed limitations.
4. Submit for review with a short note, then show the item is locked from reprocessing.
5. Sign in as `manager@vetto.test`, request changes with a note, sign back in as the creator, resubmit, then approve as the manager. Expand **Review history** to show each actor and timestamp.
6. As Manager, assign the approved item to a Supervisor. Verify the Supervisor cannot open an unassigned item, then submit a secondary review and dismiss a finding without a reason (rejected) and with a reason (saved).
7. Sign in as `admin@vetto.test` for **Settings** readiness and the brand rule list, then state the deployment status and known limitations plainly.

Avoid claiming during the demo: OCR beyond the first 12 scanned pages, typography matching for image-only/OCR files, email notifications to reviewers, or AI results when `AI_API_KEY` is unset.
