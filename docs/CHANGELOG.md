# Changelog

All notable changes to this project will be documented in this file.

---

## [0.7.0] - 2025-12-08

### Organization Polish & Resource Sharing (Lovable)

**What happened:** Enhanced the organization system with invitation acceptance flow, task visibility sharing, and AI tool improvements.

### Added

#### Invitation Acceptance Flow
- `src/components/organization/PendingInvitations.tsx` - UI for accepting/declining org invitations
- Users see pending invitations on the main page after login
- Accept adds user to org, decline removes invitation
- RLS policies for:
  - Users can view invitations for their email
  - Users can decline invitations for their email  
  - Users can accept invitations and join organizations

#### Task Visibility & Sharing
- Tasks now support `visibility` and `organization_id` fields
- Added `VisibilitySelector` to task creation/edit dialog
- Tasks with `visibility = 'organization'` show "Shared" badge
- Shared tasks visible to all organization members via RLS

#### AI Chat Tool Improvements
- Added `relationship` parameter to `create_contact` tool
- Relationship types: friend, colleague, partner, network
- AI can now correctly set relationship type when creating contacts via chat

### Updated Files
- `src/components/tasks/TasksPanel.tsx` - Added visibility selector and shared badge
- `src/lib/supabase-api.ts` - Updated Task type with visibility fields
- `supabase/functions/chat/index.ts` - Added relationship to create_contact tool
- `src/pages/Index.tsx` - Added PendingInvitations component

### For Claude Code: What's New

1. **Invitation Flow Complete:**
   - Users can now accept invitations through the UI
   - No email sending (would need Resend API key)
   - Invitation appears on main page if pending

2. **Task Sharing Works:**
   - When in org context, tasks can be shared with org
   - RLS enforces org-level visibility automatically

3. **AI Contact Creation Fixed:**
   - AI chat can now use "partner" relationship type
   - Previously was missing from tool definition

---

## [0.6.0] - 2025-12-08

### Organization System: Multi-Tenancy Support (Lovable)

**What happened:** Added full organization/workspace system for team collaboration with role-based access control.

### Added

#### Database Tables (via Supabase migration)
- `organizations` - Organization entities with name/slug
- `organization_members` - Links users to orgs with roles (owner/admin/member)
- `organization_invitations` - Pending invites with expiration

#### New Database Types
- `org_role` enum: 'owner', 'admin', 'member'
- `resource_visibility` enum: 'personal', 'organization'

#### Database Schema Updates
- Added `organization_id` and `visibility` columns to:
  - `conversations`, `tasks`, `notes`, `contacts`, `companies`, `deals`, `calendar_events`
- Updated RLS policies on all tables to support organization-level access

#### Security Functions (security definer)
- `is_org_member(user_id, org_id)` - Check org membership
- `is_org_admin(user_id, org_id)` - Check admin/owner status
- `get_user_org_ids(user_id)` - Get all orgs user belongs to

#### New Components
- `src/hooks/useOrganization.ts` - Organization state management
- `src/components/organization/OrganizationSwitcher.tsx` - UI to toggle between Personal and Organization modes
- `src/components/organization/OrganizationSettings.tsx` - Admin panel for member management
- `src/components/organization/VisibilitySelector.tsx` - Resource visibility picker

### For Claude Code: Organization System Complete

1. **Visibility Logic:**
   - Resources with `visibility = 'personal'` are only visible to owner
   - Resources with `visibility = 'organization'` are visible to all org members
   - RLS policies enforce this automatically

2. **Context Switching:**
   - Users can switch between Personal and Organization modes
   - Context is stored in localStorage for persistence

3. **Role Hierarchy:**
   - Owner: Full control, can't be removed
   - Admin: Manage members, invite users
   - Member: View/create org-shared resources

4. **Invitation Flow:**
   - Admins invite by email
   - Users accept/decline via UI
   - Invitations expire after 7 days

---

## [0.5.0] - 2025-01-08

### Cloud Migration: Lovable Cloud Integration (Lovable)

**What happened:** Migrated the frontend from localhost Python backend to Lovable Cloud (Supabase) for full cloud deployment.

### Added

#### Database Tables (via Supabase migration)
- `contacts` - CRM contacts with RLS policies
- `companies` - CRM companies with RLS policies  
- `deals` - CRM deals with stage tracking and RLS
- `conversations` - Chat conversation storage
- `messages` - Chat message history

#### Edge Function
- `supabase/functions/chat/index.ts` - AI chat using Lovable AI gateway
  - Streaming responses via SSE
  - Uses `google/gemini-2.5-flash` model
  - Authenticated via JWT

#### New Files
- `src/lib/supabase-api.ts` - Cloud API layer replacing localhost calls
  - Notes CRUD (uses existing `notes` table)
  - Contacts, Companies, Deals CRUD
  - Conversations and Messages CRUD
  - `streamChat()` - Streaming AI chat function

- `src/components/auth/AuthForm.tsx` - Login/signup form
- `src/hooks/useAuth.ts` - Auth state management hook

#### Updated Files
- `src/pages/Index.tsx` - Now uses cloud API with streaming chat
- `src/integrations/supabase/client.ts` - Added fallback credentials
- `supabase/config.toml` - Added chat function config

### For Claude Code: What You Need to Do

The frontend is now fully cloud-based. The Python backend (`backend/`) is NO LONGER NEEDED for the cloud version.

**Remaining tasks for Claude Code:**

1. **Update NotesPanel to use cloud API:**
   - Change import from `@/lib/api` to `@/lib/supabase-api`
   - The `notes` table already exists in Supabase

2. **Update SearchPanel to use cloud API:**
   - Currently calls localhost for semantic search
   - Either implement an edge function for search OR
   - Use Supabase full-text search on notes

3. **Wire CRM components to real data:**
   - `ContactsList.tsx` - Uses mock data, needs to use `fetchContacts()`
   - `DealsPipeline.tsx` - Uses mock data, needs to use `fetchDeals()`
   - `CompaniesList.tsx` - Uses mock data, needs to use `fetchCompanies()`

4. **Optional cleanup:**
   - Remove `backend/` folder (no longer needed for cloud)
   - Remove `src/lib/api.ts` (replaced by `supabase-api.ts`)

### Important Notes

- Authentication is now required - users must sign up/sign in
- Auto-confirm email is enabled (no email verification needed)
- The chat uses Lovable AI (no API keys required from user)
- All data is stored in Supabase with proper RLS policies

---

## [0.4.0] - 2024-12-06

### Backend: File Tools Implementation (Claude Code)

**What happened:** Added file operations for reading, writing, and searching files within a sandboxed workspace.

### Added

#### File Manager (`backend/files.py`)
- `FileManager` abstract base class for file operations
- `LocalFileManager` - Local mode with workspace sandboxing (prevents directory traversal attacks)
- Workspace folder at `backend/workspace/` for storing user files

#### New API Endpoints (see `docs/API.md`)
- `GET /files` - List files in a directory
- `GET /files/{path}` - Read a file's contents
- `PUT /files/{path}` - Write/create a file
- `POST /files/{path}/append` - Append to a file
- `DELETE /files/{path}` - Delete a file
- `POST /files/search` - Search for files containing text
- `POST /files/folder/{path}` - Create a folder

#### Security Features
- All file paths sandboxed within workspace folder
- Directory traversal prevention (../ attacks blocked)
- Only text files supported (binary files not processed)

### Gen 1 Backend Complete!

All backend requirements for Gen 1 are now complete:
- ✅ Chat with Gemma via Ollama
- ✅ Conversation history in SQLite
- ✅ Notes with semantic memory (ChromaDB)
- ✅ File tools (read, write, list, search)
- ✅ Dual-mode architecture (local/cloud ready)

Frontend still needs: Notes UI, File browser UI

---

## [0.3.0] - 2024-12-06

### Backend: Memory System Implementation (Claude Code)

**What happened:** Added complete memory system with notes, semantic search, and RAG integration.

### Added

#### Memory System (`backend/memory.py`)
- `MemoryStore` abstract base class for memory operations
- `ChromaMemoryStore` - Local mode using ChromaDB (file-based vector store)
- `PgVectorMemoryStore` - Cloud mode using PostgreSQL + pgvector
- Supports notes, memory chunks (conversation snippets, documents, web clips)
- Semantic search across all memory types

#### New API Endpoints (see `docs/API.md`)
- `POST /notes` - Create a note
- `GET /notes` - List all notes
- `GET /notes/{id}` - Get a specific note
- `PUT /notes/{id}` - Update a note
- `DELETE /notes/{id}` - Delete a note
- `POST /memory/search` - Semantic search across all memories
- `POST /memory/add` - Add arbitrary content to memory

#### RAG Integration in Chat
- Chat now automatically retrieves relevant memories for context
- `POST /chat` accepts `use_memory: bool` parameter (default: true)
- Response includes `memory_used` showing which memories were retrieved

#### Updated Files
- `backend/main.py` - Added notes and memory endpoints, RAG integration
- `backend/requirements.txt` - Added chromadb dependency
- `docs/API.md` - Documented all new endpoints

### For Lovable: Frontend Tasks

Now that the backend memory system is ready, Lovable should:

1. **Add a Notes tab/section in the sidebar:**
   - List notes from `GET /notes`
   - Create new notes with `POST /notes`
   - Edit/delete notes

2. **Show memory usage in chat:**
   - Display `memory_used` from chat responses
   - Show which notes/memories were used for context

3. **Add a search feature:**
   - Use `POST /memory/search` for semantic search
   - Show search results in a modal or sidebar

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
