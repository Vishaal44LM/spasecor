
-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Security definer: current user's organization id (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Profiles policies
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_org_read" ON public.profiles FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Organizations policies
CREATE POLICY "orgs_member_read" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "orgs_insert_any" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orgs_member_update" ON public.organizations FOR UPDATE TO authenticated USING (id = public.current_org_id()) WITH CHECK (id = public.current_org_id());

-- New user trigger: create profile + organization from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  full_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization', 'My Organization');
  full_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  INSERT INTO public.organizations (name) VALUES (org_name) RETURNING id INTO org_id;
  INSERT INTO public.profiles (id, name, email, organization_id) VALUES (NEW.id, full_name, NEW.email, org_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enums
CREATE TYPE public.asset_type AS ENUM ('satellite','ground_station','communication_system','mission_control_system','payload_system','navigation_system','other');
CREATE TYPE public.asset_status AS ENUM ('operational','degraded','offline','decommissioned','planned');
CREATE TYPE public.incident_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.incident_status AS ENUM ('open','assigned','investigating','mitigation_in_progress','resolved','closed');

-- Space assets
CREATE TABLE public.space_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type public.asset_type NOT NULL,
  mission_name TEXT,
  orbit_type TEXT,
  operator TEXT,
  launch_date DATE,
  status public.asset_status NOT NULL DEFAULT 'operational',
  description TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_assets TO authenticated;
GRANT ALL ON public.space_assets TO service_role;
ALTER TABLE public.space_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_org_all" ON public.space_assets FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER space_assets_touch BEFORE UPDATE ON public.space_assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_assets_org ON public.space_assets(organization_id);

-- Custom threat categories
CREATE TABLE public.threat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threat_categories TO authenticated;
GRANT ALL ON public.threat_categories TO service_role;
ALTER TABLE public.threat_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_org_all" ON public.threat_categories FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- Incidents
CREATE SEQUENCE public.incident_number_seq START 1000;
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_number TEXT NOT NULL DEFAULT ('INC-' || nextval('public.incident_number_seq')),
  title TEXT NOT NULL,
  description TEXT,
  asset_id UUID REFERENCES public.space_assets(id) ON DELETE SET NULL,
  threat_category TEXT NOT NULL,
  priority public.incident_priority NOT NULL DEFAULT 'medium',
  status public.incident_status NOT NULL DEFAULT 'open',
  summary TEXT,
  resolution_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_org_all" ON public.incidents FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER incidents_touch BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_incidents_org ON public.incidents(organization_id);
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE UNIQUE INDEX idx_incidents_number ON public.incidents(incident_number);

-- Stage history
CREATE TABLE public.incident_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage public.incident_status NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  changed_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_stage_history TO authenticated;
GRANT ALL ON public.incident_stage_history TO service_role;
ALTER TABLE public.incident_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage_org_all" ON public.incident_stage_history FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_stage_incident ON public.incident_stage_history(incident_id);

-- Initialize stage on incident create + record transitions
CREATE OR REPLACE FUNCTION public.incident_init_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.incident_stage_history (incident_id, organization_id, stage, changed_by)
  VALUES (NEW.id, NEW.organization_id, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;
CREATE TRIGGER incidents_init_stage AFTER INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.incident_init_stage();

CREATE OR REPLACE FUNCTION public.incident_track_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    UPDATE public.incident_stage_history
       SET exited_at = now()
     WHERE incident_id = NEW.id AND exited_at IS NULL;
    INSERT INTO public.incident_stage_history (incident_id, organization_id, stage, changed_by)
    VALUES (NEW.id, NEW.organization_id, NEW.status, auth.uid());
    IF NEW.status = 'resolved' AND NEW.resolution_date IS NULL THEN
      NEW.resolution_date := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER incidents_track_stage BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.incident_track_stage();

-- Comments
CREATE TABLE public.incident_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_comments TO authenticated;
GRANT ALL ON public.incident_comments TO service_role;
ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_org_all" ON public.incident_comments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- Evidence
CREATE TABLE public.incident_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_evidence TO authenticated;
GRANT ALL ON public.incident_evidence TO service_role;
ALTER TABLE public.incident_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_org_all" ON public.incident_evidence FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- AI analyses
CREATE TABLE public.incident_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_ai_analyses TO authenticated;
GRANT ALL ON public.incident_ai_analyses TO service_role;
ALTER TABLE public.incident_ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_org_all" ON public.incident_ai_analyses FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- Reports
CREATE TABLE public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_reports TO authenticated;
GRANT ALL ON public.incident_reports TO service_role;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_org_all" ON public.incident_reports FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- Activity / Audit (combined; audit cannot be deleted)
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_org_read" ON public.activity_log FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "activity_org_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX idx_activity_org ON public.activity_log(organization_id, created_at DESC);
CREATE INDEX idx_activity_incident ON public.activity_log(incident_id);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_org_read" ON public.notifications FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "notif_org_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "notif_self_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_notif_user ON public.notifications(user_id, read, created_at DESC);

-- Storage bucket for evidence (created via tool below)
