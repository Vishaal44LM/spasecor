import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: "Supabase not configured" });
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

    const incident = incidentRes.data;
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    const asset = incident.space_assets as any;

    const sys = `You are an analyst writing summaries for the Spasecor space cybersecurity platform.
RULES (must follow strictly):
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
  "executive": "string - 2-4 sentences: incident, severity, status, mission impact, duration",
  "timeline": "string - chronological bullet list with timestamps",
  "investigation": "string - root cause, evidence, findings, systems affected",
  "collaboration": "string - key decisions, agreements, findings from chat/discussion",
  "documents": "string - summary of uploaded reports/evidence",
  "tasks": "string - completed tasks, pending tasks, assignees",
  "closure": "string - executive-quality closure summary, or 'Incident not yet closed.'"
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
      if (aiRes.status === 429) return res.status(429).json({ error: "AI rate limit reached. Try again shortly." });
      if (aiRes.status === 402) return res.status(402).json({ error: "AI credits exhausted. Add credits to continue." });
      return res.status(502).json({ error: `AI error: ${t}` });
    }
    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let summary: Record<string, string>;
    try {
      summary = JSON.parse(content);
    } catch {
      summary = { executive: content, timeline: "", investigation: "", collaboration: "", documents: "", tasks: "", closure: "" };
    }

    await supabase.from("activity_log").insert({
      organization_id: incident.organization_id,
      incident_id: incidentId,
      user_id: userData.user.id,
      action: "AI summary generated",
      entity_type: "ai_summary",
    } as never);

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unexpected error" });
  }
}
