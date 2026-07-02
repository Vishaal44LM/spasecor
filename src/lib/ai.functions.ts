import { supabase } from "@/integrations/supabase/client";

type AnalysisInput = { incidentId: string };

export async function analyzeIncident(data: AnalysisInput) {
  if (!data.incidentId) throw new Error("incidentId required");
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Please sign in before running AI analysis.");

  const { data: res, error } = await supabase.functions.invoke("analyze-incident", {
    body: data,
  });
  if (error) {
    const msg = (res as any)?.error || error.message || "AI analysis failed";
    throw new Error(msg);
  }
  if ((res as any)?.error) throw new Error((res as any).error);
  return res as { id: string | null; payload: unknown };
}
