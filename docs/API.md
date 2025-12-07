# API Specification

> **This is the contract between frontend and backend.**
> Both sides must implement exactly what's specified here.

Base URL: `http://localhost:8000` (local) or configured via `VITE_API_URL`

---

## Health & Status

### GET /health

Check if the brain service is running and LLM is connected.

**Response:**
```json
{
  "status": "ok",
  "mode": "local",
  "llm": {
    "status": "ok",
    "provider": "ollama",
    "model": "gemma3:4b",
    "model_installed": true
  },
  "version": "0.1.0"
}
```

**Error (503):**
```json
{
  "detail": "LLM not available"
}
```

---

## Chat

### POST /chat

Send a message and get a response from the AI. Automatically retrieves relevant memories for context.

**Request:**
```json
{
  "message": "Hello, help me plan my day",
  "conversation_id": "optional-existing-id",
  "use_memory": true
}
```

**Response:**
```json
{
  "reply": "I'd be happy to help you plan your day...",
  "conversation_id": "20241206_153000",
  "timestamp": "2024-12-06T15:30:00.000Z",
  "memory_used": [
    {
      "id": "note_abc123",
      "source": "notes",
      "preview": "Yesterday's meeting: discussed Q4 goals..."
    }
  ]
}
```

**Notes:**
- If `conversation_id` is omitted, a new conversation is created
- If provided, the message is added to existing conversation history
- `use_memory: true` (default) searches notes and memories for context
- `memory_used` shows which memories were retrieved to help answer

---

## Conversations

### GET /conversations

List all conversations.

**Response:**
```json
{
  "conversations": [
    {
      "id": "20241206_153000",
      "title": "Day planning",
      "message_count": 5,
      "last_message": "Thanks, that helps!",
      "updated_at": "2024-12-06T15:35:00.000Z"
    }
  ]
}
```

### GET /conversations/{id}

Get a specific conversation with all messages.

**Response:**
```json
{
  "id": "20241206_153000",
  "title": "Day planning",
  "messages": [
    {
      "role": "user",
      "content": "Help me plan my day",
      "timestamp": "2024-12-06T15:30:00.000Z"
    },
    {
      "role": "assistant",
      "content": "I'd be happy to help...",
      "timestamp": "2024-12-06T15:30:05.000Z"
    }
  ],
  "created_at": "2024-12-06T15:30:00.000Z",
  "updated_at": "2024-12-06T15:35:00.000Z"
}
```

**Error (404):**
```json
{
  "detail": "Conversation not found"
}
```

### DELETE /conversations/{id}

Delete a conversation.

**Response:**
```json
{
  "deleted": "20241206_153000"
}
```

---

## Notes

Notes are stored in the memory system and can be semantically searched.

### POST /notes

Create a new note.

**Request:**
```json
{
  "title": "Team Meeting 2024-12-06",
  "content": "Meeting notes from today...",
  "tags": ["meetings", "q4"]
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Team Meeting 2024-12-06",
  "content": "Meeting notes from today...",
  "updated_at": "2024-12-06T15:30:00.000Z"
}
```

### GET /notes

List all notes.

**Response:**
```json
{
  "notes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Team Meeting 2024-12-06",
      "preview": "Meeting notes from today...",
      "updated_at": "2024-12-06T15:30:00.000Z"
    }
  ]
}
```

### GET /notes/{id}

Get a specific note.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Team Meeting 2024-12-06",
  "content": "Meeting notes from today...",
  "metadata": {"tags": ["meetings", "q4"]},
  "updated_at": "2024-12-06T15:30:00.000Z"
}
```

### PUT /notes/{id}

Update a note.

**Request:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "tags": ["meetings"]
}
```

**Response:** Same as POST /notes

### DELETE /notes/{id}

Delete a note.

**Response:**
```json
{
  "deleted": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Memory Search

### POST /memory/search

Semantic search across all memories (notes, conversation chunks, documents).

**Request:**
```json
{
  "query": "what did we discuss about Q4 goals?",
  "n_results": 5,
  "filter_type": "note"
}
```

**Response:**
```json
{
  "query": "what did we discuss about Q4 goals?",
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Team Meeting 2024-12-06\n\nMeeting notes...",
      "score": 0.85,
      "metadata": {"title": "Team Meeting", "tags": ["q4"]},
      "source": "notes"
    }
  ]
}
```

**filter_type options:**
- `"note"` - Only search notes
- `"conversation"` - Only search conversation chunks
- `"document"` - Only search imported documents
- `null` - Search all

### POST /memory/add

Add arbitrary content to memory (for imports, web clips, etc).

**Request:**
```json
{
  "text": "Content to remember...",
  "source_type": "web_clip",
  "metadata": {"url": "https://example.com"}
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "added"
}
```

---

## Files

File operations within the workspace folder. All paths are relative to the workspace.

### GET /files

List files in a directory.

**Query Parameters:**
- `path` (optional): Directory path relative to workspace (default: root)
- `pattern` (optional): Glob pattern to filter files (default: *)

**Response:**
```json
{
  "path": "notes",
  "files": [
    {
      "name": "meeting.md",
      "path": "notes/meeting.md",
      "type": "file",
      "size": 1234,
      "modified": "2024-12-06T15:30:00.000Z"
    },
    {
      "name": "archive",
      "path": "notes/archive",
      "type": "folder",
      "size": null,
      "modified": "2024-12-06T15:00:00.000Z"
    }
  ]
}
```

### GET /files/{path}

Read a file's contents.

**Response:**
```json
{
  "path": "notes/meeting.md",
  "content": "# Meeting Notes\n\nDiscussed Q4 goals...",
  "size": 1234
}
```

**Error (404):**
```json
{
  "detail": "File not found"
}
```

### PUT /files/{path}

Write content to a file. Creates the file and parent directories if they don't exist.

**Request:**
```json
{
  "content": "# New Note\n\nThis is my note content."
}
```

**Response:**
```json
{
  "path": "notes/new.md",
  "size": 42,
  "created": true,
  "modified": "2024-12-06T15:30:00.000Z"
}
```

### POST /files/{path}/append

Append content to a file.

**Request:**
```json
{
  "content": "\n\n## Additional section\n\nMore content..."
}
```

**Response:**
```json
{
  "path": "notes/meeting.md",
  "size": 1456,
  "modified": "2024-12-06T15:35:00.000Z"
}
```

### DELETE /files/{path}

Delete a file or empty folder.

**Response:**
```json
{
  "deleted": "notes/old.md"
}
```

### POST /files/search

Search for files containing text.

**Request:**
```json
{
  "query": "Q4 goals",
  "path": "notes",
  "pattern": "*.md"
}
```

**Response:**
```json
{
  "query": "Q4 goals",
  "results": [
    {
      "path": "notes/meeting.md",
      "name": "meeting.md",
      "matches": [
        {"line": 5, "text": "Discussed Q4 goals for the team..."},
        {"line": 12, "text": "Action items for Q4 goals:"}
      ],
      "match_count": 2
    }
  ]
}
```

### POST /files/folder/{path}

Create a folder (and parent directories).

**Response:**
```json
{
  "path": "notes/archive/2024",
  "created": true
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "detail": "Human-readable error message"
}
```

Common status codes:
- `400` - Bad request (invalid input)
- `404` - Not found
- `500` - Internal server error
- `503` - Service unavailable (LLM or memory system down)

---

## Future Endpoints (Not Yet Implemented)

These are planned but not ready yet:

```
GET  /tasks            # Task management
POST /tasks
PUT  /tasks/{id}
DELETE /tasks/{id}

POST /delegate         # Delegation mode
GET  /delegate/{id}/status
```

---

## Changelog

| Date | Change |
|------|--------|
| 2024-12-06 | Initial API specification |
| 2024-12-06 | Added memory system (notes, search, RAG) |
| 2024-12-06 | Added dual-mode support (local/cloud) |
| 2024-12-06 | Added file operations (read, write, list, search) |
