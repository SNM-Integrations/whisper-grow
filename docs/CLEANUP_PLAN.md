# Code Cleanup Plan

> Analysis of existing code: what to keep, modify, or remove.

## Summary

The existing codebase was built as a cloud-first dashboard app. We're pivoting to:
- **Local-first** (Ollama/Gemma instead of cloud LLMs)
- **Conversation-first UI** (chat, not dashboard tabs)
- **Python backend** (instead of Supabase edge functions)

---

## Files to KEEP

### Frontend Core
| File | Reason |
|------|--------|
| `src/components/ui/*` | shadcn components - reusable, well-built |
| `src/lib/utils.ts` | Utility functions |
| `src/index.css` | Base styles, Tailwind config |
| `tailwind.config.ts` | Tailwind configuration |
| `vite.config.ts` | Build configuration |
| `tsconfig.*.json` | TypeScript config |
| `package.json` | Dependencies (will trim) |
| `index.html` | Entry point |

### Keep but MODIFY
| File | Changes Needed |
|------|----------------|
| `src/App.tsx` | Simplify routes, remove auth redirects |
| `src/pages/Index.tsx` | Completely rewrite as chat-first |
| `src/pages/Settings.tsx` | Simplify, remove Google/Supabase |

---

## Files to REMOVE

### Supabase (Replacing with local backend)
| Path | Reason |
|------|--------|
| `supabase/` | Entire folder - using Python backend |
| `src/integrations/supabase/` | Supabase client - not needed |

### Unused Features
| File | Reason |
|------|--------|
| `src/components/MeetingMode.tsx` | Not in MVP |
| `src/components/VoiceInterface.tsx` | OpenAI Realtime - not for MVP |
| `src/components/VoiceRecorder.tsx` | Not for MVP |
| `src/components/AudioUpload.tsx` | Not for MVP |
| `src/components/CalendarView.tsx` | Not for MVP |
| `src/components/CalendarEventDialog.tsx` | Not for MVP |
| `src/components/GraphView.tsx` | Nice to have, not MVP |
| `src/utils/RealtimeAudio.ts` | OpenAI specific |

### Dashboard Components (Replacing with chat-first)
| File | Reason |
|------|--------|
| `src/pages/Dashboard.tsx` | Tab-based dashboard - replacing |
| `src/pages/Home.tsx` | Old home - replacing |
| `src/components/CategorySidebar.tsx` | Category system - simplifying |
| `src/components/NotesGrid.tsx` | Grid view - replacing with chat |
| `src/components/ObsidianStyleNoteView.tsx` | Complex - maybe later |

### Auth (Simplifying)
| File | Reason |
|------|--------|
| `src/pages/Auth.tsx` | Supabase auth - removing |

### Mobile (Not priority)
| Path | Reason |
|------|--------|
| `android/` | Capacitor Android - later |
| `capacitor.config.ts` | Mobile config - later |
| `MOBILE_SETUP.md` | Mobile docs - later |

---

## Components to KEEP (might reuse)

| Component | Potential Use |
|-----------|--------------|
| `NoteInput.tsx` | Could adapt for chat input |
| `NoteDialog.tsx` | Could use for note viewing |
| `TaskList.tsx` | Future task feature |
| `TaskDialog.tsx` | Future task feature |

---

## Dependencies to REMOVE from package.json

```json
// Remove these:
"@capacitor/android"
"@capacitor/app"
"@capacitor/cli"
"@capacitor/core"
"@capacitor/ios"
"@supabase/auth-ui-react"
"@supabase/auth-ui-shared"
"@supabase/supabase-js"
```

---

## Dependencies to KEEP

```json
// Keep these:
"@radix-ui/*"           // UI primitives
"@tanstack/react-query" // Data fetching
"lucide-react"          // Icons
"react"
"react-dom"
"react-router-dom"
"tailwind-merge"
"tailwindcss-animate"
"class-variance-authority"
"clsx"
"sonner"               // Toast notifications
"zod"                  // Validation
```

---

## New Files to CREATE

### Backend (`/backend`)
- `main.py` - FastAPI app
- `requirements.txt` - Python dependencies
- `database.py` - SQLite setup
- `models.py` - Pydantic models
- `routers/chat.py` - Chat endpoints
- `routers/notes.py` - Notes endpoints
- `services/llm.py` - Ollama integration

### Frontend (new/modified in `/src`)
- `components/chat/ChatContainer.tsx`
- `components/chat/ChatMessage.tsx`
- `components/chat/ChatInput.tsx`
- `hooks/useChat.ts`
- `lib/api.ts` - Backend API client

---

## Migration Order

1. **Create backend folder** with working chat endpoint
2. **Delete Supabase folder** and integrations
3. **Simplify package.json** - remove unused deps
4. **Rewrite Index.tsx** as chat-first
5. **Delete unused components** one by one
6. **Add new chat components**
7. **Connect frontend to backend**

---

## Risk Mitigation

- Keep git history - can always revert
- Don't delete shadcn/ui components - they're useful
- Test after each major deletion
- Keep old code in a branch if needed for reference
