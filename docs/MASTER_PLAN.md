# Second Brain - Master Plan

> **One brain, many surfaces** - A personal AI that understands you, remembers for you, and acts for you.

## Vision

Build a "second brain" that works as your personal AI assistant:
- **Web app** (primary) - cloud-hosted on Lovable Cloud
- **Multi-user support** - Personal and organizational contexts
- **AI with tool access** - Can create tasks, notes, calendar events, CRM entries

## Core Principle

**Default interaction = conversation**

You open it, you're in a chat. The AI has three jobs:
1. **Understand you** - projects, preferences, style, constraints
2. **Remember for you** - knowledge, decisions, notes, context over time
3. **Act for you** - execute tasks via tools and automations

---

## Architecture (Cloud-First)

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + TypeScript)                   │
│  - Chat-first UI with sidebar navigation                │
│  - CRM (Contacts, Deals, Companies)                     │
│  - Calendar (Day/Week/Month views)                      │
│  - Tasks, Notes, Search                                 │
│  - Organization switching & role-based access           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LOVABLE CLOUD (Supabase)                               │
│  - PostgreSQL with RLS (Row Level Security)             │
│  - Edge Functions for AI chat with tool calling         │
│  - Authentication (email with auto-confirm)             │
│  - Organization/workspace multi-tenancy                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  AI LAYER (Lovable AI Gateway)                          │
│  - google/gemini-2.5-flash (default model)              │
│  - Tool calling for CRUD operations                     │
│  - No API key required (managed by Lovable)             │
└─────────────────────────────────────────────────────────┘
```

---

## Three Main Loops

### 1. Conversation Loop
User talks → retrieve context → LLM responds → optionally save/act

### 2. Delegation Loop
User delegates task → AI plans steps → executes tools → reports back

### 3. Learning Loop
After interactions → extract facts/preferences → update memory

---

## Data Model

| Entity | Purpose |
|--------|---------|
| **Conversation** | Chat sessions with message history |
| **Message** | Individual messages (user/assistant) |
| **Note** | Saved knowledge, thoughts, documents |
| **Task** | Action items, to-dos |
| **Project** | Groups of related tasks/notes |
| **IdentityFact** | Learned preferences about the user |
| **MemoryChunk** | Embedded text for semantic search |

---

## Development Phases

### Phase 1: Core Brain (Current)
- [x] Gemma running via Ollama
- [x] Basic FastAPI brain service
- [ ] SQLite for persistent storage
- [ ] Conversation history saved
- [ ] Basic notes CRUD

### Phase 2: Conversation UI
- [ ] Chat-first frontend (Lovable)
- [ ] Real-time message streaming
- [ ] Conversation list sidebar
- [ ] Dark theme

### Phase 3: Memory & Tools
- [ ] Vector embeddings for notes
- [ ] Semantic search ("what did I say about X?")
- [ ] File tools (read/write local files)
- [ ] Task management

### Phase 4: Identity & Learning
- [ ] Preference extraction
- [ ] Identity facts storage
- [ ] Reflection/summarization runs

### Phase 5: Polish & Sync
- [ ] Windows app packaging
- [ ] Cloud deployment option
- [ ] Sync between local/cloud

---

## API Contract

The frontend calls these endpoints (backend implements them):

```
POST /chat
  Request:  { message: string, conversation_id?: string }
  Response: { reply: string, conversation_id: string }

GET /conversations
  Response: { conversations: [...] }

GET /conversations/{id}
  Response: { messages: [...] }

POST /notes
  Request:  { content: string, title?: string }
  Response: { id: string, ... }

GET /notes
GET /notes/{id}
PUT /notes/{id}
DELETE /notes/{id}

GET /health
  Response: { status: "ok", model: "gemma3:4b" }
```

---

## Technology Choices

| Layer | Technology | Reason |
|-------|------------|--------|
| Frontend | React + Vite + TypeScript | Lovable's stack, fast dev |
| UI Components | shadcn/ui + Tailwind | Already set up, looks good |
| Backend | Python + FastAPI | Best LLM ecosystem, async |
| Database | SQLite | Local-first, zero config |
| Vector Store | ChromaDB or sqlite-vec | Embeddings for RAG |
| Local LLM | Ollama + Gemma 3 4B | Privacy, offline, free |
| Cloud LLM | Claude/OpenAI (optional) | Heavy tasks fallback |

---

## What We're NOT Doing (Yet)

- Mobile native app (Capacitor wrapper is fine for now)
- Multi-user support (single user only)
- Real-time collaboration
- Complex automation/workflows
- Email/calendar integrations (Phase 5+)

---

## Repository Structure

```
second-local-brain/
├── .github/
│   └── workflows/        # CI/CD, Claude PR reviewer
├── docs/
│   ├── MASTER_PLAN.md    # This file
│   ├── TASKS_BACKEND.md  # Claude Code's task list
│   ├── TASKS_FRONTEND.md # Lovable's task list
│   ├── GUIDELINES.md     # How we work together
│   └── API.md            # Detailed API spec
├── backend/              # Python brain service (Claude Code)
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── src/                  # React frontend (Lovable)
│   ├── components/
│   ├── pages/
│   └── ...
├── supabase/             # Legacy - to be phased out
└── ...
```
