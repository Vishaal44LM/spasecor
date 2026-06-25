import { supabase } from "@/integrations/supabase/client";

type AnalysisInput = { incidentId: string };

export async function analyzeIncident(data: AnalysisInput) {
  if (!data.incidentId) throw new Error("incidentId required");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in before running AI analysis.");

  const res = await fetch("/api/analyze-incident", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "AI analysis failed");
  return json as { id: string | null; payload: unknown };
}
