import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Database, Upload, Download, Search, History, Eye, Hash, Package, FileText, Image as ImageIcon, FileJson, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useOrgMembers, memberName } from "@/hooks/use-members";
import { EVIDENCE_CATEGORIES, evidenceSignedUrl, uploadEvidence, evidenceDownload } from "@/lib/evidence";
import { exportInvestigationPackage } from "@/lib/exports";
import { cn } from "@/lib/utils";

type Evidence = {
  id: string;
  incident_id: string;
  organization_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  sha256: string | null;
  version: number;
  parent_id: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
};

export function EvidenceVault({ incidentId }: { incidentId?: string } = {}) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: members } = useOrgMembers();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [incidentFilter, setIncidentFilter] = useState<string>(incidentId ?? "all");
  const [preview, setPreview] = useState<Evidence | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMeta, setPendingMeta] = useState({ category: "Other", tags: "", description: "", incidentId: incidentId ?? "", parentId: "" });

  const { data: files } = useQuery({
    queryKey: ["vault", incidentId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("incident_evidence").select("*").order("created_at", { ascending: false });
      if (incidentId) q = q.eq("incident_id", incidentId);
      const { data } = await q;
      return (data ?? []) as Evidence[];
    },
  });

  const { data: incidents } = useQuery({
    queryKey: ["incidents-min"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("id, incident_number, title").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (files ?? []).filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (!incidentId && incidentFilter !== "all" && f.incident_id !== incidentFilter) return false;
      if (search) {
        const hay = `${f.file_name} ${f.description ?? ""} ${(f.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [files, categoryFilter, incidentFilter, search, incidentId]);

  // Group by parent (version chain)
  const grouped = useMemo(() => {
    const map = new Map<string, Evidence[]>();
    filtered.forEach((f) => {
      const key = f.parent_id ?? f.id;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([rootId, versions]) => ({
      rootId,
      latest: versions.sort((a, b) => b.version - a.version)[0],
      versions: versions.sort((a, b) => b.version - a.version),
    }));
  }, [filtered]);

  function openUpload(parentId?: string) {
    setPendingFile(null);
    setPendingMeta({ category: "Other", tags: "", description: "", incidentId: incidentId ?? "", parentId: parentId ?? "" });
    setUploadOpen(true);
    setTimeout(() => fileRef.current?.click(), 50);
  }

  async function submitUpload() {
    if (!pendingFile || !profile?.organization_id) return;
    const incId = pendingMeta.incidentId || incidentId;
    if (!incId) return toast.error("Select an incident");
    try {
      await uploadEvidence({
        file: pendingFile,
        incidentId: incId,
        organizationId: profile.organization_id,
        category: pendingMeta.category,
        tags: pendingMeta.tags.split(",").map((t) => t.trim()).filter(Boolean),
        description: pendingMeta.description,
        parentId: pendingMeta.parentId || null,
        source: "vault",
      });
      toast.success("Evidence uploaded");
      setUploadOpen(false); setPendingFile(null);
      qc.invalidateQueries({ queryKey: ["vault"] });
      qc.invalidateQueries({ queryKey: ["evidence"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function download(f: Evidence) {
    try {
      const url = await evidenceSignedUrl(f.file_path);
      const a = document.createElement("a"); a.href = url; a.download = f.file_name; a.click();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this evidence file?")) return;
    await supabase.from("incident_evidence").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["vault"] });
  }

  async function openPreview(f: Evidence) {
    setPreview(f); setPreviewUrl(""); setPreviewText("");
    try {
      const url = await evidenceSignedUrl(f.file_path);
      setPreviewUrl(url);
      const isText = (f.mime_type ?? "").startsWith("text/") || /\.(csv|log|json|txt|xml|yaml|yml)$/i.test(f.file_name);
      if (isText) {
        const blob = await evidenceDownload(f.file_path);
        setPreviewText((await blob.text()).slice(0, 50000));
      }
    } catch (e) { toast.error((e as Error).message); }
  }

  async function exportPackage() {
    if (!incidentId && incidentFilter === "all") return toast.error("Pick an incident first");
    const incId = incidentId ?? incidentFilter;
    const inc = incidents?.find((i) => i.id === incId);
    await exportInvestigationPackage({
      incidentNumber: inc?.incident_number ?? incId,
      files: filtered.map((f) => ({
        file_name: f.file_name, file_path: f.file_path, sha256: f.sha256,
        uploaded_by: f.uploaded_by, created_at: f.created_at, version: f.version, category: f.category,
      })),
    });
  }

  return (
    <div className={cn("space-y-6", !incidentId && "mx-auto max-w-7xl p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Digital Evidence Vault</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPackage}><Package className="size-4" /> Export package</Button>
          <Button size="sm" onClick={() => openUpload()}><Upload className="size-4" /> Upload evidence</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, tag, description…" className="pl-8" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EVIDENCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {!incidentId && (
          <Select value={incidentFilter} onValueChange={setIncidentFilter}>
            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All incidents</SelectItem>
              {incidents?.map((i) => <SelectItem key={i.id} value={i.id}>{i.incident_number} — {i.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        {grouped.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No evidence in vault.</CardContent></Card>
        )}
        {grouped.map(({ rootId, latest, versions }) => (
          <Card key={rootId}>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <FileIcon name={latest.file_name} mime={latest.mime_type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{latest.file_name}</div>
                    <Badge variant="outline">v{latest.version}</Badge>
                    {latest.category && <Badge variant="secondary">{latest.category}</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{memberName(members, latest.uploaded_by)}</span>
                    <span>{new Date(latest.created_at).toLocaleString()}</span>
                    {latest.file_size != null && <span>{formatBytes(latest.file_size)}</span>}
                    {latest.sha256 && <span className="font-mono" title={latest.sha256}><Hash className="inline size-3" /> {latest.sha256.slice(0, 12)}…</span>}
                  </div>
                  {latest.description && <div className="mt-1 text-xs">{latest.description}</div>}
                  {(latest.tags ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {latest.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openPreview(latest)}><Eye className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => download(latest)}><Download className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openUpload(rootId)} title="Upload new version"><History className="size-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(latest.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              {versions.length > 1 && (
                <div className="mt-2 border-t pt-2 text-xs">
                  <div className="mb-1 font-medium text-muted-foreground">Previous versions</div>
                  {versions.slice(1).map((v) => (
                    <div key={v.id} className="flex items-center justify-between py-0.5 text-muted-foreground">
                      <span>v{v.version} — {new Date(v.created_at).toLocaleString()}</span>
                      <Button size="sm" variant="ghost" className="h-6" onClick={() => download(v)}><Download className="size-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pendingMeta.parentId ? "Upload new version" : "Upload evidence"}</DialogTitle></DialogHeader>
          <input ref={fileRef} type="file" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
          {pendingFile && <div className="rounded border bg-muted p-2 text-xs">{pendingFile.name} · {formatBytes(pendingFile.size)}</div>}
          {!incidentId && !pendingMeta.parentId && (
            <Select value={pendingMeta.incidentId} onValueChange={(v) => setPendingMeta((p) => ({ ...p, incidentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Incident" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {incidents?.map((i) => <SelectItem key={i.id} value={i.id}>{i.incident_number} — {i.title}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={pendingMeta.category} onValueChange={(v) => setPendingMeta((p) => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EVIDENCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Tags (comma-separated)" value={pendingMeta.tags} onChange={(e) => setPendingMeta((p) => ({ ...p, tags: e.target.value }))} />
          <Textarea placeholder="Description" value={pendingMeta.description} onChange={(e) => setPendingMeta((p) => ({ ...p, description: e.target.value }))} rows={3} />
          <DialogFooter><Button onClick={submitUpload} disabled={!pendingFile}>Upload</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{preview?.file_name}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-auto">
            {preview && previewUrl && (preview.mime_type?.startsWith("image/") ? (
              <img src={previewUrl} alt={preview.file_name} className="max-w-full" />
            ) : preview.mime_type === "application/pdf" ? (
              <iframe src={previewUrl} className="h-[70vh] w-full" />
            ) : previewText ? (
              <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{previewText}</pre>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No inline preview available. <Button variant="link" onClick={() => preview && download(preview)}>Download</Button></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileIcon({ name, mime }: { name: string; mime: string | null }) {
  if (mime?.startsWith("image/")) return <ImageIcon className="size-8 text-primary" />;
  if (/\.json$/i.test(name) || mime === "application/json") return <FileJson className="size-8 text-primary" />;
  return <FileText className="size-8 text-primary" />;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
