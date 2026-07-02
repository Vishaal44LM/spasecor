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

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { incidentId } = await req.json();
    if (!incidentId) return new Response(JSON.stringify({ error: "incidentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [incidentRes, commentsRes, evidenceRes, activityRes, stageRes, messagesRes, notesRes, tasksRes] = await Promise.all([
      supabase.from("incidents").select("*, space_assets(name, asset_type, mission_name, orbit_type)").eq("id", incidentId).single(),
      supabase.from("incident_comments").select("body, kind, created_at").eq("incident_id", incidentId).order("created_at"),
      supabase.from("incident_evidence").select("file_name, category, description, created_at, version").eq("incident_id", incidentId).order("created_at"),
      supabase.from("activity_log").select("action, created_at").eq("incident_id", incidentId).order("created_at"),
      supabase.from("incident_stage_history").select("stage, entered_at, exited_at").eq("incident_id", incidentId).order("entered_at"),
      supabase.from("mission_messages").select("body, created_at").eq("incident_id", incidentId).order("created_at"),
      supabase.from("mission_notes").select("title, body, pinned, created_at").eq("incident_id", incidentId).order("created_at"),
      supabase.from("mission_tasks").select("title, status, priority, due_date, completed_at").eq("incident_id", incidentId).order("created_at"),
    ]);

    const incident: any = incidentRes.data;
    if (!incident) return new Response(JSON.stringify({ error: "Incident not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const asset = incident.space_assets;

    const sys = `You are an analyst writing summaries for the Spasecor space cybersecurity platform.
RULES:
- Summarize only the verified information provided.
- Never recommend mitigation, predict attacks, change status, invent or guess information.
- Be concise, factual and professional. If a section has no data, write "No data available."
- Return ONLY valid JSON matching the schema. No markdown, no commentary.`;

    const prompt = `Incident: ${incident.incident_number} — ${incident.title}
Status: ${incident.status} | Priority: ${incident.priority} | Category: ${incident.threat_category}
Asset: ${asset?.name ?? "—"} (${asset?.asset_type ?? "—"}) Mission: ${asset?.mission_name ?? "—"}
Created: ${incident.created_at} | Resolved: ${incident.resolution_date ?? "—"}
Description: ${incident.description ?? "—"}
Resolution summary: ${incident.summary ?? "—"}

Stage history:
${(stageRes.data ?? []).map((s: any) => `- ${s.stage} from ${s.entered_at} to ${s.exited_at ?? "ongoing"}`).join("\n") || "—"}

Investigation notes:
${(commentsRes.data ?? []).filter((c: any) => c.kind === "investigation").map((c: any) => `[${c.created_at}] ${c.body}`).join("\n") || "—"}

Discussion comments:
${(commentsRes.data ?? []).filter((c: any) => c.kind === "comment").map((c: any) => `[${c.created_at}] ${c.body}`).join("\n") || "—"}

Mission Room chat:
${(messagesRes.data ?? []).map((m: any) => `[${m.created_at}] ${m.body}`).join("\n") || "—"}

Shared notes:
${(notesRes.data ?? []).map((n: any) => `${n.pinned ? "[PINNED] " : ""}${n.title ?? ""}: ${n.body}`).join("\n") || "—"}

Tasks:
${(tasksRes.data ?? []).map((t: any) => `- ${t.title} [${t.status}] priority=${t.priority} due=${t.due_date ?? "—"} completed=${t.completed_at ?? "—"}`).join("\n") || "—"}

Evidence files:
${(evidenceRes.data ?? []).map((e: any) => `- v${e.version} ${e.file_name} [${e.category ?? "uncategorized"}]: ${e.description ?? ""}`).join("\n") || "—"}

Activity log:
${(activityRes.data ?? []).map((a: any) => `[${a.created_at}] ${a.action}`).join("\n") || "—"}

Schema:
{
  "executive": "2-4 sentences: incident, severity, status, mission impact, duration",
  "timeline": "chronological bullet list with timestamps",
  "investigation": "root cause, evidence, findings, systems affected",
  "collaboration": "key decisions, agreements, findings from chat/discussion",
  "documents": "summary of uploaded reports/evidence",
  "tasks": "completed tasks, pending tasks, assignees",
  "closure": "executive-quality closure summary, or 'Incident not yet closed.'"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "AI rate limit reached. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI error: ${t}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let summary: Record<string, string>;
    try { summary = JSON.parse(content); }
    catch { summary = { executive: content, timeline: "", investigation: "", collaboration: "", documents: "", tasks: "", closure: "" }; }

    await supabase.from("activity_log").insert({
      organization_id: incident.organization_id,
      incident_id: incidentId,
      user_id: userData.user.id,
      action: "AI summary generated",
      entity_type: "ai_summary",
    } as never);

    return new Response(JSON.stringify({ summary }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
