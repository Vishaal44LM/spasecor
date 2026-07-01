# Spasecor — Quick fixes + Org-centric restructure + Branding

Good news: your data model is **already organization-centric**. Every table (`incidents`, `space_assets`, `mission_messages`, `mission_tasks`, `decisions`, `incident_evidence`, `activity_log`, `notifications`) already references `organization_id`, and every user's `profile` is bound to one org. All queries in the app already filter by `current_org_id()`, so all members of an org already see the same shared data in real time.

What's actually missing for a true enterprise workspace is **roles, permissions, and invitations**. That's the core of this plan, alongside the small UI/branding fixes.

---

## Part 1 — Quick UI fixes (small, direct)

1. **Contact email** → replace `spasecor@gmail.com` with `spasecor.in@gmail.com` on landing page.
2. **Settings page** → remove the entire "Security / Reset your password via email" card.
3. **Landing page buttons** → remove "Start free" from hero; keep only "Sign in" and "Create your organization" throughout.
4. **Sidebar collapse fix** → the sidebar shrinks to icon-rail but doesn't fully hide on click. Fix so clicking the collapse toggle fully collapses/expands as expected on desktop, and closes the sheet on mobile.
5. **Dark/Light mode toggle** — add a functional theme toggle in the top bar. Persist to `localStorage`, respect `prefers-color-scheme` on first load, apply `.dark` class to `<html>`. Design tokens in `src/styles.css` already have `.dark` variants — just wire the switch.

## Part 2 — Branding

1. **Favicon set** — generate from the existing logo: `favicon.ico` (16/32/48 multi-res), `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180), `android-chrome-192.png`, `android-chrome-512.png`. Reference all in `index.html`.
2. **`site.webmanifest`** — `name: "Spasecor"`, `short_name: "Spasecor"`, icons pointing to the PNGs above, theme color `#664EAE`.
3. **Browser tab title** — hard-set to exactly `Spasecor` everywhere. Remove per-route title suffixes (`— Spasecor`, `Sign in — Spasecor`, etc.) in `App.tsx`.
4. **Meta** — `<meta name="application-name" content="Spasecor">`, `<meta name="apple-mobile-web-app-title" content="Spasecor">`.

## Part 3 — Organization roles & RBAC

Add proper role-based access using a separate `user_roles` table (never on `profiles` — privilege-escalation risk).

**Migration:**

- `create type app_role as enum ('admin','mission_manager','security_analyst','satellite_engineer','viewer')`
- `create table user_roles (id, user_id, organization_id, role, unique(user_id, organization_id, role))` + GRANTs + RLS
- `has_role(_user, _role)` and `has_any_role(_user, roles[])` security-definer functions
- Update `handle_new_user()` trigger: first user in a newly-created org becomes `admin` automatically
- Tighten existing RLS policies on `incidents`, `mission_tasks`, `decisions`, `incident_evidence`, `space_assets`:
  - `SELECT`: any org member (already the case)
  - `INSERT/UPDATE`: `admin` or `mission_manager` (incidents, decisions closing); analysts can update assigned; engineers can upload evidence
  - `mission_tasks`: assignee can update own task status; managers/admins can edit anything
  - `DELETE`: admin only

**Frontend:**

- `useRole()` hook returning current user's roles in current org
- `<Can role="admin">` gate component + `usePermission('canCreateIncident')` helpers
- Hide/disable action buttons based on role (New Incident, Approve Decision, Delete, etc.) — no UI removed, just conditionally gated
- Task edit UI: assignee-only unless manager/admin

## Part 4 — Invitation system

- New table `organization_invitations (id, organization_id, email, role, token, invited_by, expires_at, accepted_at)` + GRANTs + RLS (admins of org can manage; anyone can read by token to accept)
- Settings → new **Members** tab (admins only):
  - List current members with role dropdown (admin can change)
  - "Invite member" form: email + role → generates token, stores row, shows shareable invite link `/invite/<token>` (email delivery via Resend can be layered later — out of scope for this pass unless you say otherwise)
  - Remove member (admin only)
- New public route `/invite/:token`:
  - If logged out → auth page with invite context, on signup joins that org instead of creating a new one
  - If logged in → "Accept invitation to join <Org>" button; sets `profiles.organization_id` + creates `user_roles` row
- Update `handle_new_user()` to check for a pending invite token in `raw_user_meta_data` and join that org instead of spinning up a new one

## Part 5 — Real-time (light polish)

Data is already shared per-org. Add Supabase Realtime subscriptions on the pages that would benefit most:
- Dashboard active incidents count
- Board (Kanban) — new incidents pop in
- Activity feed
- Notifications bell

Mission Room already uses realtime. Everything else uses TanStack Query, so we'll add `postgres_changes` listeners that invalidate the relevant queries.

---

## Technical notes

- No UI redesign, no page removals, no style changes — only additive (theme toggle, Members tab, invite route) and gating (role checks on existing buttons).
- All existing data stays intact. Existing users become `admin` of their existing org via a one-time backfill in the migration.
- Vercel-compatible: pure client + Supabase, no new serverless functions needed.

## Files touched (approx)

- **New:** `src/lib/theme.tsx`, `src/components/theme-toggle.tsx`, `src/hooks/use-role.ts`, `src/components/can.tsx`, `src/routes/invite.tsx`, `src/routes/_authenticated/members.tsx`, `public/favicon-*.png`, `public/apple-touch-icon.png`, `public/android-chrome-*.png`, `public/site.webmanifest`
- **Edited:** `index.html`, `src/App.tsx`, `src/routes/index.tsx`, `src/routes/_authenticated/settings.tsx`, `src/routes/_authenticated/route.tsx`, `src/components/app-sidebar.tsx`, `src/routes/auth.tsx`, plus role-gate touches on incidents/decisions/evidence/tasks pages
- **Migration:** roles enum + tables + RLS updates + invite table + updated `handle_new_user` + admin backfill

Approve and I'll ship it in one pass.
