import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import {
  INCIDENT_STAGES,
  STAGE_LABELS,
  stageIndex,
  PRIORITIES,
} from "@/lib/incident-constants";
import {
  ArrowLeft,
  Sparkles,
  Upload,
  FileText,
  Download,
  Activity as ActivityIcon,
  Trash2,
  Loader2,
  Send,
  ShieldAlert,
  Satellite,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { logActivity, notify } from "@/lib/activity";
import { analyzeIncident } from "@/lib/ai.functions";
import { buildIncidentReportSections, downloadIncidentPdf } from "@/lib/report";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/incidents/$incidentId")({
  head: () => ({ meta: [{ title: "Incident — Spasecor" }] }),
  component: IncidentDetail,
});

function IncidentDetail() {
  const { incidentId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  const { data: incident } = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*, space_assets(id, name, asset_type, mission_name, orbit_type)")
        .eq("id", incidentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stageHistory } = useQuery({
    queryKey: ["stage-history", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_stage_history")
        .select("*")
        .eq("incident_id", incidentId)
        .order("entered_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_comments")
        .select("*, user_id")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: evidence } = useQuery({
    queryKey: ["evidence", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_evidence")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: analyses } = useQuery({
    queryKey: ["ai-analyses", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_ai_analyses")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_reports")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: activity } = useQuery({
    queryKey: ["activity", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*, user_id")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!incident) return <div className="p-6 text-sm text-muted-foreground">Loading incident…</div>;

  const asset = incident.space_assets as {
    id?: string; name?: string; asset_type?: string; mission_name?: string; orbit_type?: string;
  } | null;
  const curIdx = stageIndex(incident.status);

  async function setStatus(next: string) {
    if (!profile?.organization_id) return;
    const { error } = await supabase
      .from("incidents")
      .update({ status: next as never })
      .eq("id", incidentId);
    if (error) return toast.error(error.message);
    await logActivity({
      organizationId: profile.organization_id,
      incidentId,
      action: `Status changed to ${STAGE_LABELS[next as keyof typeof STAGE_LABELS]}`,
      entityType: "incident",
      entityId: incidentId,
    });
    await notify({
      organizationId: profile.organization_id,
      userId: profile.id,
      type: "status_changed",
      title: `${incident.incident_number} → ${STAGE_LABELS[next as keyof typeof STAGE_LABELS]}`,
      link: `/incidents/${incidentId}`,
    });
    qc.invalidateQueries({ queryKey: ["incident", incidentId] });
    qc.invalidateQueries({ queryKey: ["stage-history", incidentId] });
    qc.invalidateQueries({ queryKey: ["activity", incidentId] });
  }

  async function setPriority(next: string) {
    await supabase.from("incidents").update({ priority: next as never }).eq("id", incidentId);
    if (profile?.organization_id) {
      await logActivity({
        organizationId: profile.organization_id,
        incidentId,
        action: `Priority changed to ${next}`,
        entityType: "incident",
        entityId: incidentId,
      });
    }
    qc.invalidateQueries({ queryKey: ["incident", incidentId] });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/incidents" })}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>

      <header className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{incident.incident_number}</span>
              <span>•</span>
              <span>Created {new Date(incident.created_at).toLocaleString()}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{incident.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={incident.status} />
              <PriorityBadge priority={incident.priority} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                <ShieldAlert className="size-3" /> {incident.threat_category}
              </span>
              {asset?.name && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                  <Satellite className="size-3" /> {asset.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={incident.priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={incident.status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCIDENT_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <WorkflowStepper currentIdx={curIdx} stageHistory={stageHistory ?? []} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="evidence">Evidence ({evidence?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="investigation">Investigation</TabsTrigger>
              <TabsTrigger value="ai">AI Analysis ({analyses?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="reports">Reports ({reports?.length ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {incident.description || <span className="text-muted-foreground">No description provided.</span>}
                  </p>
                </CardContent>
              </Card>

              {incident.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{incident.summary}</p>
                  </CardContent>
                </Card>
              )}

              <ResolutionCard
                incidentId={incidentId}
                organizationId={profile?.organization_id}
                currentSummary={incident.summary ?? ""}
                onSaved={() => qc.invalidateQueries({ queryKey: ["incident", incidentId] })}
              />
            </TabsContent>

            <TabsContent value="evidence">
              <EvidenceSection
                incidentId={incidentId}
                organizationId={profile?.organization_id}
                evidence={evidence ?? []}
              />
            </TabsContent>

            <TabsContent value="investigation">
              <InvestigationSection
                incidentId={incidentId}
                organizationId={profile?.organization_id}
                comments={(comments ?? []).filter((c) => c.kind === "investigation")}
              />
            </TabsContent>

            <TabsContent value="ai">
              <AISection
                incidentId={incidentId}
                analyses={analyses ?? []}
              />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsSection
                incident={incident}
                asset={asset}
                analyses={analyses ?? []}
                reports={reports ?? []}
                organizationId={profile?.organization_id}
              />
            </TabsContent>
          </Tabs>

          <CommentsSection
            incidentId={incidentId}
            organizationId={profile?.organization_id}
            comments={(comments ?? []).filter((c) => c.kind === "comment")}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incident details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Asset" value={asset?.name ?? "—"} />
              <Row label="Mission" value={asset?.mission_name ?? "—"} />
              <Row label="Orbit" value={asset?.orbit_type ?? "—"} />
              <Row label="Category" value={incident.threat_category} />
              <Row label="Created" value={new Date(incident.created_at).toLocaleString()} />
              <Row label="Last updated" value={new Date(incident.updated_at).toLocaleString()} />
              <Row
                label="Resolved"
                value={incident.resolution_date ? new Date(incident.resolution_date).toLocaleString() : "—"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ActivityIcon className="size-4 text-primary" /> Activity timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l pl-4">
                {(activity ?? []).map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[19px] mt-1.5 size-2.5 rounded-full bg-primary" />
                    <div className="text-sm font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {(a.profiles as { name?: string } | null)?.name ?? "system"} ·{" "}
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </div>
                  </li>
                ))}
                {(activity ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">No activity yet.</li>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}

function WorkflowStepper({
  currentIdx,
  stageHistory,
}: {
  currentIdx: number;
  stageHistory: { stage: string; entered_at: string; exited_at: string | null }[];
}) {
  function timeIn(stage: string) {
    const entries = stageHistory.filter((s) => s.stage === stage);
    if (entries.length === 0) return null;
    const total = entries.reduce((acc, e) => {
      const end = e.exited_at ? new Date(e.exited_at).getTime() : Date.now();
      return acc + (end - new Date(e.entered_at).getTime());
    }, 0);
    return total;
  }
  function humanize(ms: number | null) {
    if (ms == null) return "—";
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 48) return `${h}h ${mins % 60}m`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {INCIDENT_STAGES.map((stage, idx) => {
        const done = idx < currentIdx;
        const current = idx === currentIdx;
        const t = timeIn(stage);
        return (
          <div
            key={stage}
            className={cn(
              "relative rounded-lg border p-3",
              current && "border-primary bg-primary/5",
              done && "bg-muted/40",
            )}
          >
            <div className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : current ? (
                <span className="size-2.5 animate-pulse rounded-full bg-primary" />
              ) : (
                <Circle className="size-4 text-muted-foreground/40" />
              )}
              <span className={cn("text-xs font-medium", current && "text-primary")}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Time in stage · {humanize(t)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentsSection({
  incidentId,
  organizationId,
  comments,
}: {
  incidentId: string;
  organizationId?: string | null;
  comments: { id: string; body: string; created_at: string; user_id: string | null }[];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!text.trim() || !organizationId) return;
    setSubmitting(true);
    const { error } = await supabase.from("incident_comments").insert({
      incident_id: incidentId,
      organization_id: organizationId,
      body: text,
      kind: "comment",
    } as never);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logActivity({
      organizationId, incidentId, action: "Comment added", entityType: "comment",
    });
    setText("");
    qc.invalidateQueries({ queryKey: ["comments", incidentId] });
    qc.invalidateQueries({ queryKey: ["activity", incidentId] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Discussion</CardTitle>
        <CardDescription>Coordinate with your team on this incident.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{memberName(members, c.user_id)}</span>
                <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" rows={3} />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={submitting || !text.trim()}>
              <Send className="size-4" /> Post
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvestigationSection({
  incidentId, organizationId, comments,
}: {
  incidentId: string;
  organizationId?: string | null;
  comments: { id: string; body: string; created_at: string; user_id: string | null }[];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  async function submit() {
    if (!text.trim() || !organizationId) return;
    await supabase.from("incident_comments").insert({
      incident_id: incidentId,
      organization_id: organizationId,
      body: text,
      kind: "investigation",
    } as never);
    await logActivity({ organizationId, incidentId, action: "Investigation note added" });
    setText("");
    qc.invalidateQueries({ queryKey: ["comments", incidentId] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investigation notes</CardTitle>
        <CardDescription>Findings, observations, indicators of compromise.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border-l-2 border-primary bg-primary/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{memberName(members, c.user_id)}</span>
              <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.body}</p>
          </div>
        ))}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an investigation note…" rows={4} />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit}>Add note</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceSection({
  incidentId, organizationId, evidence,
}: {
  incidentId: string;
  organizationId?: string | null;
  evidence: { id: string; file_name: string; file_path: string; mime_type: string | null; file_size: number | null; created_at: string }[];
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || !organizationId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${organizationId}/${incidentId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("evidence").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const { error: dbErr } = await supabase.from("incident_evidence").insert({
        incident_id: incidentId,
        organization_id: organizationId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type,
        file_size: file.size,
      } as never);
      if (dbErr) toast.error(dbErr.message);
      else await logActivity({
        organizationId, incidentId, action: "Evidence uploaded",
        entityType: "evidence", details: { file: file.name },
      });
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["evidence", incidentId] });
    qc.invalidateQueries({ queryKey: ["activity", incidentId] });
    toast.success("Evidence uploaded");
  }

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  }

  async function remove(id: string, path: string) {
    await supabase.storage.from("evidence").remove([path]);
    await supabase.from("incident_evidence").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["evidence", incidentId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>Logs, screenshots, PDFs and supporting files.</CardDescription>
        </div>
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.log"
          onChange={(e) => upload(e.target.files)}
        />
      </CardHeader>
      <CardContent>
        {evidence.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            No evidence uploaded yet.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {evidence.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.mime_type ?? "file"} · {formatBytes(f.file_size)} ·{" "}
                      {new Date(f.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => download(f.file_path, f.file_name)}>
                    <Download className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(f.id, f.file_path)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(n: number | null) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function AISection({
  incidentId, analyses,
}: {
  incidentId: string;
  analyses: { id: string; payload: unknown; created_at: string }[];
}) {
  const qc = useQueryClient();
  const run = useServerFn(analyzeIncident);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      await run({ data: { incidentId } });
      toast.success("AI analysis complete");
      qc.invalidateQueries({ queryKey: ["ai-analyses", incidentId] });
      qc.invalidateQueries({ queryKey: ["activity", incidentId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI Investigation Assistant
          </CardTitle>
          <CardDescription>
            Optional analysis to surface threat, attack path, mission impact, risk and mitigations.
          </CardDescription>
        </div>
        <Button size="sm" onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Analyze incident
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {analyses.length === 0 && (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            No analyses yet. Run an AI analysis to enrich this incident.
          </div>
        )}
        {analyses.map((a) => (
          <AnalysisCard key={a.id} payload={a.payload as Record<string, unknown>} createdAt={a.created_at} />
        ))}
      </CardContent>
    </Card>
  );
}

function AnalysisCard({ payload, createdAt }: { payload: Record<string, unknown>; createdAt: string }) {
  const threat = (payload.threat_analysis ?? {}) as Record<string, string>;
  const scenario = (payload.attack_scenario as string[] | undefined) ?? [];
  const impact = (payload.mission_impact ?? {}) as Record<string, string>;
  const risk = (payload.risk_assessment ?? {}) as Record<string, string>;
  const mit = (payload.mitigation ?? {}) as Record<string, string[]>;
  const exec = payload.executive_summary as string | undefined;

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs text-muted-foreground">
        Analyzed {new Date(createdAt).toLocaleString()}
      </div>
      {exec && (
        <div className="mt-3 rounded-md bg-primary/5 p-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">Executive summary</div>
          <p className="mt-1">{exec}</p>
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Block title="Threat analysis">
          <KV label="Likely threat" value={threat.likely_threat_type} />
          <KV label="Severity" value={threat.threat_severity} />
          <KV label="Attack method" value={threat.possible_attack_method} />
          {threat.technical_summary && <p className="mt-2 text-sm">{threat.technical_summary}</p>}
        </Block>
        <Block title="Attack scenario">
          <ol className="space-y-2">
            {scenario.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Block>
        <Block title="Mission impact">
          {Object.entries(impact).map(([k, v]) => (
            <KV key={k} label={k.replace(/_/g, " ")} value={v} />
          ))}
        </Block>
        <Block title="Risk assessment">
          {Object.entries(risk).map(([k, v]) => (
            <KV key={k} label={k.replace(/_/g, " ")} value={v} />
          ))}
        </Block>
        <Block title="Mitigation" className="md:col-span-2">
          <MitList title="Immediate" items={mit.immediate} />
          <MitList title="Short-term" items={mit.short_term} />
          <MitList title="Long-term" items={mit.long_term} />
        </Block>
      </div>
    </div>
  );
}

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border bg-muted/20 p-3", className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label?: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      {label && <span className="mr-1.5 capitalize text-muted-foreground">{label}:</span>}
      <span>{value}</span>
    </div>
  );
}

function MitList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="text-xs font-medium uppercase tracking-wide text-primary">{title}</div>
      <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
        {items.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}

function ResolutionCard({
  incidentId, organizationId, currentSummary, onSaved,
}: {
  incidentId: string;
  organizationId?: string | null;
  currentSummary: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState(currentSummary);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolution / Summary</CardTitle>
        <CardDescription>Capture the final outcome and outcome notes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Outcome, root cause, follow-ups…" />
        <div className="flex justify-end">
          <Button size="sm" onClick={async () => {
            await supabase.from("incidents").update({ summary: text }).eq("id", incidentId);
            if (organizationId) {
              await logActivity({ organizationId, incidentId, action: "Resolution summary updated" });
            }
            toast.success("Saved");
            onSaved();
          }}>Save summary</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsSection({
  incident, asset, analyses, reports, organizationId,
}: {
  incident: {
    id: string; incident_number: string; title: string; threat_category: string;
    priority: string; status: string; description: string | null;
    summary: string | null; created_at: string; resolution_date: string | null;
  };
  asset: { name?: string; asset_type?: string; mission_name?: string | null } | null;
  analyses: { payload: unknown }[];
  reports: { id: string; title: string; content: unknown; created_at: string }[];
  organizationId?: string | null;
}) {
  const qc = useQueryClient();

  async function generate() {
    if (!organizationId) return;
    const ai = (analyses[0]?.payload as Record<string, unknown> | undefined) ?? null;
    const sections = buildIncidentReportSections({ incident, asset, ai });
    const { data, error } = await supabase.from("incident_reports").insert({
      incident_id: incident.id,
      organization_id: organizationId,
      title: `Incident report — ${incident.incident_number}`,
      content: { sections } as never,
    } as never).select().single();
    if (error) return toast.error(error.message);
    await logActivity({
      organizationId, incidentId: incident.id, action: "Report generated",
      entityType: "report", entityId: data!.id,
    });
    downloadIncidentPdf({
      fileName: `${incident.incident_number}-report.pdf`,
      title: incident.title,
      subtitle: `${incident.incident_number} · ${asset?.name ?? ""}`,
      sections,
    });
    toast.success("Report generated");
    qc.invalidateQueries({ queryKey: ["reports", incident.id] });
    qc.invalidateQueries({ queryKey: ["activity", incident.id] });
  }

  function downloadExisting(r: { title: string; content: unknown }) {
    const sections = ((r.content as { sections?: unknown[] })?.sections ?? []) as never[];
    downloadIncidentPdf({
      fileName: `${incident.incident_number}-report.pdf`,
      title: incident.title,
      subtitle: incident.incident_number,
      sections,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Generate and download mission-grade incident reports.</CardDescription>
        </div>
        <Button size="sm" onClick={generate}><FileText className="size-4" /> Generate report</Button>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            No reports generated yet.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => downloadExisting(r)}>
                  <Download className="size-4" /> Download PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
