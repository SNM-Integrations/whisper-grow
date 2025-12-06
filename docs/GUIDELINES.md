# Collaboration Guidelines

## How Claude Code and Lovable Work Together

This project is built by two AI agents collaborating via Git:
- **Claude Code** - Backend development (Python, FastAPI, database, LLM integration)
- **Lovable** - Frontend development (React, UI components, styling)

---

## Golden Rules

### 1. API Contract is Sacred
- The API contract in `docs/API.md` is the source of truth
- Backend implements the endpoints exactly as specified
- Frontend calls the endpoints exactly as specified
- **Any changes to the API must be documented first**

### 2. Don't Break Each Other
- Backend: Don't change response shapes without updating API.md
- Frontend: Don't assume endpoints exist until they're documented
- Both: Run tests before pushing

### 3. Document What You Do
- Update your task list when you complete something
- Add comments for non-obvious code
- Update CHANGELOG.md for significant changes

### 4. Small, Focused PRs
- One feature or fix per PR
- Clear PR title describing what it does
- Link to relevant task in the description

---

## Workflow

```
1. Check your task list (TASKS_BACKEND.md or TASKS_FRONTEND.md)
2. Pick a task
3. Create a branch: feature/task-name or fix/bug-name
4. Implement the feature
5. Test locally
6. Push and create PR
7. Claude Code Action reviews the PR
8. If approved → merge
9. If issues → fix and push again
10. Update task list (mark complete, add new tasks if discovered)
```

---

## Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/short-description` | `feature/add-notes-endpoint` |
| Bug fix | `fix/short-description` | `fix/chat-memory-leak` |
| Docs | `docs/short-description` | `docs/update-api-spec` |
| Refactor | `refactor/short-description` | `refactor/cleanup-database` |

---

## Commit Messages

Format: `type: short description`

Examples:
- `feat: add POST /notes endpoint`
- `fix: conversation memory not persisting`
- `docs: update API contract with notes endpoints`
- `refactor: extract database logic to separate module`

---

## File Ownership

| Path | Owner | Notes |
|------|-------|-------|
| `/backend/**` | Claude Code | Python brain service |
| `/src/**` | Lovable | React frontend |
| `/docs/**` | Both | Either can update docs |
| `/.github/**` | Claude Code | CI/CD workflows |
| `/supabase/**` | Neither | Legacy, being phased out |

---

## Communication via Git

Since we can't talk directly, we communicate through:

1. **Task lists** - What needs to be done
2. **PR descriptions** - What was done and why
3. **Code comments** - Context for tricky parts
4. **Docs updates** - Changes to contracts or plans

### Flagging Issues for the Other Agent

If you discover something the other agent needs to handle:

1. Add a task to their task list with `[BLOCKED]` or `[NEEDS: other-task]`
2. Create an issue on GitHub if it's complex
3. Add a `TODO(lovable):` or `TODO(claude):` comment in code

---

## Testing

### Backend (Claude Code)
- Run `pytest` before pushing
- Test all new endpoints manually with curl
- Verify Ollama/Gemma connection works

### Frontend (Lovable)
- Run `npm run build` - must pass
- Test in browser manually
- Verify API calls work against running backend

---

## When Stuck

1. Check if the other agent's work is merged
2. Re-read the API contract
3. Check the master plan for context
4. Add a detailed GitHub issue explaining the blocker
