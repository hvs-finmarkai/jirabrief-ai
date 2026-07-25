# JiraBrief AI

AI-powered management report generator from Jira data. Generates Sprint Summaries, Status Reports, Executive Digests, and Release Notes.

## Requirements

- Node.js 18+
- Python 3.11+
- Ollama (optional — fallback reports work without it)

## Setup

### Frontend

```bash
npm install
npm run dev
```

Runs on http://localhost:5173

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Runs on http://localhost:8000

### Ollama (Optional)

Install from https://ollama.ai then:

```bash
ollama pull llama3.2
```

If Ollama is not running, the app generates structured fallback reports from the Jira data directly.

## Environment Variables

Create `backend/.env`:

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Usage

### Demo Mode

1. Start both frontend and backend
2. Click "Try Demo Mode"
3. Select a project → sprint → report type
4. Click Generate Report
5. Copy or download the report

### Real Jira Mode

1. Get an API token from https://id.atlassian.com/manage-profile/security/api-tokens
2. Enter your Jira URL (e.g., https://your-team.atlassian.net)
3. Enter your email and API token
4. Click "Connect to Jira"

## Report Types

- **Sprint Summary** — completed, in progress, blockers, next work
- **Status Report** — current state, progress, risks, actions
- **Executive Digest** — non-technical overview for leadership
- **Release Notes** — new features, improvements, fixes

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Frontend can't reach backend | Ensure backend runs on port 8000; Vite proxies `/api` to it |
| "Failed to connect to Jira" | Verify URL format includes `https://`, check email/token |
| Empty report | Ensure the selected sprint has issues |
| Ollama timeout | Model may be loading; first request takes longer |
