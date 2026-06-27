import { supabase } from "@/integrations/supabase/client";
import { sha256Hex } from "@/lib/sha256";

export const EVIDENCE_CATEGORIES = [
  "Telemetry",
  "Commands",
  "Authentication",
  "Communications",
  "Payload",
  "Ground Station",
  "Network",
  "Other",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export type UploadEvidenceParams = {
  file: File;
  incidentId: string;
  organizationId: string;
  category?: string;
  tags?: string[];
  description?: string;
  source?: string;
  parentId?: string | null;
};

export async function uploadEvidence(p: UploadEvidenceParams) {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Not signed in");

  const hash = await sha256Hex(p.file);
  const safeName = p.file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `${p.organizationId}/${p.incidentId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("evidence")
    .upload(path, p.file, { contentType: p.file.type, upsert: false });
  if (upErr) throw upErr;

  let version = 1;
  if (p.parentId) {
    const { data: siblings } = await supabase
      .from("incident_evidence")
      .select("version")
      .or(`id.eq.${p.parentId},parent_id.eq.${p.parentId}`)
      .order("version", { ascending: false })
      .limit(1);
    version = (siblings?.[0]?.version ?? 1) + 1;
  }

  const { data, error } = await supabase
    .from("incident_evidence")
    .insert({
      incident_id: p.incidentId,
      organization_id: p.organizationId,
      file_name: p.file.name,
      file_path: path,
      mime_type: p.file.type || null,
      file_size: p.file.size,
      uploaded_by: userId,
      sha256: hash,
      version,
      parent_id: p.parentId ?? null,
      category: p.category ?? null,
      tags: p.tags ?? [],
      description: p.description ?? null,
      source: p.source ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function evidenceSignedUrl(path: string, expires = 3600) {
  const { data, error } = await supabase.storage
    .from("evidence")
    .createSignedUrl(path, expires);
  if (error) throw error;
  return data.signedUrl;
}

export async function evidenceDownload(path: string) {
  const { data, error } = await supabase.storage.from("evidence").download(path);
  if (error) throw error;
  return data;
}
