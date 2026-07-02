import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "AI is not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { incidentId } = await req.json();
    if (!incidentId) return new Response(JSON.stringify({ error: "incidentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: incident, error } = await supabase
      .from("incidents")
      .select("*, space_assets(name, asset_type, mission_name, orbit_type)")
      .eq("id", incidentId)
      .single();
    if (error || !incident) return new Response(JSON.stringify({ error: "Incident not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const asset: any = (incident as any).space_assets;

    const prompt = `You are a senior space cybersecurity analyst. Analyze this incident and respond ONLY with strict JSON matching the schema. Be specific, technical and concise.

Incident:
Title: ${(incident as any).title}
Threat Category: ${(incident as any).threat_category}
Priority: ${(incident as any).priority}
Description: ${(incident as any).description ?? "(none)"}
Asset: ${asset?.name ?? "unknown"} (${asset?.asset_type ?? ""}) Mission: ${asset?.mission_name ?? "-"} Orbit: ${asset?.orbit_type ?? "-"}

Schema:
{
  "threat_analysis": {"likely_threat_type": string, "threat_severity": "low"|"medium"|"high"|"critical", "possible_attack_method": string, "technical_summary": string},
  "attack_scenario": string[],
  "mission_impact": {"communications": string, "navigation": string, "payload_operations": string, "telemetry": string, "ground_segment": string, "mission_availability": string},
  "risk_assessment": {"likelihood": "low"|"medium"|"high", "impact": "low"|"medium"|"high"|"critical", "severity": "low"|"medium"|"high"|"critical", "overall_risk": string},
  "mitigation": {"immediate": string[], "short_term": string[], "long_term": string[]},
  "executive_summary": string
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a space cybersecurity expert. Return strict JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "AI rate limit reached. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI error: ${text}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(content); } catch { payload = { raw: content }; }

    const { data: saved, error: saveError } = await supabase
      .from("incident_ai_analyses")
      .insert({
        incident_id: incidentId,
        organization_id: (incident as any).organization_id,
        payload: payload as never,
        created_by: userData.user.id,
      } as never)
      .select()
      .single();

    if (saveError) return new Response(JSON.stringify({ error: saveError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("activity_log").insert({
      organization_id: (incident as any).organization_id,
      incident_id: incidentId,
      user_id: userData.user.id,
      action: "AI analysis executed",
      entity_type: "ai_analysis",
      entity_id: (saved as any)?.id,
    } as never);

    return new Response(JSON.stringify({ id: (saved as any)?.id ?? null, payload }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
