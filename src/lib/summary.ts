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
  if (!sessionData.session) throw new Error("Please sign in before generating summary.");

  const { data, error } = await supabase.functions.invoke("summarize-incident", {
    body: { incidentId },
  });
  if (error) {
    const msg = (data as any)?.error || error.message || "Summary generation failed";
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).summary as IncidentSummary;
}
