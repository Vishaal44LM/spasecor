
-- Mission messages (chat)
CREATE TABLE public.mission_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES public.mission_messages(id) ON DELETE CASCADE,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  pinned BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mission_messages_incident_idx ON public.mission_messages(incident_id, created_at);
CREATE INDEX mission_messages_parent_idx ON public.mission_messages(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_messages TO authenticated;
GRANT ALL ON public.mission_messages TO service_role;
ALTER TABLE public.mission_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read messages" ON public.mission_messages FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "Org members insert messages" ON public.mission_messages FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());
CREATE POLICY "Authors update own message" ON public.mission_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authors delete own message" ON public.mission_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Read receipts
CREATE TABLE public.message_reads (
  message_id UUID NOT NULL REFERENCES public.mission_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read receipts visible to org" ON public.message_reads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mission_messages m WHERE m.id = message_id AND m.organization_id = public.current_org_id()));
CREATE POLICY "Users add own read receipt" ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Mission notes
CREATE TABLE public.mission_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT,
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mission_notes_incident_idx ON public.mission_notes(incident_id, pinned DESC, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_notes TO authenticated;
GRANT ALL ON public.mission_notes TO service_role;
ALTER TABLE public.mission_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read notes" ON public.mission_notes FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "Org members insert notes" ON public.mission_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());
CREATE POLICY "Org members update notes" ON public.mission_notes FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "Authors delete own note" ON public.mission_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER mission_notes_updated BEFORE UPDATE ON public.mission_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Mission tasks
CREATE TABLE public.mission_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mission_tasks_incident_idx ON public.mission_tasks(incident_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_tasks TO authenticated;
GRANT ALL ON public.mission_tasks TO service_role;
ALTER TABLE public.mission_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read tasks" ON public.mission_tasks FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "Org members write tasks" ON public.mission_tasks FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "Org members update tasks" ON public.mission_tasks FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "Org members delete tasks" ON public.mission_tasks FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id());
CREATE TRIGGER mission_tasks_updated BEFORE UPDATE ON public.mission_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Decisions
CREATE TABLE public.decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  decision_maker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX decisions_org_idx ON public.decisions(organization_id, created_at DESC);
CREATE INDEX decisions_incident_idx ON public.decisions(incident_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read decisions" ON public.decisions FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "Org members create decisions" ON public.decisions FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "Org members update unlocked decisions" ON public.decisions FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND locked = false)
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "Org members delete unlocked decisions" ON public.decisions FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND locked = false);
CREATE TRIGGER decisions_updated BEFORE UPDATE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Decision links
CREATE TABLE public.decision_evidence_links (
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES public.incident_evidence(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, evidence_id)
);
GRANT SELECT, INSERT, DELETE ON public.decision_evidence_links TO authenticated;
GRANT ALL ON public.decision_evidence_links TO service_role;
ALTER TABLE public.decision_evidence_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage evidence links" ON public.decision_evidence_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decisions d WHERE d.id = decision_id AND d.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.decisions d WHERE d.id = decision_id AND d.organization_id = public.current_org_id()));

CREATE TABLE public.decision_chat_links (
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.mission_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, message_id)
);
GRANT SELECT, INSERT, DELETE ON public.decision_chat_links TO authenticated;
GRANT ALL ON public.decision_chat_links TO service_role;
ALTER TABLE public.decision_chat_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage chat links" ON public.decision_chat_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decisions d WHERE d.id = decision_id AND d.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.decisions d WHERE d.id = decision_id AND d.organization_id = public.current_org_id()));

-- Extend incident_evidence
ALTER TABLE public.incident_evidence
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.incident_evidence(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS incident_evidence_parent_idx ON public.incident_evidence(parent_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.decisions;
