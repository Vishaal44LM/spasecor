import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AnalysisInput = { incidentId: string };

export const analyzeIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AnalysisInput) => {
    if (!d?.incidentId) throw new Error("incidentId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const { data: incident, error } = await supabase
      .from("incidents")
      .select("*, space_assets(name, asset_type, mission_name, orbit_type)")
      .eq("id", data.incidentId)
      .single();
    if (error || !incident) throw new Error("Incident not found");

    const asset = incident.space_assets as {
      name?: string;
      asset_type?: string;
      mission_name?: string;
      orbit_type?: string;
    } | null;

    const prompt = `You are a senior space cybersecurity analyst. Analyze this incident and respond ONLY with strict JSON matching the schema. Be specific, technical and concise.

Incident:
Title: ${incident.title}
Threat Category: ${incident.threat_category}
Priority: ${incident.priority}
Description: ${incident.description ?? "(none)"}
Asset: ${asset?.name ?? "unknown"} (${asset?.asset_type ?? ""}) Mission: ${asset?.mission_name ?? "-"} Orbit: ${asset?.orbit_type ?? "-"}

Schema:
{
  "threat_analysis": {
    "likely_threat_type": string,
    "threat_severity": "low"|"medium"|"high"|"critical",
    "possible_attack_method": string,
    "technical_summary": string
  },
  "attack_scenario": string[],
  "mission_impact": {
    "communications": string,
    "navigation": string,
    "payload_operations": string,
    "telemetry": string,
    "ground_segment": string,
    "mission_availability": string
  },
  "risk_assessment": {
    "likelihood": "low"|"medium"|"high",
    "impact": "low"|"medium"|"high"|"critical",
    "severity": "low"|"medium"|"high"|"critical",
    "overall_risk": string
  },
  "mitigation": {
    "immediate": string[],
    "short_term": string[],
    "long_term": string[]
  },
  "executive_summary": string
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a space cybersecurity expert. Return strict JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
      throw new Error(`AI error: ${text}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(content) as Record<string, unknown>;
    } catch {
      payload = { raw: content };
    }

    const { data: saved } = await supabase
      .from("incident_ai_analyses")
      .insert({
        incident_id: data.incidentId,
        organization_id: incident.organization_id,
        payload: payload as never,
        created_by: userId,
      })
      .select()
      .single();

    await supabase.from("activity_log").insert({
      organization_id: incident.organization_id,
      incident_id: data.incidentId,
      user_id: userId,
      action: "AI analysis executed",
      entity_type: "ai_analysis",
      entity_id: saved?.id,
    });

    return { id: saved?.id ?? null, payload: JSON.stringify(payload) };
  });
