# Feelivate

> AI behavioral mentor that turns your goals into locked 7-day action plans, then keeps you accountable with daily personalized emails, streaks, and honest weekly reports.

**React 19 + Vite** frontend and a **FastAPI** backend, powered by a Groq → OpenAI LLM fallback chain. See [project_overview.md](project_overview.md) for the full architecture.

## Features
- **Conversational AI mentor** — chats naturally and extracts exactly what you want to achieve.
- **7-day action plans** with a **Lock-In Protocol** — once approved, the week is locked; you execute or the streak breaks.
- **Daily task emails** — AI-written, personalized "today's task + how-to" emails, delivered at *your* preferred time and timezone (OTP-verified opt-in; change time or stop anytime).
- **Weekly reports** — honest end-of-week report card: what you did vs. what you committed to.
- **Streaks & daily check-ins** — track real momentum.
- **Voice journal & emotion logs** — talk or type how you feel (Groq Whisper transcription); the mentor adapts.
- **Google Calendar sync** — plans drop into your calendar with reminders.
- **Persistent multi-week memory** — context and difficulty ramp week over week.

## Backend — Local Setup

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

2. Activate it (macOS/Linux):
   ```bash
   source .venv/bin/activate
   ```
   On Windows (PowerShell):
   ```powershell
   .venv\Scripts\Activate.ps1
   ```

3. Install dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # edit .env — GROQ_API_KEY, OPENAI_API_KEY (fallback), JWT_SECRET_KEY,
   # DATABASE_URL (optional; falls back to local sqlite), email + Google creds
   ```

5. Run the API:
   ```bash
   uvicorn app.main:app --reload
   ```
   Visit: http://127.0.0.1:8000/  (health) · http://127.0.0.1:8000/docs (OpenAPI)

## Frontend — Local Setup

```bash
cd frontend
npm install
npm run dev
```

## Docker Quick Start

```bash
docker build -t feelivate:latest .
docker run --rm -p 8000:8000 --env-file .env feelivate:latest
```

## Project Structure

```
emotion-time-travel/
├── app/                      # FastAPI backend
│   ├── main.py               # API routes (chat, plans, tasks, streaks, reports, journal…)
│   ├── prompts.py            # SMART_MENTOR_SYSTEM_PROMPT (plan locking, memory, difficulty curves)
│   ├── llm.py                # Groq → OpenAI fallback chain wrapper
│   ├── email_service.py      # AI daily task emails + OTP + APScheduler
│   ├── calendar_service.py   # Google Calendar sync
│   ├── audio.py              # Groq Whisper voice transcription
│   ├── database.py           # Postgres (prod) / SQLite (local)
│   ├── security.py           # JWT auth + bcrypt
│   ├── memory.py             # long-term / vector memory
│   ├── models.py             # pydantic + ORM models
│   └── static/
├── frontend/                 # React 19 + Vite + TypeScript SPA
├── requirements.txt
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── project_overview.md
```

## Deployment
- **Frontend** → Vercel
- **Backend** → Northflank (Postgres via `DATABASE_URL`)

## Privacy
- Logs redact PII fields like `user_id`, `text`, and `comments` by default.
- Keep `GROQ_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET_KEY`, and email/Google secrets out of logs and version control.
- Use platform secrets for deployments (Vercel/Northflank) or `.env` locally.
