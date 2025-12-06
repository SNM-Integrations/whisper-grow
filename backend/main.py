"""
Second Brain - Core Brain Service

This is the central brain service that orchestrates all interactions.
It provides a unified API that any frontend (Windows app, web, etc.) can use.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from typing import Optional
from datetime import datetime

app = FastAPI(
    title="Second Brain",
    description="Your personal AI brain service",
    version="0.1.0",
)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_URL = "http://localhost:11434"
MODEL = "gemma3:4b"

# System prompt that defines the AI's identity
SYSTEM_PROMPT = """You are the user's Second Brain - a personal AI assistant that helps them think, remember, and act.

Your core responsibilities:
1. UNDERSTAND - Help the user think through problems, plan, and reflect
2. REMEMBER - Keep track of their notes, decisions, and context over time
3. ACT - Execute tasks and help them get things done

Your personality:
- Direct and concise - respect the user's time
- Thoughtful - consider context before responding
- Proactive - suggest relevant actions when appropriate
- Personal - you know this user and adapt to their style

Always be helpful, but never be sycophantic. Give honest, useful answers."""


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    timestamp: str


# Simple in-memory conversation storage (will be replaced with proper DB later)
conversations: dict = {}


@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "service": "Second Brain",
        "status": "running",
        "model": MODEL,
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    """Check if Ollama is accessible."""
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        models = resp.json().get("models", [])
        gemma_installed = any(m["name"].startswith("gemma3") for m in models)

        return {
            "status": "ok",
            "ollama": "connected",
            "gemma_installed": gemma_installed,
            "model": MODEL,
            "version": "0.1.0",
            "models": [m["name"] for m in models],
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama not available: {e}")


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    Main conversation endpoint.

    This is the primary way to interact with your second brain.
    Send a message, get a thoughtful response.
    """
    # Get or create conversation
    conv_id = req.conversation_id or datetime.now().strftime("%Y%m%d_%H%M%S")

    if conv_id not in conversations:
        conversations[conv_id] = []

    # Build message history
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(conversations[conv_id])
    messages.append({"role": "user", "content": req.message})

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": MODEL,
                "messages": messages,
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()

        data = resp.json()
        reply = data["message"]["content"]

        # Store conversation history
        conversations[conv_id].append({"role": "user", "content": req.message})
        conversations[conv_id].append({"role": "assistant", "content": reply})

        return ChatResponse(
            reply=reply,
            conversation_id=conv_id,
            timestamp=datetime.now().isoformat(),
        )

    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversations")
def list_conversations():
    """List all active conversations."""
    return {
        "conversations": [
            {
                "id": conv_id,
                "message_count": len(messages),
                "last_message": messages[-1]["content"][:100] if messages else None,
            }
            for conv_id, messages in conversations.items()
        ]
    }


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    """Get a specific conversation with all messages."""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = conversations[conversation_id]
    return {
        "id": conversation_id,
        "messages": messages,
        "message_count": len(messages),
    }


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"deleted": conversation_id}
    raise HTTPException(status_code=404, detail="Conversation not found")


if __name__ == "__main__":
    import uvicorn

    print("\n=== Second Brain Service ===")
    print("Starting on http://localhost:8000")
    print("API docs at http://localhost:8000/docs")
    print("============================\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
