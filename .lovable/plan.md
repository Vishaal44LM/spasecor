
# Spasecor Enterprise Modules — Revised Plan

Scope locked: **4 modules, no voice, no role assignment in Mission Room**. Members visible in Mission Room are simply the users already assigned to the incident (existing assignment flow); their existing profile/designation is shown read-only.

## Module 1 — Mission Room (per incident)
- Auto-created on incident creation (virtual — no separate row; derived from incident).
- 3-column layout: Left (Members read-only, Files, Notes) · Center (Chat) · Right (Tasks, Activity Timeline).
- **Real-time chat**: messages, typing indicator, read receipts, emoji reactions, threaded replies, search, pin, timestamps.
- **File sharing**: upload PDFs/images/CSV/JSON/logs → also written into Evidence Vault automatically.
- **Shared notes**: create/edit/pin (any assigned member; no role gating).
- **Task panel**: synced with incident tasks (title, priority, status, due date).
- **Activity timeline**: joins, file uploads, notes, tasks, incident updates.
- **Notifications**: new message, file uploaded, task assigned, note pinned, priority changed.

## Module 2 — AI Incident Intelligence Summarizer
- "Generate Incident Summary" button on incident detail.
- Edge function `summarize-incident` via Lovable AI (`google/gemini-3-flash-preview`), structured output with 7 sections: Executive, Timeline, Investigation, Collaboration (chat), Documents, Tasks, Closure.
- Export: PDF (jsPDF), DOCX (docx lib), Markdown, Copy.
- Strict prompt: summarize only — never recommend, predict, or invent.

## Module 3 — Decision Intelligence Log
- Global `/decisions` + per-incident tab.
- Fields: title, description, category, incident, decision maker, team, timestamp, evidence links, chat links, approval status.
- Categories: Threat Confirmation, Mission Impact, Escalation, Resource Allocation, Mitigation, Recovery, Closure, Other.
- Workflow: Create → Attach Evidence → Peer Review → Approve → Lock (immutable after approval).
- Status: Pending / Approved / Rejected / Needs Review.
- Search/filter by incident, date, decision maker, category, status.
- Export: PDF history report.

## Module 4 — Digital Evidence Vault
- Global `/evidence` + per-incident tab.
- Upload any file type; auto SHA-256 hash (client-side via WebCrypto).
- Metadata: name, uploader, time, incident, category, tags, description.
- Categories: Telemetry, Commands, Authentication, Communications, Payload, Ground Station, Network, Other.
- Preview: images, PDFs (iframe), CSV/logs (text).
- Version history: re-upload creates new version; old versions retained and downloadable.
- Search/filter by date, incident, category, tags, name, uploader.
- "Export investigation package" → ZIP of all evidence + manifest JSON (jszip).

## Landing Page
- Add contact section with `spasecor@gmail.com`.

## Technical
- **One migration**: tables `mission_messages`, `message_reactions`, `message_reads`, `mission_notes`, `mission_tasks`, `decisions`, `decision_evidence_links`, `decision_chat_links`; extend `incident_evidence` with `sha256`, `version`, `parent_id`, `category`, `tags`, `description`. RLS scoped to current org; realtime enabled on chat/notes/tasks/activity/notifications.
- **New deps**: `jszip`, `docx`.
- **Edge function**: `summarize-incident`.
- **No new routes hidden** — all linked from incident detail + sidebar.

Building now.
