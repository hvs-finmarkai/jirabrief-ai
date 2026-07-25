# JiraBrief AI

Turn Jira activity into stakeholder-ready reports. Multi-tenant SaaS with AI-powered report generation.

## Architecture

```
Browser → Next.js (frontend) → FastAPI (backend) → PostgreSQL/Supabase
                                    ├── Jira Cloud API
                                    └── AI Provider (Ollama)
```

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL (via Supabase)
- Supabase project (free tier)

## Setup

### 1. Supabase

1. Create project at https://supabase.com
2. Enable Email/Password auth in Authentication → Providers
3. Enable Google OAuth in Authentication → Providers → Google
4. Note your project URL, anon key, service role key, and JWT secret (Settings → API)

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in your Supabase credentials
npm install
npm run dev
```

Runs on http://localhost:3000

### 3. Backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in your Supabase + database credentials

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### 4. Google OAuth

1. Create OAuth consent screen in Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Add Client ID and Secret in Supabase → Authentication → Google

### 5. Ollama (for AI reports — Checkpoint 2)

```bash
# Install from https://ollama.ai
ollama pull llama3.2
```

## Environment Variables

### Frontend (.env.local)

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon/public key |
| NEXT_PUBLIC_API_URL | Backend URL (http://localhost:8000) |

### Backend (.env)

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key |
| SUPABASE_JWT_SECRET | JWT secret from Supabase Settings → API |
| CORS_ORIGINS | Allowed frontend origins |

## Database Migrations

```bash
cd backend
alembic upgrade head      # Apply all migrations
alembic downgrade -1      # Rollback one migration
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors | Ensure CORS_ORIGINS includes your frontend URL |
| 401 on API calls | Check SUPABASE_JWT_SECRET matches your project |
| Google SSO redirect fails | Verify redirect URI in Google Console matches Supabase |
| Database connection fails | Check DATABASE_URL and that Supabase is accessible |
