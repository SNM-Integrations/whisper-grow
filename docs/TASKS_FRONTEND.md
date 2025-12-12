# Frontend Tasks (Lovable)

> Owner: Lovable
> Last updated: 2025-12-12

## STATUS: Full-Featured Second Brain ✅

The frontend is a complete productivity platform with chat, CRM, projects, calendar, tasks, and notes.

---

## Completed Features

### v0.8.0 - Projects, Calendar Sync & Task Delegation
- [x] Projects module with list/detail views
- [x] Project documents (rich text and file uploads)
- [x] Link tasks and calendar events to projects
- [x] Inline task/event creation from project detail
- [x] Click-to-create events on calendar time slots
- [x] "Refresh Calendar" syncs from Google Calendar via n8n
- [x] Task "Responsible Party" field for CRM contact assignment
- [x] OwnerSelector workflow for unified ownership selection
- [x] CRM type distinctions (Contact/Lead, Client/Company Lead)
- [x] n8n MCP integration (email, calendar, web search)
- [x] RLS fix for organization member cross-access

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

### Priority 1: Polish & UX

- [ ] Markdown rendering in AI responses
- [ ] Typing indicator in chat
- [ ] Copy button on AI messages
- [ ] Mobile responsive improvements
- [ ] Dark theme refinement

### Priority 2: Dynamic CRM Fields (Planned)

- [ ] Add `custom_fields JSONB` to contacts and companies tables
- [ ] AI tools to update custom fields dynamically
- [ ] Render custom fields on CRM cards
- [ ] Manual add/edit custom fields in dialogs

### Priority 3: Integrations

- [ ] Email notifications for invitations (needs Resend API)
- [ ] Push calendar events to Google Calendar via n8n
- [ ] File browser integration
- [ ] Activity logs / audit trail

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
| `notes` | ✅ Pre-existing | Has RLS, org visibility |
| `tasks` | ✅ Pre-existing | Has RLS, org visibility, assigned_to |
| `calendar_events` | ✅ Pre-existing | Has RLS, org visibility, project_id |
| `conversations` | ✅ Created in v0.5.0 | For chat history |
| `messages` | ✅ Created in v0.5.0 | For chat messages |
| `contacts` | ✅ Created in v0.5.0 | CRM contacts, contact_type enum |
| `companies` | ✅ Created in v0.5.0 | CRM companies, company_type enum |
| `deals` | ✅ Created in v0.5.0 | CRM deals with pipeline stages |
| `projects` | ✅ Created in v0.8.0 | Project management |
| `project_documents` | ✅ Created in v0.8.0 | Documents within projects |
| `organizations` | ✅ Created in v0.6.0 | Multi-tenant orgs |
| `organization_members` | ✅ Created in v0.6.0 | Org membership with roles |
| `organization_invitations` | ✅ Created in v0.6.0 | Pending invitations |

---

## Edge Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `chat` | AI streaming chat with tool calling | JWT required |
| `sync-google-calendar` | Sync events from Google Calendar via n8n | JWT required |

---

## API Layer

**Cloud API:** `src/lib/supabase-api.ts`

Functions available:
- Notes: `fetchNotes()`, `createNote()`, `updateNote()`, `deleteNote()`
- Conversations: `fetchConversations()`, `createConversation()`, `deleteConversation()`
- Messages: `fetchMessages()`, `saveMessage()`
- Contacts: `fetchContacts()`, `createContact()`, `updateContact()`, `deleteContact()`
- Companies: `fetchCompanies()`, `createCompany()`, `updateCompany()`, `deleteCompany()`
- Deals: `fetchDeals()`, `createDeal()`, `updateDeal()`, `deleteDeal()`
- Projects: `fetchProjects()`, `createProject()`, `updateProject()`, `deleteProject()`
- Chat: `streamChat()` - streaming AI responses with tool calling

---

## External Integrations

### n8n MCP Connection
- Gmail: `send_email`
- Google Calendar: `get_google_calendar_events`, `check_availability`, `book_meeting`
- Web Search: `search`

Connected via Lovable MCP integration for AI tool calling.
