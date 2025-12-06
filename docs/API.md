# API Specification

> **This is the contract between frontend and backend.**
> Both sides must implement exactly what's specified here.

Base URL: `http://localhost:8000`

---

## Health & Status

### GET /health

Check if the brain service is running and connected to Ollama.

**Response:**
```json
{
  "status": "ok",
  "ollama": "connected",
  "model": "gemma3:4b",
  "version": "0.1.0"
}
```

**Error (503):**
```json
{
  "detail": "Ollama not available"
}
```

---

## Chat

### POST /chat

Send a message and get a response from the AI.

**Request:**
```json
{
  "message": "Hello, help me plan my day",
  "conversation_id": "optional-existing-id"
}
```

**Response:**
```json
{
  "reply": "I'd be happy to help you plan your day...",
  "conversation_id": "20241206_153000",
  "timestamp": "2024-12-06T15:30:00.000Z"
}
```

**Notes:**
- If `conversation_id` is omitted, a new conversation is created
- If provided, the message is added to existing conversation history
- The AI has access to the full conversation history for context

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

### POST /notes

Create a new note.

**Request:**
```json
{
  "content": "Meeting notes from today...",
  "title": "Team Meeting 2024-12-06"
}
```

**Response:**
```json
{
  "id": "note_abc123",
  "title": "Team Meeting 2024-12-06",
  "content": "Meeting notes from today...",
  "created_at": "2024-12-06T15:30:00.000Z",
  "updated_at": "2024-12-06T15:30:00.000Z"
}
```

### GET /notes

List all notes.

**Query Parameters:**
- `search` (optional): Text search query
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "notes": [
    {
      "id": "note_abc123",
      "title": "Team Meeting 2024-12-06",
      "content": "Meeting notes from today...",
      "created_at": "2024-12-06T15:30:00.000Z",
      "updated_at": "2024-12-06T15:30:00.000Z"
    }
  ],
  "total": 1
}
```

### GET /notes/{id}

Get a specific note.

**Response:**
```json
{
  "id": "note_abc123",
  "title": "Team Meeting 2024-12-06",
  "content": "Meeting notes from today...",
  "created_at": "2024-12-06T15:30:00.000Z",
  "updated_at": "2024-12-06T15:30:00.000Z"
}
```

### PUT /notes/{id}

Update a note.

**Request:**
```json
{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

**Response:** Same as GET /notes/{id}

### DELETE /notes/{id}

Delete a note.

**Response:**
```json
{
  "deleted": "note_abc123"
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
- `503` - Service unavailable (Ollama down)

---

## Future Endpoints (Not Yet Implemented)

These are planned but not ready yet:

```
POST /notes/search     # Semantic search with embeddings
GET  /tasks            # Task management
POST /tasks
PUT  /tasks/{id}
DELETE /tasks/{id}
```

---

## Changelog

| Date | Change |
|------|--------|
| 2024-12-06 | Initial API specification |
