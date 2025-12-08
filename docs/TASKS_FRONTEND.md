# Frontend Tasks (Lovable)

> Owner: Lovable
> Last updated: 2025-01-08

## STATUS: Cloud Migration Complete ✅

The frontend has been migrated to Lovable Cloud (Supabase). The localhost Python backend is no longer required.

---

## Current Sprint: Cloud Integration Polish

### Completed in Cloud Migration (v0.5.0)

- [x] Created Supabase tables for CRM (contacts, companies, deals)
- [x] Created Supabase tables for chat (conversations, messages)
- [x] Created `chat` edge function using Lovable AI
- [x] Created `src/lib/supabase-api.ts` - cloud API layer
- [x] Added authentication (AuthForm + useAuth hook)
- [x] Updated Index.tsx to use streaming AI chat
- [x] Enabled auto-confirm email for easy testing

### To Do (For Claude Code)

#### Priority 1: Wire Existing Components to Cloud

1. **NotesPanel.tsx**
   - Currently imports from `@/lib/api` (localhost)
   - Need to change to `@/lib/supabase-api`
   - Notes table already exists in Supabase

2. **SearchPanel.tsx**
   - Currently calls localhost for semantic search
   - Options:
     - Create a search edge function, OR
     - Use Supabase full-text search on notes

3. **CRM Components** (currently use mock data)
   - `ContactsList.tsx` → use `fetchContacts()` from supabase-api
   - `DealsPipeline.tsx` → use `fetchDeals()` from supabase-api
   - `CompaniesList.tsx` → use `fetchCompanies()` from supabase-api

#### Priority 2: Cleanup

- [ ] Remove `backend/` folder (not needed for cloud)
- [ ] Remove `src/lib/api.ts` (replaced by supabase-api.ts)
- [ ] Update MASTER_PLAN.md to reflect cloud architecture

#### Priority 3: Polish

- [ ] Markdown rendering in AI responses
- [ ] Mobile responsive design improvements
- [ ] Error handling improvements

---

## Cloud Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)                                │
│  - src/lib/supabase-api.ts for all data operations     │
│  - Uses Supabase client for auth & database            │
│  - Calls edge functions for AI chat                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LOVABLE CLOUD (Supabase)                               │
│  - PostgreSQL database with RLS                        │
│  - Edge Functions for AI (chat)                        │
│  - Auth with auto-confirm email                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LOVABLE AI GATEWAY                                     │
│  - google/gemini-2.5-flash (default)                   │
│  - No API key required (managed by Lovable)            │
└─────────────────────────────────────────────────────────┘
```

---

## Database Tables

| Table | Status | Notes |
|-------|--------|-------|
| `notes` | ✅ Pre-existing | Has RLS |
| `tasks` | ✅ Pre-existing | Has RLS |
| `calendar_events` | ✅ Pre-existing | Has RLS |
| `conversations` | ✅ Created in v0.5.0 | For chat history |
| `messages` | ✅ Created in v0.5.0 | For chat messages |
| `contacts` | ✅ Created in v0.5.0 | CRM contacts |
| `companies` | ✅ Created in v0.5.0 | CRM companies |
| `deals` | ✅ Created in v0.5.0 | CRM deals |

---

## Edge Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `chat` | AI streaming chat via Lovable AI | JWT required |

---

## API Layer

**OLD (localhost):** `src/lib/api.ts` - DO NOT USE

**NEW (cloud):** `src/lib/supabase-api.ts` - USE THIS

Functions available:
- Notes: `fetchNotes()`, `createNote()`, `updateNote()`, `deleteNote()`
- Conversations: `fetchConversations()`, `createConversation()`, `deleteConversation()`
- Messages: `fetchMessages()`, `saveMessage()`
- Contacts: `fetchContacts()`, `createContact()`, `updateContact()`, `deleteContact()`
- Companies: `fetchCompanies()`, `createCompany()`, `updateCompany()`, `deleteCompany()`
- Deals: `fetchDeals()`, `createDeal()`, `updateDeal()`, `deleteDeal()`
- Chat: `streamChat()` - streaming AI responses
