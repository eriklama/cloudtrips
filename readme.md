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
| Email | Brevo API (password reset) |
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
- Print / export view
- Share trips (full or public mode), share link management
- Dark / light mode
- Mobile responsive with hamburger nav
- Trip search + year filter
- Activity reordering
- Optimistic UI with rollback on failure
- Trip caching (sessionStorage)
- Rate limiting on login/signup (KV-backed)

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
│   ├── init.js                # App entry point, timeline, costs, nav, header
│   └── *.html                 # Pages (index, trip, timeline, costs, print, auth)
├── functions/
│   ├── _middleware.ts         # CORS headers for all routes
│   ├── _lib/
│   │   ├── auth.ts            # JWT helpers, requireUser, password hashing
│   │   ├── share.ts           # Share token helpers
│   │   └── http.ts            # json(), error(), methodNotAllowed() helpers
│   └── api/
│       ├── login.ts
│       ├── signup.ts
│       ├── me.ts
│       ├── getTrips.ts
│       ├── getTrip.ts
│       ├── saveTrip.ts
│       ├── deleteTrip.ts
│       ├── shareTrip.ts
│       ├── getShares.ts
│       ├── revokeShare.ts
│       ├── disableShare.ts
│       ├── requestPasswordReset.ts
│       └── resetPassword.ts
├── migrations/
│   ├── 001_add_km.sql
│   ├── 002_drop_share_tokens.sql
│   ├── 003_share_mode.sql
│   ├── 004_password_resets.sql
│   ├── 005_trip_notes.sql
│   └── 006_activities_table.sql
├── src/
│   └── input.css              # Tailwind source
├── wrangler.toml              # Cloudflare bindings config
├── tailwind.config.js
└── package.json
```

---

## Database Schema

```sql
users (
  id, email, password_hash, created_at
)

trips (
  id, user_id, name, notes, created_at
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

password_resets (
  id, user_id, token_hash, expires_at, used_at, created_at
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
| `BREVO_API_KEY` | Brevo API key for sending password reset emails |
| `BREVO_SENDER_EMAIL` | Sender address for password reset emails (plain text) |

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
```

---

## Deployment

### Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy public
```

Or push to `main` — Cloudflare auto-deploys via GitHub integration.

### Run database migrations

```bash
npx wrangler d1 migrations apply trips --remote
```

---

## CSS / Tailwind

Tailwind is compiled to `public/output.css`. To rebuild after changing styles:

```bash
npm run build:css
```

---

## Share modes

| Mode | What's visible |
|---|---|
| `full` | Everything including costs and distances |
| `public` | Activities only — costs and distances hidden |

Share tokens are hashed before storage. The raw token travels in the URL only.

---

## Known limitations

- No pagination on the trips list — all trips are fetched at once.
- No per-trip activity count limit.