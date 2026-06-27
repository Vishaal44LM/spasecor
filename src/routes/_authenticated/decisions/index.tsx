import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Gavel, Plus, Lock, Check, X, Search, Download, FileText, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useOrgMembers, memberName } from "@/hooks/use-members";
import { exportSummaryPdf } from "@/lib/exports";
import { cn } from "@/lib/utils";

export const DECISION_CATEGORIES = [
  "Threat Confirmation",
  "Mission Impact",
  "Escalation",
  "Resource Allocation",
  "Mitigation",
  "Recovery",
  "Closure",
  "Other",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  needs_review: "bg-blue-100 text-blue-800 border-blue-200",
};

export function DecisionsPage({ incidentId }: { incidentId?: string } = {}) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: members } = useOrgMembers();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: decisions } = useQuery({
    queryKey: ["decisions", incidentId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("decisions").select("*, decision_evidence_links(evidence_id), decision_chat_links(message_id)").order("created_at", { ascending: false });
      if (incidentId) q = q.eq("incident_id", incidentId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: incidents } = useQuery({
    queryKey: ["incidents-min"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("id, incident_number, title").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !incidentId,
  });

  const filtered = useMemo(() => {
    return (decisions ?? []).filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (search && !`${d.title} ${d.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [decisions, statusFilter, categoryFilter, search]);

  async function setStatus(id: string, status: string) {
    const { data: u } = await supabase.auth.getUser();
    const patch: Record<string, unknown> = { status };
    if (status === "approved") {
      patch.approved_by = u.user?.id;
      patch.approved_at = new Date().toISOString();
      patch.locked = true;
    }
    const { error } = await supabase.from("decisions").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Decision ${status}`);
    qc.invalidateQueries({ queryKey: ["decisions"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this decision?")) return;
    const { error } = await supabase.from("decisions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["decisions"] });
  }

  function exportReport() {
    exportSummaryPdf({
      title: `Decision Intelligence Report${incidentId ? "" : " (All incidents)"}`,
      sections: filtered.map((d) => ({
        heading: `${d.title} [${d.status.toUpperCase()}]`,
        body: `Category: ${d.category}
Decision maker: ${memberName(members, d.decision_maker_id)}
Team: ${d.team ?? "—"}
Created: ${new Date(d.created_at).toLocaleString()}
${d.approved_at ? `Approved: ${new Date(d.approved_at).toLocaleString()} by ${memberName(members, d.approved_by)}` : ""}

${d.description}`,
      })),
    }, `decisions_${Date.now()}.pdf`);
  }

  return (
    <div className={cn("space-y-6", !incidentId && "mx-auto max-w-7xl p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gavel className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Decision Intelligence Log</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportReport}><Download className="size-4" /> Export PDF</Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> New decision</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search decisions…" className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {DECISION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No decisions recorded yet.</CardContent></Card>
        )}
        {filtered.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{d.title}</h3>
                    {d.locked && <Lock className="size-3.5 text-muted-foreground" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={STATUS_COLORS[d.status]}>{d.status.replace("_", " ")}</Badge>
                    <Badge variant="outline">{d.category}</Badge>
                    <span>· {memberName(members, d.decision_maker_id)}</span>
                    {d.team && <span>· Team: {d.team}</span>}
                    <span>· {new Date(d.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{d.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {d.decision_evidence_links?.length > 0 && (
                  <span className="flex items-center gap-1"><FileText className="size-3" /> {d.decision_evidence_links.length} evidence</span>
                )}
                {d.decision_chat_links?.length > 0 && (
                  <span className="flex items-center gap-1"><MessageSquare className="size-3" /> {d.decision_chat_links.length} messages</span>
                )}
              </div>
              {!d.locked && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" onClick={() => setStatus(d.id, "needs_review")}>Needs review</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(d.id, "rejected")}>
                    <X className="size-3.5" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => setStatus(d.id, "approved")}>
                    <Check className="size-3.5" /> Approve & Lock
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setEditing(d); setOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d.id)}>Delete</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DecisionDialog
        open={open}
        onOpenChange={setOpen}
        organizationId={profile?.organization_id ?? ""}
        defaultIncidentId={incidentId}
        incidents={incidents ?? []}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["decisions"] })}
      />
    </div>
  );
}

function DecisionDialog({
  open, onOpenChange, organizationId, defaultIncidentId, incidents, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  organizationId: string;
  defaultIncidentId?: string;
  incidents: { id: string; incident_number: string; title: string }[];
  editing: any | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [team, setTeam] = useState("");
  const [incident, setIncident] = useState<string>(defaultIncidentId ?? "");

  useMemo(() => {
    if (editing) {
      setTitle(editing.title); setDescription(editing.description);
      setCategory(editing.category); setTeam(editing.team ?? "");
      setIncident(editing.incident_id ?? "");
    } else {
      setTitle(""); setDescription(""); setCategory("Other"); setTeam("");
      setIncident(defaultIncidentId ?? "");
    }
  }, [editing, defaultIncidentId]);

  async function save() {
    if (!title.trim() || !description.trim() || !organizationId) return toast.error("Title and description required");
    const { data: u } = await supabase.auth.getUser();
    if (editing) {
      const { error } = await supabase.from("decisions").update({
        title, description, category, team: team || null, incident_id: incident || null,
      } as never).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("decisions").insert({
        organization_id: organizationId, incident_id: incident || null,
        title, description, category, team: team || null,
        decision_maker_id: u.user?.id, status: "pending",
      } as never);
      if (error) return toast.error(error.message);
    }
    toast.success("Decision saved");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Edit decision" : "Record decision"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Decision title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Describe the decision and rationale…" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DECISION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Team (optional)" value={team} onChange={(e) => setTeam(e.target.value)} />
          </div>
          {!defaultIncidentId && (
            <Select value={incident} onValueChange={setIncident}>
              <SelectTrigger><SelectValue placeholder="Link to incident (optional)" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {incidents.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.incident_number} — {i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter><Button onClick={save}>{editing ? "Save changes" : "Create decision"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
