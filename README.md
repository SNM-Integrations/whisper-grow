# Second Brain

A personal AI assistant that understands you, remembers for you, and acts for you.

**One brain, many surfaces** - Windows app (local Gemma), Web/mobile (cloud LLM), same memory, same identity.

## Architecture

```
Frontend (React)  →  Backend (Python/FastAPI)  →  Gemma (Ollama)
     src/                  backend/                  localhost:11434
```

## Quick Start

### 1. Start the LLM (Ollama + Gemma)

```bash
ollama run gemma3:4b
```

### 2. Start the Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py
```

Backend runs at `http://localhost:8000`

### 3. Start the Frontend

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Project Structure

```
second-brain/
├── docs/                 # Documentation
│   ├── MASTER_PLAN.md    # Vision and architecture
│   ├── API.md            # API contract
│   ├── TASKS_BACKEND.md  # Backend task list
│   └── TASKS_FRONTEND.md # Frontend task list
├── backend/              # Python FastAPI service
│   ├── main.py           # Brain service
│   └── requirements.txt
├── src/                  # React frontend
│   ├── components/
│   ├── pages/
│   └── ...
└── ...
```

## Development

This project is developed by two AI agents:
- **Claude Code** - Backend development
- **Lovable** - Frontend development

See `docs/GUIDELINES.md` for collaboration workflow.

## Documentation

- [Master Plan](docs/MASTER_PLAN.md) - Overall vision and architecture
- [API Specification](docs/API.md) - Backend API contract
- [Guidelines](docs/GUIDELINES.md) - Development workflow

---

## Using Lovable

This project is connected to [Lovable](https://lovable.dev/projects/eed02dec-e8b2-4e5e-a52f-9a4de393a610) for frontend development.

Changes made via Lovable will be committed automatically to this repo.
