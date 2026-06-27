import { supabase } from "@/integrations/supabase/client";

export type IncidentSummary = {
  executive: string;
  timeline: string;
  investigation: string;
  collaboration: string;
  documents: string;
  tasks: string;
  closure: string;
};

export async function summarizeIncident(incidentId: string): Promise<IncidentSummary> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in before generating summary.");

  const res = await fetch("/api/summarize-incident", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ incidentId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Summary generation failed");
  return json.summary as IncidentSummary;
}
