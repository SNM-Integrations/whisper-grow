# Backend Tasks (Claude Code)

> Owner: Claude Code
> Last updated: 2024-12-06

## Current Sprint: Core Brain Service

### In Progress
- [ ] Set up backend folder structure with FastAPI

### To Do

#### Phase 1: Foundation
- [ ] Create `backend/main.py` with FastAPI app
- [ ] Create `backend/requirements.txt`
- [ ] Implement `GET /health` endpoint
- [ ] Implement `POST /chat` endpoint (connects to Ollama/Gemma)
- [ ] Add conversation memory (in-memory first)
- [ ] Set up SQLite database schema
- [ ] Migrate conversation storage to SQLite
- [ ] Add `GET /conversations` endpoint
- [ ] Add `GET /conversations/{id}` endpoint
- [ ] Add `DELETE /conversations/{id}` endpoint

#### Phase 2: Notes System
- [ ] Create notes table in SQLite
- [ ] Implement `POST /notes` endpoint
- [ ] Implement `GET /notes` endpoint
- [ ] Implement `GET /notes/{id}` endpoint
- [ ] Implement `PUT /notes/{id}` endpoint
- [ ] Implement `DELETE /notes/{id}` endpoint
- [ ] Add note search (basic text search first)

#### Phase 3: Embeddings & RAG
- [ ] Integrate ChromaDB or sqlite-vec
- [ ] Generate embeddings for notes on save
- [ ] Implement semantic search endpoint
- [ ] Add context retrieval to chat (RAG)

#### Phase 4: Tools
- [ ] Design tool system architecture
- [ ] Implement file read tool
- [ ] Implement file write tool
- [ ] Implement note creation tool (for AI to save things)
- [ ] Add tool execution to chat flow

### Completed
- [x] Initial Gemma test via Ollama (2024-12-06)
- [x] Basic FastAPI proof of concept (2024-12-06)

---

## Notes

### Dependencies
- Python 3.11+
- FastAPI + Uvicorn
- Requests (for Ollama API)
- SQLite (built-in)
- ChromaDB or sqlite-vec (for embeddings)

### Environment
- Ollama must be running on localhost:11434
- Gemma 3 4B model must be pulled

### Blockers
None currently.

---

## API Endpoints Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /health` | Planned | |
| `POST /chat` | Planned | |
| `GET /conversations` | Planned | |
| `GET /conversations/{id}` | Planned | |
| `DELETE /conversations/{id}` | Planned | |
| `POST /notes` | Planned | |
| `GET /notes` | Planned | |
| `GET /notes/{id}` | Planned | |
| `PUT /notes/{id}` | Planned | |
| `DELETE /notes/{id}` | Planned | |
