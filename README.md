# Econorag Frontend

This document explains how the Next.js client integrates with the LangGraph
backend so designers and engineers can iterate on the UI without digging through
backend code. Share it with anyone building the web experience.

## High-Level Architecture

- **Frontend** runs on Next.js (App Router) and lives in this `econorag-frontend`
  directory. The main chat experience is implemented in
  `src/app/page.tsx`.
- **Backend** runs from the sibling `my-langgraph-rag` project. Its
  `src/api_server.py` exposes a FastAPI server with two endpoints:
  - `GET /` — healthcheck
  - `POST /ask` — chat interaction endpoint
- Both projects expect Supabase for auth. During local development you can run
  the backend without Supabase credentials; it will fall back to an
  "anonymous" user.

```
frontend (Next.js) ──▶ POST /ask ──▶ LangGraph runtime ──▶ tools (FRED, vector store)
          ▲                                                         │
          └────────────── attachments (chart image metadata) ◀──────┘
```

## Local Development Checklist

1. **Install dependencies**
   ```bash
   # In econorag-frontend
   npm install

   # In my-langgraph-rag
   pip install -e .
   ```

2. **Environment variables**
   - Frontend expects Supabase keys inside `.env.local`:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=...
     NEXT_PUBLIC_SUPABASE_ANON_KEY=...
     ```
   - Backend needs, at minimum:
     ```env
     FRED_API_KEY=...
     SUPABASE_URL=...
     SUPABASE_SERVICE_ROLE_KEY=...
     ```
     Missing Supabase values are tolerated in development; the API will warn and
     treat all sessions as anonymous.

3. **Start services**
   ```bash
   # Terminal 1 (backend)
   cd my-langgraph-rag
   uvicorn src.api_server:app --reload

   # Terminal 2 (frontend)
   cd econorag-frontend
   npm run dev
   ```
   The frontend defaults to `http://localhost:3000`, and it sends API requests
   to `http://localhost:8000/ask`. Adjust the URL in `src/app/page.tsx` if the
   backend runs elsewhere.

## Request / Response Contract

### POST `/ask`

**Request body**
```json
{
  "text": "Latest GDP numbers?",
  "conversation": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
- `conversation` is optional; the frontend sends the current message history to
  maintain context across turns.
- Auth is provided via the Supabase access token in the `Authorization` header
  (`Bearer <token>`). During local dev the header can be empty.

**Response body**
```json
{
  "response": "Here is what I found...",
  "attachments": [
    {
      "type": "image",
      "source": "data:image/png;base64,...",
      "title": "GDP (latest)",
      "series_id": "GDP"
    }
  ]
}
```
- `attachments` is optional. When the FRED tool enriches a retrieved document,
  the backend returns the first chart image as a base64 `data:` URL along with a
  title and series identifier.
- The frontend stores the entire chat state (messages and attachments) in
  `sessionStorage` under `chat-messages`. This allows page reloads without
  redeploying backend state.

## Frontend Responsibilities

- **Auth handling**: `src/app/page.tsx` listens to Supabase auth state, renders
  the `<Auth />` component until a session exists, and passes the bearer token in
  every `/ask` call.
- **Message rendering**: assistant messages are parsed with `ReactMarkdown`.
  Attachments are rendered below the markdown inside a `<figure>` element. Only
  images are currently supported; other types can be added later.
- **Error handling**: failed requests append an assistant message saying
  "Error connecting to backend" so users see immediate feedback.

## Backend Notes Your Teammate Should Know

- Retrieval happens via LangGraph with the pipeline:
  `generate_query → retrieve → tool_call → respond`.
- The `tool_call` node enriches documents with live FRED data, adds a base64
  chart image to metadata, and surfaces the first image through the API
  response.
- `format_docs` strips binary metadata (e.g., the base64 chart) before sending
  context to the language model, preventing token blow-ups across turns.

## Common Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` from `/ask` | Missing or expired Supabase session | Sign in again via the Auth component or set `SUPABASE_*` env vars for the backend |
| `Error connecting to backend` message in UI | Backend not running, wrong port, or CORS misconfiguration | Ensure FastAPI server is at `http://localhost:8000` and restart | 
| Charts not showing | Backend returned no `attachments` | Confirm the retrieved document had a `series_id` and FRED API key is set |

## Suggested Future Enhancements

1. Allow multiple attachments per turn (gallery layout).
2. Move the backend base URL into an environment variable (e.g.,
   `NEXT_PUBLIC_API_URL`).
3. Add loading skeleton or streaming support for long responses.

---
Maintainers: drop questions in the main repo discussion channel or ping the
backend team if the contract changes.
