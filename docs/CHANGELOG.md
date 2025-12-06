# Changelog

All notable changes to this project will be documented in this file.

---

## [0.2.0] - 2024-12-06

### Frontend: Chat-First UI Implementation (Lovable)

**What happened:** Rebuilt the frontend to match the local-first architecture with a ChatGPT-style interface.

### Changed

#### Pages
- `src/pages/Index.tsx` - Complete rewrite as chat-first UI:
  - Full-screen conversation interface
  - Collapsible sidebar with conversation history
  - Message bubbles (user/assistant styling)
  - Text input with send button + placeholder mic button
  - Backend health status indicator
  - Connects to `POST /chat` at localhost:8000
  - Loads conversations from `GET /conversations`
  - Auto-scroll to latest message
  
- `src/pages/Settings.tsx` - Simplified for local-first:
  - Removed all Supabase dependencies
  - Shows backend service info (localhost:8000, Gemma model)
  - Clean cards for Backend, AI Config, Data & Storage sections

### Removed

#### Components (had Supabase dependencies)
- `src/components/NoteInput.tsx` - Was using Supabase functions
- `src/components/NoteDialog.tsx` - Was using Supabase client
- `src/components/TaskList.tsx` - Was using Supabase client
- `src/components/TaskDialog.tsx` - Was using Supabase client

### Fixed
- Added missing `@vitejs/plugin-react` dependency
- Added missing `lovable-tagger` dependency

---

## [0.1.0] - 2024-12-06

### Major Architecture Change: Local-First Pivot

**What happened:** The project has been restructured from a cloud-first (Supabase) architecture to a local-first architecture using a Python backend with Ollama/Gemma.

**Why:** To enable fully offline operation, privacy (data stays local), and alignment with the master plan vision of "one brain, many surfaces."

### Removed

#### Supabase (entire cloud backend)
- `supabase/` folder - All edge functions:
  - auto-link-notes, categorize-note, check-google-connection
  - create-realtime-session, extract-topics, format-transcript
  - generate-embeddings, generate-meeting-summary
  - get-google-oauth-url, google-auth-callback
  - process-smart-input, sync-from-google-calendar
  - sync-to-google-calendar, transcribe-audio
- `supabase/migrations/` - All database migrations
- `src/integrations/supabase/` - Client and types
- `.env` - Contained Supabase/OpenAI API keys

#### Unused Components
- `src/components/VoiceInterface.tsx` - OpenAI Realtime API integration
- `src/components/VoiceRecorder.tsx` - Audio recording
- `src/components/AudioUpload.tsx` - Audio file upload
- `src/components/MeetingMode.tsx` - Meeting transcription
- `src/components/CalendarView.tsx` - Calendar display
- `src/components/CalendarEventDialog.tsx` - Event creation
- `src/components/GraphView.tsx` - Note graph visualization
- `src/components/CategorySidebar.tsx` - Category navigation
- `src/components/NotesGrid.tsx` - Grid view of notes
- `src/components/ObsidianStyleNoteView.tsx` - Markdown note viewer
- `src/utils/RealtimeAudio.ts` - WebRTC audio handling

#### Unused Pages
- `src/pages/Auth.tsx` - Supabase authentication
- `src/pages/Dashboard.tsx` - Tab-based dashboard
- `src/pages/Home.tsx` - Old home page

#### Mobile (not MVP priority)
- `android/` folder - Capacitor Android build
- `capacitor.config.ts` - Capacitor configuration
- `MOBILE_SETUP.md` - Mobile setup instructions

#### Dependencies (from package.json)
- `@capacitor/android`, `@capacitor/app`, `@capacitor/cli`, `@capacitor/core`, `@capacitor/ios`
- `@supabase/auth-ui-react`, `@supabase/auth-ui-shared`, `@supabase/supabase-js`
- `recharts`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`
- `input-otp`, `vaul`, `@vitejs/plugin-react`

### Added

#### Documentation (`docs/`)
- `MASTER_PLAN.md` - Overall vision and architecture
- `API.md` - Backend API contract (source of truth for frontend/backend)
- `GUIDELINES.md` - How Claude Code and Lovable collaborate
- `TASKS_BACKEND.md` - Claude Code's task list
- `TASKS_FRONTEND.md` - Lovable's task list
- `CLEANUP_PLAN.md` - Analysis of what to keep/remove
- `CHANGELOG.md` - This file

#### Backend (`backend/`)
- `main.py` - FastAPI brain service with:
  - `GET /health` - Check Ollama connection
  - `POST /chat` - Send message, get AI response
  - `GET /conversations` - List conversations
  - `GET /conversations/{id}` - Get conversation details
  - `DELETE /conversations/{id}` - Delete conversation
- `requirements.txt` - Python dependencies
- `README.md` - Backend setup instructions

### Kept (for Lovable to use/modify)

#### UI Components (`src/components/`)
- `ui/` - All shadcn/ui components (buttons, dialogs, inputs, etc.)
- `NoteInput.tsx` - Could adapt for chat input
- `NoteDialog.tsx` - Could use for note viewing
- `TaskList.tsx` - Future task feature
- `TaskDialog.tsx` - Future task feature

#### Pages (`src/pages/`)
- `Index.tsx` - **Needs to be rebuilt as chat-first UI**
- `Settings.tsx` - Keep but simplify
- `NotFound.tsx` - Keep as-is

#### Configuration
- All Tailwind, Vite, TypeScript, ESLint config unchanged

---

## For Lovable: What You Need to Do

1. **Read the documentation:**
   - `docs/MASTER_PLAN.md` - Understand the vision
   - `docs/TASKS_FRONTEND.md` - Your task list
   - `docs/API.md` - API endpoints to connect to

2. **Rebuild Index.tsx as chat-first:**
   - The main page should be a full-screen chat interface
   - See `docs/TASKS_FRONTEND.md` for component structure

3. **Backend is ready:**
   - API runs at `http://localhost:8000`
   - Use `POST /chat` with `{ message: string }` to chat
   - Returns `{ reply: string, conversation_id: string }`

4. **Keep using shadcn/ui components** - They're already set up

5. **Update your task list** (`docs/TASKS_FRONTEND.md`) as you complete tasks
