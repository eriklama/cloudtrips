# CloudTrips

A personal trip planner web app. Plan trips, track activities, manage costs, and share itineraries.

**Live:** [cloudtrips.uk](https://cloudtrips.uk)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | HTML + Tailwind CSS + vanilla JS (modular, no bundler) |
| Backend | Cloudflare Pages Functions (TypeScript) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Auth | JWT (HS256, 7-day expiry) + PBKDF2 password hashing |
| Email | Brevo API (password reset, invite emails) |
| Hosting | Cloudflare Pages (`cloudtrips.pages.dev`) |
| Domain | `cloudtrips.uk` |

---

## Features

- Auth — login, signup, password reset via email
- CRUD trips and activities
- Per-activity type, location, cost, currency, distance, notes
- Multi-currency cost totals
- Trip notes
- Timeline (list + calendar view)
- Costs breakdown page
- Print / PDF export (server-side via Browserless)
- Share trips (full or public mode), share link management
- Trip collaboration — invite members by email, role-based access (owner / editor)
- User settings (default currency)
- Visited countries tracking
- Dark / light mode
- Mobile responsive
- PWA — installable on desktop and mobile (manifest + service worker)
- Trip search + year filter
- Activity reordering
- Optimistic UI with rollback on failure
- Rate limiting on login/signup (KV-backed)
- Email verification (hard gate — unverified users cannot access the app)
- Account deletion (self-service via Settings, or admin-initiated)
- PDF export quota — 5 free exports/month per user, 100 for paid, unlimited for admin-granted accounts
- Admin panel — user management, PDF usage tracking, error log
- Trips list pagination (20/page)

---

## Project Structure

```
cloudtrips/
├── public/                    # Frontend (served as static files)
│   ├── state.js               # Global state + API URL constants
│   ├── helpers.js             # Pure utilities, formatters, normalizers
│   ├── api.js                 # Fetch wrappers (apiFetch, apiGet, apiPost)
│   ├── auth.js                # JWT storage, login/signup handlers, requireAuth
│   ├── ui.js                  # HTML string rendering (trip cards, activities, costs)
│   ├── trips.js               # Index page logic (load, add, rename, delete, filter)
│   ├── activities.js          # Trip page logic (save, edit, delete, reorder)
│   ├── share.js               # Share link creation and management
│   ├── members.js             # Trip collaboration (invite, remove, list members)
│   ├── export.js              # PDF export logic
│   ├── init.js                # App entry point, timeline, costs, nav, header, SW registration
│   ├── sw.js                  # Service worker (cache-first static, network-only API)
│   ├── manifest.json          # PWA web app manifest
│   ├── robots.txt             # Search engine directives
│   └── *.html                 # Pages (index, trip, timeline, costs, stats, print, login, signup, forgot, reset, accept-invite, verify-email, admin, privacy, terms)
├── functions/
│   ├── _middleware.ts         # CORS headers for all routes
│   ├── _lib/
│   │   ├── auth.ts            # JWT helpers, requireUser, password hashing
│   │   ├── share.ts           # Share token helpers
│   │   ├── members.ts         # Trip membership helpers (isTripOwner, isTripMember, canAccessTrip)
│   │   ├── http.ts            # json(), error(), methodNotAllowed() helpers
│   │   └── sendVerificationEmail.ts  # Shared email verification helper
│   └── api/
│       ├── login.ts
│       ├── signup.ts
│       ├── me.ts
│       ├── getTrips.ts
│       ├── getTrip.ts
│       ├── saveTripMeta.ts
│       ├── deleteTrip.ts
│       ├── duplicateTrip.ts
│       ├── upsertActivity.ts
│       ├── deleteActivity.ts
│       ├── reorderActivities.ts
│       ├── shareTrip.ts
│       ├── getErrors.ts
│       ├── getShares.ts
│       ├── revokeShare.ts
│       ├── disableShare.ts
│       ├── inviteMember.ts
│       ├── acceptInvite.ts
│       ├── removeMember.ts
│       ├── getTripMembers.ts
│       ├── exportPdf.ts
│       ├── getPdfUsage.ts
│       ├── getUserSettings.ts
│       ├── saveUserSettings.ts
│       ├── getVisitedCountries.ts
│       ├── saveVisitedCountries.ts
│       ├── getStats.ts
│       ├── verifyEmail.ts
│       ├── resendVerification.ts
│       ├── deleteAccount.ts
│       ├── getUsers.ts
│       ├── setUserUnlimited.ts
│       ├── adminDeleteUser.ts
│       ├── requestPasswordReset.ts
│       └── resetPassword.ts
├── migrations/
│   ├── 001_add_km.sql
│   ├── 002_drop_share_tokens.sql
│   ├── 003_share_mode.sql
│   ├── 004_password_resets.sql
│   ├── 005_trip_notes.sql
│   ├── 006_activities_table.sql
│   ├── 007_add_stats.sql
│   ├── 008_drop_activities_json.sql
│   ├── 009_error_logs.sql
│   ├── 010_visited_countries.sql
│   ├── 011_user_settings.sql
│   ├── 012_trip_members.sql
│   ├── 013_email_verification.sql
│   ├── 014_admin_pdf_quota.sql
│   └── 015_pdf_monthly_limit.sql
├── src/
│   └── input.css              # Tailwind source
├── build.cjs                  # Build script (Tailwind + cache-bust + deploy)
├── wrangler.toml              # Cloudflare bindings config
├── tailwind.config.js
└── package.json
```

---

## Database Schema

```sql
users (
  id, email, password_hash, settings, email_verified_at,
  is_admin, pdf_monthly_limit, created_at
)

trips (
  id, user_id, name, notes, country, created_at
)

activities (
  id, trip_id, user_id, type, name, location,
  start_date, end_date, cost, currency, distance,
  notes, sort_order, created_at
)

trip_shares (
  id, trip_id, token_hash, mode, created_by_user_id,
  created_at, expires_at, last_used_at, revoked_at
)

trip_members (
  id, trip_id, user_id, role, invited_by, created_at
)

trip_invites (
  id, trip_id, email, token_hash, invited_by,
  expires_at, accepted_at, created_at
)

password_resets (
  id, user_id, token_hash, expires_at, used_at, created_at
)

visited_countries (
  user_id, countries
)

email_verifications (
  id, user_id, token_hash, expires_at, used_at, created_at
)

error_logs (
  id, message, stack, url, user_id, created_at
)
```

---

## Cloudflare Setup

### Required bindings (set in dashboard + wrangler.toml)

| Type | Binding name | Value |
|---|---|---|
| D1 Database | `DB` | `trips` database |
| KV Namespace | `RATE_LIMIT_KV` | `TRIPS` namespace |

### Required environment variables (set as encrypted secrets in dashboard)

| Variable | Description |
|---|---|
| `JWT_SECRET` | Long random string used to sign JWTs |
| `JWT_PEPPER` | Random string added to passwords before hashing |
| `BREVO_API_KEY` | Brevo API key for sending emails |
| `BREVO_SENDER_EMAIL` | Sender address for emails |
| `ADMIN_EMAIL` | Email address with access to admin endpoints (e.g. getPdfUsage) |
| `BROWSERLESS_API_KEY` | API key for Browserless PDF rendering (export feature) |

> ⚠️ Never put secret values in `wrangler.toml` — only binding names and IDs go there.

---

## Local Development

Prerequisites: Node.js, npm, Wrangler authenticated (`npx wrangler login`)

```bash
# Install dependencies
npm install

# Run locally (uses local D1 + KV)
npx wrangler pages dev public
```

For local dev you'll need a `.dev.vars` file in the repo root (gitignored):

```
JWT_SECRET=your-local-secret
JWT_PEPPER=your-local-pepper
BREVO_API_KEY=your-brevo-key
BREVO_SENDER_EMAIL=you@example.com
ADMIN_EMAIL=you@example.com
BROWSERLESS_API_KEY=your-browserless-key
```

---

## Deployment

### Deploy to Cloudflare Pages

```bash
node build.cjs
```

This runs Tailwind, injects cache-busting `?v=TIMESTAMP` into all script tags, then deploys via `wrangler pages deploy public`. Use `--dry` to build without deploying.

> **Cloudflare Pages build settings:** set the build command to `node build.cjs --dry` — this runs Tailwind and cache-busting but skips the deploy step, since Cloudflare handles deployment itself.

> ⚠️ Pushing to `main` triggers a Cloudflare auto-deploy via GitHub integration, but **without cache-busting** — users may get stale JS from the service worker or browser cache. Always use `node build.cjs` for production releases.

### Run database migrations

```bash
npx wrangler d1 migrations apply trips --remote
```

---

## CSS / Tailwind

Tailwind is compiled to `public/output.css`. To rebuild after changing styles:

```bash
npm run build
```

---

## PWA

CloudTrips is installable as a Progressive Web App on both desktop and mobile.

- `public/manifest.json` — app name, icons, display mode
- `public/sw.js` — service worker: cache-first for JS/CSS only, HTML pages and API calls always go to network
- Icons live in `public/icons/` (192×192 and 512×512 PNG + apple-touch-icon)
- To update cached JS/CSS after a deploy, increment the cache version in `sw.js` (e.g. `cloudtrips-v6` → `cloudtrips-v7`)

---

## Share modes

| Mode | What's visible |
|---|---|
| `full` | Everything including costs and distances |
| `public` | Activities only — costs and distances hidden |

Share tokens are hashed before storage. The raw token travels in the URL only.

---

## Trip collaboration

Owners can invite other registered users by email. Invited users get `editor` role — they can add, edit, and delete activities but cannot delete the trip or manage shares. Invitations are single-use tokenised links with an expiry, sent via Brevo.

---

## PDF export tiers

| Tier | Monthly limit | How to set |
|---|---|---|
| Free | 5 exports | Default for all new users |
| Paid | 100 exports | Admin sets via admin panel |
| Unlimited | No limit | Admin sets via admin panel |

Usage tracked per-user in KV (`pdf_user_{id}_{YYYY_MM}`). Resets automatically each month.

---

## Admin panel

Accessible at `/admin.html` — visible only to users with `is_admin = 1`. Link appears in Settings modal for admin accounts.

Features: user list with search + pagination, per-user PDF tier toggle, admin flag toggle, user deletion, Browserless usage chart, error log.

To promote a user to admin:
```bash
npx wrangler d1 execute trips --remote --command "UPDATE users SET is_admin = 1 WHERE email = 'you@example.com'"
```

---

## Email verification

New users must verify their email before accessing the app. Existing users were auto-verified at migration time. Unverified users are blocked at login and redirected to `/verify-email.html`. Verification tokens expire after 24 hours. Resend is rate-limited to once per 2 minutes.

---

## Known limitations

- No per-trip activity count limit.
- PDF export requires a valid `BROWSERLESS_API_KEY` — returns 503 if missing.
- PDF export is limited to 1000 renders/month (tracked in KV, visible to admin via `GET /api/getPdfUsage`).