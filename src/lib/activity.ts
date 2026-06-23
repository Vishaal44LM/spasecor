import { supabase } from "@/integrations/supabase/client";

export async function logActivity(params: {
  organizationId: string;
  incidentId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("activity_log").insert({
    organization_id: params.organizationId,
    incident_id: params.incidentId ?? null,
    user_id: u.user?.id ?? null,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    details: (params.details ?? null) as never,
  });
}

export async function notify(params: {
  organizationId: string;
  userId?: string | null;
  type: string;
  title: string;
  message?: string;
  link?: string;
}) {
  await supabase.from("notifications").insert({
    organization_id: params.organizationId,
    user_id: params.userId ?? null,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    link: params.link ?? null,
  });
}
