# JiraBrief AI

Multi-tenant SaaS that turns Jira activity into stakeholder-ready management reports.

## Architecture

```
Browser → Next.js → FastAPI → PostgreSQL (Supabase)
                       ├── Jira Cloud REST API
                       ├── AI: Claude → Ollama → deterministic fallback
                       ├── Background scheduler (in-process)
                       └── Delivery (Email/Slack/Confluence)
```

Everything is persisted in Postgres. Reports, Jira connections, schedules,
delivery channels, delivery logs, notifications and the audit trail all survive a
restart or redeploy.

## Features

- 4 report types: Sprint Summary, Status Report, Executive Digest, Release Notes
- Deterministic metrics, risk-signal detection and Sprint Health
- AI generation with a three-tier fallback (see **AI providers**)
- Report quality validation: every issue key the AI cites is checked against the
  source data, so hallucinated tickets are caught
- Report comparison ("What Changed")
- Approval workflow (Draft → In Review → Approved → Sent)
- Scheduling (daily/weekly/monthly, timezone-aware) executed by a background worker
- Delivery: Email (Resend), Slack (webhook), Confluence (page creation)
- Multi-tenant with RBAC (Owner, Admin, Member, Viewer)
- Demo Mode with realistic sample data and no credentials required
- Encrypted credential storage (Fernet + PBKDF2, dedicated key)

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL (Supabase free tier is fine)
- An Anthropic API key (optional) and/or Ollama (optional)

## Quick Start

### 1. Supabase

1. Create a project at https://supabase.com
2. Enable Email/Password auth (Authentication → Providers)
3. Enable Google OAuth (Authentication → Providers → Google)
4. Note the Project URL, anon key, service role key and JWT secret (Settings → API)

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then fill it in — see below
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Two settings matter more than the rest:

- **`TOKEN_ENCRYPTION_KEY`** — required in production. Generate with
  `openssl rand -hex 32`. It must be **different** from `SUPABASE_JWT_SECRET`:
  keeping them separate means a leaked login secret cannot also decrypt every
  customer's stored Jira token. The app refuses to start in production without it.
- **`ALLOW_PRIVATE_NETWORK_TARGETS`** — leave `false`. It gates the SSRF guard
  that stops a user-supplied Jira/Slack/Confluence URL being aimed at internal
  infrastructure. Set `true` only for local development against localhost.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local    # Supabase credentials + NEXT_PUBLIC_API_URL
npm install
npm run dev                   # http://localhost:3000
```

### 4. Google OAuth

1. Google Cloud Console → create OAuth 2.0 credentials
2. Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Add the Client ID/Secret in Supabase → Authentication → Google

## AI providers

Providers are tried in order, and the app degrades rather than failing:

| Order | Provider | When it runs |
|-------|----------|--------------|
| 1 | **Claude** (`claude-sonnet-5`) | `ANTHROPIC_API_KEY` is set |
| 2 | **Ollama** | Claude unset or erroring, and Ollama reachable |
| 3 | **Deterministic** | Everything else — built directly from Jira data |

A report is always produced; only its quality varies. The deterministic builder
needs no AI at all, which is what Demo Mode falls back to out of the box.

Claude generation uses **structured outputs**: the response is constrained to the
report's schema, so malformed or truncated JSON can't reach the parser. Depth and
cost are tuned with `ANTHROPIC_EFFORT` (`low`…`max`, default `medium`).

Optional Ollama setup:

```bash
ollama pull llama3.2
```

## Scheduling

Schedules are executed by a background worker that starts with the app. It wakes
every `SCHEDULER_INTERVAL_SECONDS`, claims each schedule that has come due,
generates the report, and delivers it unless the schedule requires approval.

Due schedules are claimed with `SELECT ... FOR UPDATE SKIP LOCKED`, so running
multiple backend instances is safe — each schedule is picked up by exactly one
worker. Set `SCHEDULER_ENABLED=false` on any instance that must not run jobs. A
schedule that fails 5 times consecutively is disabled rather than retried forever.

## Database Migrations

```bash
cd backend
alembic upgrade head        # apply all
alembic downgrade -1        # roll back one
```

The ORM models are kept in lockstep with the migrations —
`alembic revision --autogenerate` produces an empty migration when nothing has
changed. If it doesn't, the models and the schema have drifted.

## Demo Mode

1. Start frontend + backend
2. Click "Explore Demo" on the login page
3. Pick a project → sprint → report type → generate

No credentials needed. Demo reports are stored under a reserved demo organization
that is seeded automatically at startup.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Covers the SSRF guard, credential encryption, schedule timing (including a DST
transition) and ORM/migration consistency.

## Production Deployment

- **Backend**: `backend/Dockerfile` — runs migrations on boot, non-root user.
  `render.yaml` is a ready-to-use Render blueprint; any Docker host works.
- **Frontend**: Vercel (auto-deploys from GitHub)
- **Database**: Supabase Postgres
- **HTTPS**: required — terminate at the platform

Before going live set `APP_ENV=production`, a real `TOKEN_ENCRYPTION_KEY`, and
`CORS_ORIGINS` to your actual frontend origin.

## Security

- JWT verification on all protected endpoints
- Tenant isolation enforced per query, derived from the authenticated membership
  rather than from a client-supplied path parameter
- RBAC with server-side enforcement
- Jira tokens and delivery-channel secrets encrypted at rest with a dedicated key
  (Fernet + PBKDF2, 600k iterations); never returned to the client, and redacted
  out of error messages and logs
- SSRF guard on every user-supplied outbound URL: rejects private, loopback,
  link-local and cloud-metadata addresses, and checks *every* address a hostname
  resolves to
- Security headers on every response (CSP, HSTS in production, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Audit log persisted to the database, with credential fields redacted

## Known limitations

Stated plainly rather than oversold:

- **Rate limiting is per-process and in-memory.** It resets on restart and is not
  shared across instances. Fine for a single instance; strict limits across a
  multi-instance deployment need a shared store such as Redis. Set
  `TRUSTED_PROXY_HOPS=1` when deploying behind a load balancer, otherwise every
  user is counted as the same client.
- **Prompt-injection protection is partial.** Ticket text reaches the model
  unsanitised. The system prompt tells the model to treat Jira content as data,
  and the quality check catches fabricated issue keys — but it would not catch a
  comment that talks the model into mischaracterising a real ticket.
- **Jira sync is read-through, not incremental.** Reports query Jira live; the
  `issues`/`sprints` tables exist for a future incremental sync and are not yet
  on the read path.
- **Two frontend pages are not yet on the real API.** `/reports` still reads the
  demo endpoints and `/schedules` holds its state locally. The typed client
  methods (`api.reports.*`, `api.schedules.*`) exist and are bound to the real
  endpoints — the pages just need switching over. Everything else (dashboard,
  integrations, projects, templates, settings, onboarding) is on the real API.
- **Team management is read-only.** Members can be listed and removed, but there
  are no invite or role-change endpoints yet, and the members list returns user
  ids rather than display names.
- **Saved delivery channels must be re-entered to test or send.** `/test` and
  `/send` take the full config in the request body rather than a saved channel
  id, so the UI cannot exercise a stored channel without retyping credentials.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors | Check `CORS_ORIGINS` includes the frontend origin |
| 401 on API | Verify `SUPABASE_JWT_SECRET` |
| 403 "Not a member of this organization" | `X-Organization-Id` must match an org you belong to |
| App won't start in production | `TOKEN_ENCRYPTION_KEY` is unset |
| "Stored credential could not be decrypted" | `TOKEN_ENCRYPTION_KEY` changed — reconnect the integration |
| Jira/Slack URL rejected as unsafe | The host resolves to a private address; the SSRF guard is working |
| Google SSO fails | Check the redirect URI in Google Console |
| Ollama timeout | The first request loads the model and takes longer |
| Reports say "deterministic" | No AI provider reachable — expected fallback; check `ANTHROPIC_API_KEY` |
| Scheduled reports don't run | Check `SCHEDULER_ENABLED`, and whether the schedule was auto-disabled after repeated failures |
