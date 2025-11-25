Deployment Guide

Railway / Heroku
- Set env vars: OPENAI_API_KEY, REDIS_URL
- Build and deploy; expose port 8000
- Scale worker: run `rq worker default`
- Use platform secrets for OPENAI_API_KEY
- Health check: GET /
- Rollback: redeploy previous successful build

Docker on VPS (DigitalOcean)
- Install Docker and docker-compose
- Create `.env` with OPENAI_API_KEY and REDIS_URL
- Run `docker-compose up -d`
- Scale worker: `docker-compose up -d --scale worker=2`
- Secure secrets via `.env` on server (permissions 600)
- Health check: `curl http://<host>:8000/`
- Rollback: revert image tag and `docker-compose pull && up -d`