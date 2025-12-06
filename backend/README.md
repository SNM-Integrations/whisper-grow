# Second Brain - Backend

Python FastAPI service that powers the Second Brain.

## Setup

1. Make sure Ollama is running with Gemma:
   ```bash
   ollama run gemma3:4b
   ```

2. Create virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   python main.py
   ```

The API will be available at `http://localhost:8000`.
API documentation at `http://localhost:8000/docs`.

## Endpoints

- `GET /health` - Check service status
- `POST /chat` - Send a message, get AI response
- `GET /conversations` - List all conversations
- `GET /conversations/{id}` - Get conversation details
- `DELETE /conversations/{id}` - Delete a conversation

See `docs/API.md` for full specification.
