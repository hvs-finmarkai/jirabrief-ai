# JiraBrief AI

Multi-tenant SaaS that transforms Jira activity into stakeholder-ready management reports using AI.

## Architecture

```
Browser → Next.js → FastAPI → PostgreSQL (Supabase)
                       ├── Jira Cloud REST API
                       ├── AI Provider (Ollama)
                       └── Delivery (Email/Slack/Confluence)
```

## Features

- 4 report types: Sprint Summary, Status Report, Executive Digest, Release Notes
- Deterministic metrics + risk signal detection + Sprint Health
- AI generation (Ollama) with fallback to deterministic reports
- Report quality validation with source traceability
- Report comparison ("What Changed")
- Approval workflow (Draft → In Review → Approved → Sent)
- Scheduling (daily/weekly/monthly, timezone-aware)
- Delivery: Email (Resend), Slack (webhook), Confluence (page creation)
- Multi-tenant with RBAC (Owner, Admin, Member, Viewer)
- Demo Mode with realistic sample data
- Encrypted Jira token storage
- Rate limiting, audit logging, security headers

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL (Supabase free tier)
- Ollama (optional — fallback works without it)

## Quick Start

### 1. Supabase Setup

1. Create project at https://supabase.com
2. Enable Email/Password auth (Authentication → Providers)
3. Enable Google OAuth (Authentication → Providers → Google)
4. Note: Project URL, anon key, service role key, JWT secret (Settings → API)

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local   # Fill in Supabase credentials
npm install
npm run dev                   # http://localhost:3000
```

### 3. Backend

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Fill in all credentials
alembic upgrade head          # Run migrations
uvicorn app.main:app --reload --port 8000
```

### 4. Ollama (Optional)

```bash
# Install: https://ollama.ai
ollama pull llama3.2
```

### 5. Google OAuth

1. Google Cloud Console → Create OAuth 2.0 credentials
2. Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Add Client ID/Secret in Supabase → Authentication → Google

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Backend URL (http://localhost:8000) |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_JWT_SECRET` | JWT secret (Settings → API) |
| `CORS_ORIGINS` | Allowed origins JSON array |
| `OLLAMA_BASE_URL` | Ollama server URL |
| `OLLAMA_MODEL` | Model name (llama3.2) |
| `RESEND_API_KEY` | Resend email API key (optional) |
| `SENTRY_DSN` | Sentry DSN for error monitoring (optional) |

## Database Migrations

```bash
cd backend
alembic upgrade head        # Apply all
alembic downgrade -1        # Rollback one
```

## Demo Mode

1. Start frontend + backend
2. Click "Explore Demo" on login page
3. Select project → sprint → report type → generate
4. No credentials needed — uses bundled sample data

## Production Deployment

- **Frontend**: Vercel (auto-deploys from GitHub)
- **Backend**: Any Python hosting (Railway, Render, Fly.io)
- **Database**: Supabase PostgreSQL
- **HTTPS**: Required — use deployment platform certificates
- Set `APP_ENV=production` and `CORS_ORIGINS` to your production frontend URL

## Security

- JWT verification on all protected endpoints
- Encrypted Jira token storage (Fernet + PBKDF2)
- RBAC with server-side enforcement
- Tenant isolation (org membership check on every request)
- Rate limiting on sensitive endpoints
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- No secrets in frontend bundles or API responses
- AI prompt injection protection (system prompt blocks instruction-following from Jira content)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors | Check `CORS_ORIGINS` includes frontend URL |
| 401 on API | Verify `SUPABASE_JWT_SECRET` |
| Google SSO fails | Check redirect URI in Google Console |
| Ollama timeout | First request loads model — takes longer |
| No reports generate | Ollama optional — fallback always works |
| Rate limited | Wait 60 seconds, reduce request frequency |
