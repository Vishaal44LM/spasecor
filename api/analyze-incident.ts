import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({
        error:
          "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel.",
      });
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "AI is not configured" });

    const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const { incidentId } = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (!incidentId) return res.status(400).json({ error: "incidentId required" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Invalid session" });

    const { data: incident, error } = await supabase
      .from("incidents")
      .select("*, space_assets(name, asset_type, mission_name, orbit_type)")
      .eq("id", incidentId)
      .single();
    if (error || !incident) return res.status(404).json({ error: "Incident not found" });

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

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) return res.status(429).json({ error: "AI rate limit reached. Try again shortly." });
      if (aiRes.status === 402) return res.status(402).json({ error: "AI credits exhausted. Add credits to continue." });
      return res.status(502).json({ error: `AI error: ${text}` });
    }

    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(content) as Record<string, unknown>;
    } catch {
      payload = { raw: content };
    }

    const { data: saved, error: saveError } = await supabase
      .from("incident_ai_analyses")
      .insert({
        incident_id: incidentId,
        organization_id: incident.organization_id,
        payload: payload as never,
        created_by: userData.user.id,
      } as never)
      .select()
      .single();

    if (saveError) return res.status(500).json({ error: saveError.message });

    await supabase.from("activity_log").insert({
      organization_id: incident.organization_id,
      incident_id: incidentId,
      user_id: userData.user.id,
      action: "AI analysis executed",
      entity_type: "ai_analysis",
      entity_id: saved?.id,
    } as never);

    return res.status(200).json({ id: saved?.id ?? null, payload });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  }
}