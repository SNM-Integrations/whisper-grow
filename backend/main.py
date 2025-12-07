"""
Second Brain - Core Brain Service

This is the central brain service that orchestrates all interactions.
It provides a unified API that any frontend (Windows app, web, etc.) can use.

Supports two modes:
- LOCAL: Ollama + SQLite + ChromaDB (default)
- CLOUD: Claude/OpenAI + PostgreSQL + pgvector
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

from config import Config
from llm import get_client
from database import get_db, init_db
from memory import get_memory, init_memory
from files import get_file_manager

app = FastAPI(
    title="Second Brain",
    description="Your personal AI brain service",
    version="0.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Request/Response Models ===

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    use_memory: bool = True  # Whether to search memory for context


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    timestamp: str
    memory_used: Optional[list[dict]] = None  # What memories were retrieved


class NoteRequest(BaseModel):
    title: str
    content: str
    tags: Optional[list[str]] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    updated_at: str


class SearchRequest(BaseModel):
    query: str
    n_results: int = 5
    filter_type: Optional[str] = None  # "note", "conversation", "document"


class FileWriteRequest(BaseModel):
    content: str


class FileSearchRequest(BaseModel):
    query: str
    path: str = ""
    pattern: str = "*"


# === Startup ===

@app.on_event("startup")
async def startup():
    """Initialize database and memory on startup."""
    init_db()

    # Try to initialize memory, but don't fail if chromadb isn't installed
    try:
        init_memory()
        memory_status = "ok"
    except ImportError as e:
        memory_status = f"unavailable ({e})"

    print(f"Mode: {Config.MODE.upper()}")
    if Config.is_local():
        print(f"LLM: Ollama ({Config.OLLAMA_MODEL})")
        print(f"Database: SQLite ({Config.SQLITE_PATH})")
        print(f"Memory: ChromaDB ({memory_status})")
    else:
        print(f"LLM: {Config.LLM_PROVIDER} ({Config.ANTHROPIC_MODEL if Config.LLM_PROVIDER == 'anthropic' else Config.OPENAI_MODEL})")
        print(f"Database: PostgreSQL")
        print(f"Memory: pgvector ({memory_status})")


# === Health Endpoints ===

@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "service": "Second Brain",
        "status": "running",
        "mode": Config.MODE,
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    """Check service health including LLM connectivity."""
    llm = get_client()
    llm_health = llm.health_check()

    return {
        "status": "ok" if llm_health.get("status") == "ok" else "degraded",
        "mode": Config.MODE,
        "llm": llm_health,
        "version": "0.1.0",
    }


# === Chat Endpoints ===

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    Main conversation endpoint.

    This is the primary way to interact with your second brain.
    Send a message, get a thoughtful response with relevant memory context.
    """
    db = get_db()
    llm = get_client()

    # Get or create conversation
    conv_id = req.conversation_id or datetime.now().strftime("%Y%m%d_%H%M%S")

    # Ensure conversation exists
    db.create_conversation(conv_id)

    # Get existing messages for context
    conv = db.get_conversation(conv_id)
    existing_messages = []
    if conv and conv.get("messages"):
        existing_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in conv["messages"]
        ]

    # Search memory for relevant context
    memory_context = []
    memory_used = []

    if req.use_memory:
        try:
            mem = get_memory()
            search_results = mem.search(req.message, n_results=3)

            for result in search_results:
                memory_context.append(result["text"][:500])  # Limit each chunk
                memory_used.append({
                    "id": result["id"],
                    "source": result["source"],
                    "preview": result["text"][:100] + "..."
                })
        except Exception:
            pass  # Memory not available, continue without it

    # Build system prompt with memory context
    system_prompt = Config.SYSTEM_PROMPT
    if memory_context:
        system_prompt += "\n\n--- Relevant memories from your knowledge base ---\n"
        for i, mem_text in enumerate(memory_context, 1):
            system_prompt += f"\n[Memory {i}]: {mem_text}\n"
        system_prompt += "\n--- End of memories ---\n\nUse these memories if relevant to the user's question."

    # Add new user message
    existing_messages.append({"role": "user", "content": req.message})

    try:
        # Get LLM response
        reply = llm.chat(existing_messages, system_prompt=system_prompt)

        # Save messages to database
        db.save_message(conv_id, "user", req.message)
        db.save_message(conv_id, "assistant", reply)

        return ChatResponse(
            reply=reply,
            conversation_id=conv_id,
            timestamp=datetime.now().isoformat(),
            memory_used=memory_used if memory_used else None,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# === Conversation Endpoints ===

@app.get("/conversations")
def list_conversations():
    """List all conversations."""
    db = get_db()
    conversations = db.list_conversations()

    return {
        "conversations": [
            {
                "id": c["id"],
                "title": c["title"],
                "last_message": c.get("last_message"),
                "message_count": c.get("message_count", 0),
                "updated_at": c.get("updated_at"),
            }
            for c in conversations
        ]
    }


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    """Get a specific conversation with all messages."""
    db = get_db()
    conv = db.get_conversation(conversation_id)

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conv


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    db = get_db()
    deleted = db.delete_conversation(conversation_id)

    if deleted:
        return {"deleted": conversation_id}
    raise HTTPException(status_code=404, detail="Conversation not found")


# === Notes Endpoints ===

@app.post("/notes", response_model=NoteResponse)
def create_note(req: NoteRequest):
    """Create a new note and add it to memory."""
    note_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    try:
        mem = get_memory()
        metadata = {"tags": req.tags} if req.tags else None
        mem.add_note(note_id, req.title, req.content, metadata)

        return NoteResponse(
            id=note_id,
            title=req.title,
            content=req.content,
            updated_at=now,
        )
    except ImportError:
        raise HTTPException(status_code=503, detail="Memory system not available. Install chromadb.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notes")
def list_notes():
    """List all notes."""
    try:
        mem = get_memory()
        notes = mem.list_notes()
        return {"notes": notes}
    except ImportError:
        return {"notes": [], "warning": "Memory system not available"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notes/{note_id}")
def get_note(note_id: str):
    """Get a specific note."""
    try:
        mem = get_memory()
        note = mem.get_note(note_id)

        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        return note
    except ImportError:
        raise HTTPException(status_code=503, detail="Memory system not available")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, req: NoteRequest):
    """Update an existing note."""
    try:
        mem = get_memory()

        # Check if note exists
        existing = mem.get_note(note_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Note not found")

        metadata = {"tags": req.tags} if req.tags else None
        mem.add_note(note_id, req.title, req.content, metadata)

        return NoteResponse(
            id=note_id,
            title=req.title,
            content=req.content,
            updated_at=datetime.now().isoformat(),
        )
    except ImportError:
        raise HTTPException(status_code=503, detail="Memory system not available")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/notes/{note_id}")
def delete_note(note_id: str):
    """Delete a note."""
    try:
        mem = get_memory()
        deleted = mem.delete_note(note_id)

        if deleted:
            return {"deleted": note_id}
        raise HTTPException(status_code=404, detail="Note not found")
    except ImportError:
        raise HTTPException(status_code=503, detail="Memory system not available")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# === Memory Search Endpoints ===

@app.post("/memory/search")
def search_memory(req: SearchRequest):
    """
    Search across all memories (notes, conversations, documents).

    Uses semantic search to find relevant content.
    """
    try:
        mem = get_memory()
        results = mem.search(req.query, n_results=req.n_results, filter_type=req.filter_type)

        return {
            "query": req.query,
            "results": results,
        }
    except ImportError:
        return {"query": req.query, "results": [], "warning": "Memory system not available"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/add")
def add_to_memory(text: str, source_type: str = "manual", metadata: Optional[dict] = None):
    """
    Add arbitrary content to memory.

    Useful for importing documents, web clips, etc.
    """
    chunk_id = str(uuid.uuid4())

    try:
        mem = get_memory()
        mem.add_memory_chunk(chunk_id, text, source_type, metadata)

        return {"id": chunk_id, "status": "added"}
    except ImportError:
        raise HTTPException(status_code=503, detail="Memory system not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# === File Endpoints ===

@app.get("/files")
def list_files(path: str = "", pattern: str = "*"):
    """
    List files in the workspace.

    - path: Directory path relative to workspace (default: root)
    - pattern: Glob pattern to filter files (default: *)
    """
    try:
        fm = get_file_manager()
        files = fm.list_files(path, pattern)
        return {"path": path, "files": files}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files/{file_path:path}")
def read_file(file_path: str):
    """Read a file's contents."""
    try:
        fm = get_file_manager()
        content = fm.read_file(file_path)

        if content is None:
            raise HTTPException(status_code=404, detail="File not found")

        return {
            "path": file_path,
            "content": content,
            "size": len(content),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/files/{file_path:path}")
def write_file(file_path: str, req: FileWriteRequest):
    """Write content to a file. Creates the file if it doesn't exist."""
    try:
        fm = get_file_manager()
        result = fm.write_file(file_path, req.content)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/files/{file_path:path}/append")
def append_file(file_path: str, req: FileWriteRequest):
    """Append content to a file."""
    try:
        fm = get_file_manager()
        result = fm.append_file(file_path, req.content)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/files/{file_path:path}")
def delete_file(file_path: str):
    """Delete a file."""
    try:
        fm = get_file_manager()
        deleted = fm.delete_file(file_path)

        if deleted:
            return {"deleted": file_path}
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/files/search")
def search_files(req: FileSearchRequest):
    """
    Search for files containing text.

    - query: Text to search for
    - path: Directory to search in (default: entire workspace)
    - pattern: File pattern to match (default: *)
    """
    try:
        fm = get_file_manager()
        results = fm.search_files(req.query, req.path, req.pattern)
        return {
            "query": req.query,
            "results": results,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/files/folder/{folder_path:path}")
def create_folder(folder_path: str):
    """Create a folder."""
    try:
        fm = get_file_manager()
        result = fm.create_folder(folder_path)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    print("\n=== Second Brain Service ===")
    print(f"Mode: {Config.MODE.upper()}")
    print(f"Starting on http://{Config.HOST}:{Config.PORT}")
    print(f"API docs at http://{Config.HOST}:{Config.PORT}/docs")
    print("============================\n")

    uvicorn.run(app, host=Config.HOST, port=Config.PORT)
