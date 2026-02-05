# Emotion Time Travel - Project Overview

## Problem Statement
Many people struggle to translate their abstract thoughts, dreams, and emotions into actionable reality. They may feel stuck in the past, overwhelmed by the present, or anxious about the future, lacking a structured way to integrate these temporal perspectives into a coherent life plan. **Emotion Time Travel** solves this by providing a guided AI journey that disentangles these complex emotional states and synthesizes them into a clear, actionable path forward.

## Why Agents?
Agents are the ideal solution for this problem because "time travel" requires distinct modes of thinking:
*   **Specialization**: We need separate "experts" to analyze the **Past** (historical patterns), **Present** (current state/needs), and **Future** (scenarios/risks). A single model trying to do all three often produces generic results.
*   **Parallelism**: The `Past`, `Present`, and `Future` agents can work simultaneously, significantly reducing the wait time for the user.
*   **Synthesis**: The `IntegrationAgent` acts as a specialized architect, taking the structured outputs from the other three agents to resolve contradictions and build a unified plan, mimicking a team of therapists and strategists working together.

## What You Created (Architecture)
The system follows a **Micro-Agent Orchestration Architecture**:

1.  **Frontend**: A **Streamlit** application provides an interactive, user-friendly interface for users to share their thoughts and view structured insights.
2.  **Backend API**: A **FastAPI** server handles requests, managing the asynchronous orchestration of agents.
3.  **Agent Orchestrator**:
    *   **Parallel Execution**: Uses `asyncio` to trigger `PastEmotionAgent`, `PresentEmotionAgent`, and `FutureEmotionAgent` concurrently.
    *   **Sequential Integration**: Feeds the outputs of the parallel agents into the `IntegrationAgent` for final synthesis.
4.  **Memory & Storage**:
    *   **Session Memory**: In-memory storage for active processing results.
    *   **Long-term Memory**: SQLite database for user history, with a fallback mechanism for vector search (FAISS) to retrieve relevant past context.
5.  **Observability**: Integrated Prometheus metrics and structured logging to track agent performance and latency.

## Demo
*(This section describes the user flow)*
1.  **Input**: The user enters a raw thought (e.g., "I want to start a business but I'm scared").
2.  **Processing**: The system spins up three agents.
    *   *Past Agent* identifies the user's history of risk-aversion.
    *   *Present Agent* detects current anxiety and excitement.
    *   *Future Agent* maps out a "success" scenario and a "failure" scenario.
3.  **Result**: The user sees a dashboard with four tabs:
    *   **Past**: "You've hesitated before because..."
    *   **Present**: "You are currently feeling..."
    *   **Future**: "If you act, X might happen..."
    *   **Plan**: "Step 1: Validate your idea this week."

## The Build
*   **Core Language**: Python 3.10+
*   **Web Frameworks**: FastAPI (Backend), Streamlit (Frontend)
*   **AI/LLM**: OpenAI GPT-4 / Google Gemini (via custom `call_llm` wrapper)
*   **Data**: SQLite, NumPy, FAISS (optional for vector search)
*   **Tools**: `uvicorn` for serving, `pydantic` for data validation, `loguru` for logging.

## If I had more time...
*   **Robust Persistence**: Migrate from in-memory result storage to **Redis** or **PostgreSQL** to ensure no data is lost during server restarts.
*   **Vector Memory**: Fully enable and optimize the **FAISS** vector store (or move to **Pinecone**) to allow the agents to "remember" deep context from weeks or months ago.
*   **User Authentication**: Implement **OAuth2** or **Auth0** for secure, private user accounts instead of simple user IDs.
*   **Voice Interface**: Add speech-to-text to allow users to "talk" to the time traveler agents directly.
*   **Feedback Loop**: Use the evaluation data (ratings/comments) to fine-tune the agent prompts automatically over time.
