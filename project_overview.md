# Feelivate — Project Overview

> AI behavioral mentor that turns your goals into locked 7-day action plans and drags you across the finish line every single day.

## Problem Statement
Most people don't fail because they lack goals — they fail at *execution*. Vague to-do lists, decision fatigue, no accountability, and no honest feedback loop mean motivation fizzles by Wednesday. **Feelivate** solves this by acting as a ruthless-but-warm AI mentor: it converts a fuzzy ambition into a hyper-specific, non-negotiable weekly plan, then keeps you accountable with daily personalized emails, streaks, weekly report cards, and emotion-aware coaching that adapts to how your week actually went.

## What It Does (Core Features)
1. **Conversational AI Mentor** — A chat-based mentor (talks naturally like ChatGPT, no therapy-speak) that interviews you and extracts exactly what you want to achieve.
2. **7-Day Action Plans** — Every goal is broken into a hyper-specific weekly plan: exact daily micro-actions, sequenced and timed. No vague resolutions.
3. **The Lock-In Protocol** — Once a week is approved it's *locked*. You can't quietly soften it to make it easier — you execute or the streak breaks.
4. **Daily Task Emails (Notifications)** — Each day, an AI-written, personalized email lands in your inbox with **today's task + "how-to" tips**, sent at *your chosen time in your own timezone* (APScheduler). Opt-in is OTP-verified; you can change the time or stop anytime.
5. **Weekly Reports** — At the end of each week you get an honest report card: what you actually did vs. what you committed to, momentum, and what to fix next week.
6. **Streaks & Daily Check-ins** — Track real momentum with streaks and daily check-ins (with backfill support).
7. **Voice Journal & Emotion Logs** — Talk or type how you feel. Voice memos are transcribed (Groq Whisper) and daily emotion is logged, so the mentor understands the *why* behind a slip and adapts the next plan.
8. **Google Calendar Sync** — Approved plans drop straight into your Google Calendar with reminders — the work is scheduled, not left to willpower.
9. **Persistent Multi-Week Memory** — History, wins, and patterns compound week over week, so guidance gets sharper the longer you stay. Difficulty curves ramp as you improve.

## Architecture
Feelivate is a **React SPA + FastAPI** application backed by Postgres and an LLM fallback chain.

1. **Frontend** — **React 19 + Vite + TypeScript** single-page app (react-router, framer-motion, lucide, Tailwind). Pages: Landing, Login, Journey, Workspace. Deployed on **Vercel**.
2. **Backend API** — **FastAPI** (uvicorn) exposing chat, plan approval, tasks, streaks, weekly review/reports, journal/voice, calendar, and email-notification endpoints. Deployed on **Northflank**.
3. **AI Layer (`app/llm.py`)** — Provider-agnostic `call_llm` wrapper with a **fallback chain**: Groq `gpt-oss-120b` → `gpt-oss-20b` → `llama-3.3-70b` → OpenAI `gpt-4o-mini` (last resort). Fallback switches are invisible to the user. Voice via **Groq Whisper** (`whisper-large-v3-turbo`).
4. **Mentor Prompting (`app/prompts.py`)** — `SMART_MENTOR_SYSTEM_PROMPT` (v3.1) handles plan locking, multi-week memory, and difficulty curves.
5. **Email Engine (`app/email_service.py`)** — AI-generated premium daily task emails + OTP verification; **APScheduler** dispatches at each user's preferred local time.
6. **Calendar (`app/calendar_service.py`)** — Google OAuth + Calendar API sync of the weekly plan.
7. **Persistence (`app/database.py`)** — **PostgreSQL** in production (`DATABASE_URL`, Northflank), SQLite (`memory.db`) fallback for local dev. Long-term memory + optional FAISS vector recall.
8. **Auth (`app/security.py`)** — JWT (jose) with bcrypt password hashing (30-day tokens) + Google OAuth for calendar scope.
9. **Observability** — Prometheus `/metrics` and structured logging (PII-redacted by default).

## User Flow
1. **Sign in** → chat with the mentor about a goal ("I want to get fit but keep quitting").
2. **Plan** → the mentor proposes a specific 7-day plan; you approve → it **locks**.
3. **Every day** → a personalized task email arrives at your set time; you do the task and check in (streak++).
4. **Voice/emotion** → drop a voice note on a rough day; the mentor logs the emotion and adapts.
5. **End of week** → weekly report card + the next (harder) week is generated. Optionally synced to Google Calendar.

## Tech Stack
* **Frontend**: React 19, Vite, TypeScript, react-router-dom 7, framer-motion, Tailwind
* **Backend**: Python 3.10+, FastAPI, uvicorn, pydantic, APScheduler
* **AI/LLM**: Groq (gpt-oss-120b/20b, llama-3.3-70b) + OpenAI gpt-4o-mini fallback; Groq Whisper for voice
* **Data**: PostgreSQL (prod) / SQLite (local), FAISS (optional vector memory)
* **Integrations**: Google Calendar API, email delivery + APScheduler
* **Auth**: JWT (python-jose), bcrypt, Google OAuth
* **Infra**: Vercel (frontend), Northflank (backend), Docker
* **Observability**: Prometheus metrics, loguru logging

## Roadmap / If I had more time
* **Native Google sign-in** on the login page (currently email/password + Google-for-calendar).
* **Push + WhatsApp notifications** alongside email.
* **Deeper vector memory** (Pinecone/pgvector) for months-long context recall.
* **Adaptive prompt tuning** using weekly report + rating feedback to auto-improve mentor guidance.
