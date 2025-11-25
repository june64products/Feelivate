# emotion-time-travel

Minimal Python project with a FastAPI app and Docker support.

## Virtualenv Setup

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
   # edit .env and add real values
   ```

## Run the App (Local)

```bash
uvicorn app.main:app --reload
```

Visit: http://127.0.0.1:8000/

## Docker Quick Start

Build the image:
```bash
docker build -t emotion-time-travel:latest .
```

Run the container:
```bash
docker run --rm -p 8000:8000 emotion-time-travel:latest
```

Visit: http://127.0.0.1:8000/

## Project Structure

```
emotion-time-travel/
├── app/
│   └── main.py
│   └── orchestrator.py
│   └── prompts.py
│   └── llm.py
│   └── tools.py
│   └── session_service.py
│   └── tasks.py
│   └── memory.py
│   └── observability.py
│   └── a2a.py
│   └── eval.py
│   └── static/
│       └── index.html
├── requirements.txt
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Privacy

- Logs redact PII fields like `user_id`, `text`, and `comments` by default.
- Do not store raw journal entries unless consent is recorded.
- Keep `OPENAI_API_KEY` and secrets out of logs and version control.
- Use platform secrets for deployments (Railway/Heroku) or `.env` locally.