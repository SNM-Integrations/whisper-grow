# Frontend Tasks (Lovable)

> Owner: Lovable
> Last updated: 2025-12-08

## STATUS: Organization System Complete ✅

The frontend has full organization/workspace support with role-based access control and resource sharing.

---

## Completed Features

### v0.7.0 - Organization Polish
- [x] Pending invitations UI (accept/decline)
- [x] Task visibility/sharing with organizations
- [x] AI chat tool improvements (relationship types for contacts)
- [x] Shared badge on organization-visible tasks

### v0.6.0 - Organization System
- [x] Multi-tenant organization/workspace support
- [x] Role-based access control (owner/admin/member)
- [x] Organization switcher in header
- [x] Organization settings page (member management)
- [x] Visibility selector for resources
- [x] RLS policies for org-level access

### v0.5.0 - Cloud Migration
- [x] Supabase tables for CRM and chat
- [x] Chat edge function with AI tool calling
- [x] Authentication with auto-confirm email
- [x] Streaming AI responses

---

## To Do

### Priority 1: Extend Visibility to All Resources

Currently only Tasks have full visibility support. Need to add to:

1. **Calendar Events**
   - Add VisibilitySelector to CalendarEventDialog
   - Show shared indicator on events

2. **Notes**
   - Add VisibilitySelector to NoteEditor
   - Show shared indicator in NotesPanel

3. **CRM (Contacts, Companies, Deals)**
   - Add VisibilitySelector to all CRM dialogs
   - Show shared indicators in lists

### Priority 2: AI Tool Enhancements

1. **Add visibility to AI tools**
   - `create_task` should accept visibility parameter
   - `create_calendar_event` should accept visibility parameter
   - Allow AI to create org-shared resources

2. **Add search/query tools**
   - `search_contacts` - Find contacts by name/company
   - `search_deals` - Find deals by stage/value
   - `get_contacts` - List contacts

### Priority 3: Polish

- [ ] Markdown rendering in AI responses
- [ ] Typing indicator in chat
- [ ] Copy button on AI messages
- [ ] Mobile responsive improvements
- [ ] Email notifications for invitations (needs Resend API)

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
