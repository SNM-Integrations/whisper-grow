# Frontend Tasks (Lovable)

> Owner: Lovable
> Last updated: 2024-12-06

## Current Sprint: Conversation-First UI

### Design Direction

**The chat interface is the primary experience.** Users open the app and are immediately in a conversation. Everything else (notes, tasks, settings) is secondary and accessible from the chat or sidebar.

Think: ChatGPT/Claude interface, not a dashboard with tabs.

### To Do

#### Phase 1: Core Chat UI ✅ DONE
- [x] Redesign Index/Home to be chat-first (full-screen conversation)
- [x] Create ChatMessage component (user vs assistant styling)
- [x] Create ChatInput component (text input + send button)
- [x] Create ConversationList sidebar (list of past conversations)
- [x] Connect chat UI to `POST /chat` backend endpoint
- [x] Handle loading states while waiting for AI response
- [x] Auto-scroll to latest message
- [x] Persist conversation ID across messages

#### Phase 2: Polish & UX
- [x] Add typing indicator while AI is thinking ✅ DONE
- [ ] Support markdown rendering in AI responses
- [x] Add copy button for AI responses ✅ DONE
- [x] Keyboard shortcuts (Enter to send, etc.) ✅ DONE
- [ ] Mobile responsive design
- [ ] Dark theme (primary), light theme (optional)

#### Phase 3: Notes Integration ✅ DONE
- [ ] Add "Save as note" action on AI responses
- [x] Create NotesPanel (sidebar or modal) ✅ DONE
- [x] Display saved notes ✅ DONE
- [x] Search notes ✅ DONE
- [x] Connect to backend notes endpoints ✅ DONE

#### Phase 3.5: Semantic Search ✅ DONE
- [x] Create SearchPanel component ✅ DONE
- [x] Connect to /memory/search endpoint ✅ DONE
- [x] Display search results with relevance scores ✅ DONE

#### Phase 4: Settings & Identity
- [ ] Settings page for AI preferences
- [ ] Display current model info ✅ DONE
- [ ] Theme toggle
- [ ] Clear conversation history option

### Cleanup Tasks ✅ DONE
- [x] Remove old dashboard tab structure
- [x] Remove MeetingMode component (not needed for MVP)
- [x] Remove Google Calendar integration (future phase)
- [x] Remove Supabase auth (replaced with local-first approach)
- [x] Clean up unused components

### Completed
- [x] Initial Lovable project setup
- [x] shadcn/ui components installed
- [x] Basic routing structure
- [x] Redesign Index/Home to be chat-first (full-screen conversation)
- [x] Create ChatMessage component (inline in Index.tsx for now)
- [x] Create ChatInput component (inline in Index.tsx for now)
- [x] Create ConversationList sidebar (inline in Index.tsx for now)
- [x] Connect chat UI to `POST /chat` backend endpoint
- [x] Handle loading states while waiting for AI response
- [x] Auto-scroll to latest message
- [x] Persist conversation ID across messages
- [x] Remove Supabase auth dependencies
- [x] Clean up unused components (NoteInput, NoteDialog, TaskList, TaskDialog)
- [x] Created src/lib/api.ts - centralized API client
- [x] Created src/components/notes/NotesPanel.tsx - notes list with CRUD
- [x] Created src/components/notes/NoteEditor.tsx - note editor
- [x] Created src/components/search/SearchPanel.tsx - semantic search UI
- [x] Added sidebar tabs (Chat / Notes / Search)
- [x] Added copy button on assistant messages
- [x] Improved typing indicator animation

---

## Design Principles

1. **Conversation is primary** - Chat takes up most of the screen
2. **Minimal chrome** - Hide UI elements until needed
3. **Fast and responsive** - No unnecessary loading states
4. **Dark by default** - Easy on the eyes for long sessions
5. **Keyboard-friendly** - Power users can navigate without mouse

---

## Component Structure (Suggested)

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx    # Main chat wrapper
│   │   ├── ChatMessage.tsx      # Single message bubble
│   │   ├── ChatInput.tsx        # Input field + send
│   │   └── TypingIndicator.tsx  # "AI is thinking..."
│   ├── sidebar/
│   │   ├── Sidebar.tsx          # Collapsible sidebar
│   │   ├── ConversationList.tsx # Past conversations
│   │   └── NotesPanel.tsx       # Quick notes view
│   └── ui/                      # shadcn components (keep)
├── pages/
│   ├── Index.tsx                # Main chat page
│   └── Settings.tsx             # Settings page
├── hooks/
│   ├── useChat.ts               # Chat state management
│   └── useConversations.ts      # Conversation list
└── lib/
    └── api.ts                   # Backend API calls
```

---

## API Endpoints to Use

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /chat` | Send message, get reply | Backend: Planned |
| `GET /conversations` | List past conversations | Backend: Planned |
| `GET /conversations/{id}` | Load conversation history | Backend: Planned |
| `DELETE /conversations/{id}` | Delete conversation | Backend: Planned |
| `GET /health` | Check backend status | Backend: Planned |

**Note:** Wait for backend to confirm endpoints are ready before connecting.

---

## Blockers

| Issue | Waiting On |
|-------|-----------|
| Can't connect to chat | Backend: `POST /chat` endpoint |
| Can't list conversations | Backend: `GET /conversations` endpoint |

---

## Notes for Lovable

- Keep the existing shadcn/ui components - they're useful
- The `src/components/ui/` folder is auto-generated by shadcn, don't modify
- You have creative freedom on the UI design - make it beautiful
- Focus on the chat experience first, everything else is secondary
- Backend URL will be `http://localhost:8000` during development
