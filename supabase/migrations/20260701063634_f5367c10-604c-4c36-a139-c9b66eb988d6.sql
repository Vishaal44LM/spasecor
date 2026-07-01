
-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','mission_manager','security_analyst','satellite_engineer','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role_in_org(_org UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND organization_id = _org AND role = _role)
$$;

-- Policies on user_roles
DROP POLICY IF EXISTS "org members can read roles" ON public.user_roles;
CREATE POLICY "org members can read roles" ON public.user_roles FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.current_user_has_role_in_org(organization_id, 'admin'))
WITH CHECK (public.current_user_has_role_in_org(organization_id, 'admin'));

-- Invitations
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT SELECT ON public.organization_invitations TO anon;
GRANT ALL ON public.organization_invitations TO service_role;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read invites" ON public.organization_invitations;
CREATE POLICY "org members read invites" ON public.organization_invitations FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "anon can read by token" ON public.organization_invitations;
CREATE POLICY "anon can read by token" ON public.organization_invitations FOR SELECT TO anon
USING (accepted_at IS NULL AND expires_at > now());

DROP POLICY IF EXISTS "admins manage invites" ON public.organization_invitations;
CREATE POLICY "admins manage invites" ON public.organization_invitations FOR ALL TO authenticated
USING (public.current_user_has_role_in_org(organization_id, 'admin'))
WITH CHECK (public.current_user_has_role_in_org(organization_id, 'admin'));

-- Accept invite RPC (security definer). Sets caller's org to inviter's org and grants the invited role.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.organization_invitations%ROWTYPE;
  uid UUID := auth.uid();
  user_email TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO inv FROM public.organization_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation already accepted'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'invitation expired'; END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  IF lower(user_email) <> lower(inv.email) THEN
    RAISE EXCEPTION 'invitation email does not match your account';
  END IF;

  UPDATE public.profiles SET organization_id = inv.organization_id WHERE id = uid;
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (uid, inv.organization_id, inv.role)
  ON CONFLICT (user_id, organization_id, role) DO NOTHING;
  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.organization_id;
END $$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- Update handle_new_user: honor pending invite in metadata; otherwise create org and make user admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  full_name TEXT;
  invite_token TEXT;
  inv public.organization_invitations%ROWTYPE;
BEGIN
  full_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF invite_token IS NOT NULL AND invite_token <> '' THEN
    SELECT * INTO inv FROM public.organization_invitations WHERE token = invite_token;
    IF FOUND AND inv.accepted_at IS NULL AND inv.expires_at > now()
       AND lower(inv.email) = lower(NEW.email) THEN
      INSERT INTO public.profiles (id, name, email, organization_id)
      VALUES (NEW.id, full_name, NEW.email, inv.organization_id);
      INSERT INTO public.user_roles (user_id, organization_id, role)
      VALUES (NEW.id, inv.organization_id, inv.role)
      ON CONFLICT DO NOTHING;
      UPDATE public.organization_invitations SET accepted_at = now() WHERE id = inv.id;
      RETURN NEW;
    END IF;
  END IF;

  org_name := COALESCE(NEW.raw_user_meta_data->>'organization', 'My Organization');
  INSERT INTO public.organizations (name) VALUES (org_name) RETURNING id INTO org_id;
  INSERT INTO public.profiles (id, name, email, organization_id) VALUES (NEW.id, full_name, NEW.email, org_id);
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (NEW.id, org_id, 'admin');
  RETURN NEW;
END $$;

-- Backfill: every existing profile-owner becomes admin of their org (idempotent).
INSERT INTO public.user_roles (user_id, organization_id, role)
SELECT p.id, p.organization_id, 'admin'::public.app_role
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

-- updated_at column for invitations
CREATE TRIGGER trg_org_invites_touch BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
