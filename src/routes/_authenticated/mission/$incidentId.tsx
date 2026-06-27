import { useNavigate, useParams, Link } from "@/lib/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Send, Paperclip, Pin, Search, Smile, CornerDownRight,
  FileText, StickyNote, ListTodo, Activity as ActivityIcon, Users, Plus, Download, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useOrgMembers, memberName } from "@/hooks/use-members";
import { formatDistanceToNow } from "date-fns";
import { uploadEvidence, evidenceSignedUrl } from "@/lib/evidence";
import { logActivity, notify } from "@/lib/activity";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const REACTIONS = ["👍", "✅", "🚨", "👀", "🎯", "❤️"];

export function MissionRoom() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: members } = useOrgMembers();

  const { data: incident } = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("*, space_assets(name)").eq("id", incidentId).single();
      return data;
    },
  });

  // Realtime invalidation
  useEffect(() => {
    if (!incidentId) return;
    const ch = supabase
      .channel(`mission-${incidentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_messages", filter: `incident_id=eq.${incidentId}` },
        () => qc.invalidateQueries({ queryKey: ["mission-messages", incidentId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_notes", filter: `incident_id=eq.${incidentId}` },
        () => qc.invalidateQueries({ queryKey: ["mission-notes", incidentId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_tasks", filter: `incident_id=eq.${incidentId}` },
        () => qc.invalidateQueries({ queryKey: ["mission-tasks", incidentId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_evidence", filter: `incident_id=eq.${incidentId}` },
        () => qc.invalidateQueries({ queryKey: ["evidence", incidentId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `incident_id=eq.${incidentId}` },
        () => qc.invalidateQueries({ queryKey: ["activity", incidentId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [incidentId, qc]);

  if (!incident) return <div className="p-6 text-sm text-muted-foreground">Loading Mission Room…</div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/incidents/$incidentId", params: { incidentId } })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="text-xs text-muted-foreground font-mono">{incident.incident_number}</div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">Mission Room — {incident.title}</h1>
              <StatusBadge status={incident.status} />
              <PriorityBadge priority={incident.priority} />
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {(incident.space_assets as { name?: string } | null)?.name ?? "—"}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[260px_1fr_300px]">
        {/* Left column */}
        <aside className="hidden flex-col border-r bg-muted/20 lg:flex">
          <MembersPanel members={members} />
          <FilesPanel incidentId={incidentId} organizationId={profile?.organization_id ?? ""} />
          <NotesPanel incidentId={incidentId} organizationId={profile?.organization_id ?? ""} />
        </aside>

        {/* Center: chat */}
        <main className="flex min-w-0 flex-col">
          <ChatPanel incidentId={incidentId} organizationId={profile?.organization_id ?? ""} members={members} />
        </main>

        {/* Right column */}
        <aside className="hidden flex-col border-l bg-muted/20 lg:flex">
          <TasksPanel incidentId={incidentId} organizationId={profile?.organization_id ?? ""} members={members} />
          <ActivityPanel incidentId={incidentId} members={members} />
        </aside>
      </div>
    </div>
  );
}

/* ----------------- MEMBERS ----------------- */
function MembersPanel({ members }: { members: Map<string, { name: string; email: string }> | undefined }) {
  const list = members ? Array.from(members.entries()) : [];
  return (
    <div className="border-b p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Users className="size-3.5" /> Members
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {list.map(([id, m]) => (
          <div key={id} className="flex items-center gap-2 text-sm">
            <Avatar className="size-6"><AvatarFallback className="text-[10px]">{m.name?.[0] ?? "?"}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1 truncate">{m.name}</div>
            <span className="size-1.5 rounded-full bg-success" title="Online" />
          </div>
        ))}
        {list.length === 0 && <div className="text-xs text-muted-foreground">No team members.</div>}
      </div>
    </div>
  );
}

/* ----------------- FILES ----------------- */
function FilesPanel({ incidentId, organizationId }: { incidentId: string; organizationId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files } = useQuery({
    queryKey: ["evidence", incidentId],
    queryFn: async () => {
      const { data } = await supabase.from("incident_evidence").select("*")
        .eq("incident_id", incidentId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;
    setUploading(true);
    try {
      await uploadEvidence({ file, incidentId, organizationId, source: "mission_room" });
      await logActivity({ organizationId, incidentId, action: `File uploaded: ${file.name}`, entityType: "evidence" });
      await notify({ organizationId, type: "file_uploaded", title: `New file: ${file.name}`, link: `/mission/${incidentId}` });
      toast.success("File uploaded");
      qc.invalidateQueries({ queryKey: ["evidence", incidentId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function download(path: string, name: string) {
    try {
      const url = await evidenceSignedUrl(path);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="border-b p-3 flex-1 min-h-0 flex flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-2"><FileText className="size-3.5" /> Files</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Plus className="size-3.5" />
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>
      <div className="space-y-1 overflow-y-auto flex-1">
        {(files ?? []).slice(0, 10).map((f) => (
          <button key={f.id} onClick={() => download(f.file_path, f.file_name)}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
            <Download className="size-3 text-muted-foreground" />
          </button>
        ))}
        {(files ?? []).length === 0 && <div className="text-xs text-muted-foreground">No files yet.</div>}
      </div>
    </div>
  );
}

/* ----------------- NOTES ----------------- */
function NotesPanel({ incidentId, organizationId }: { incidentId: string; organizationId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["mission-notes", incidentId],
    queryFn: async () => {
      const { data } = await supabase.from("mission_notes").select("*")
        .eq("incident_id", incidentId).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create() {
    if (!body.trim() || !organizationId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("mission_notes").insert({
      organization_id: organizationId, incident_id: incidentId,
      user_id: u.user?.id, title: title || null, body,
    } as never);
    if (error) return toast.error(error.message);
    await logActivity({ organizationId, incidentId, action: `Note added: ${title || body.slice(0, 40)}`, entityType: "note" });
    setTitle(""); setBody(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["mission-notes", incidentId] });
  }

  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("mission_notes").update({ pinned: !pinned } as never).eq("id", id);
    if (!pinned) await notify({ organizationId, type: "note_pinned", title: "A note was pinned", link: `/mission/${incidentId}` });
    qc.invalidateQueries({ queryKey: ["mission-notes", incidentId] });
  }
  async function remove(id: string) {
    await supabase.from("mission_notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mission-notes", incidentId] });
  }

  return (
    <div className="p-3 flex-1 min-h-0 flex flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-2"><StickyNote className="size-3.5" /> Notes</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-2 overflow-y-auto flex-1">
        {(notes ?? []).map((n) => (
          <div key={n.id} className={cn("rounded border bg-card p-2 text-xs", n.pinned && "border-primary/50 bg-primary/5")}>
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                {n.title && <div className="font-medium">{n.title}</div>}
                <div className="whitespace-pre-wrap text-muted-foreground">{n.body}</div>
              </div>
              <div className="flex gap-0.5">
                <button onClick={() => togglePin(n.id, n.pinned)} className="text-muted-foreground hover:text-primary">
                  <Pin className={cn("size-3", n.pinned && "fill-primary text-primary")} />
                </button>
                <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {(notes ?? []).length === 0 && <div className="text-xs text-muted-foreground">No notes yet.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New shared note</DialogTitle></DialogHeader>
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Note body…" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
          <DialogFooter><Button onClick={create}>Save note</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- TASKS ----------------- */
function TasksPanel({ incidentId, organizationId, members }: { incidentId: string; organizationId: string; members: Map<string, { name: string; email: string }> | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState<string>("");
  const [due, setDue] = useState("");

  const { data: tasks } = useQuery({
    queryKey: ["mission-tasks", incidentId],
    queryFn: async () => {
      const { data } = await supabase.from("mission_tasks").select("*")
        .eq("incident_id", incidentId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create() {
    if (!title.trim() || !organizationId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("mission_tasks").insert({
      organization_id: organizationId, incident_id: incidentId, title,
      priority, status: "todo",
      assignee_id: assignee || null, due_date: due || null,
      created_by: u.user?.id,
    } as never);
    if (error) return toast.error(error.message);
    await logActivity({ organizationId, incidentId, action: `Task created: ${title}`, entityType: "task" });
    if (assignee) await notify({ organizationId, userId: assignee, type: "task_assigned", title: `Task assigned: ${title}`, link: `/mission/${incidentId}` });
    setTitle(""); setPriority("medium"); setAssignee(""); setDue(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["mission-tasks", incidentId] });
  }

  async function updateStatus(id: string, status: string, prevStatus: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    await supabase.from("mission_tasks").update(patch as never).eq("id", id);
    if (status === "done" && prevStatus !== "done") {
      await logActivity({ organizationId, incidentId, action: `Task completed`, entityType: "task", entityId: id });
    }
    qc.invalidateQueries({ queryKey: ["mission-tasks", incidentId] });
  }

  return (
    <div className="border-b p-3 flex-1 min-h-0 flex flex-col">
      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-2"><ListTodo className="size-3.5" /> Tasks</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5 overflow-y-auto flex-1">
        {(tasks ?? []).map((t) => (
          <div key={t.id} className="rounded border bg-card p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className={cn("font-medium", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  {t.assignee_id && <span>· {memberName(members, t.assignee_id)}</span>}
                  {t.due_date && <span>· due {new Date(t.due_date).toLocaleDateString()}</span>}
                </div>
              </div>
              <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v, t.status)}>
                <SelectTrigger className="h-6 w-[90px] text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {(tasks ?? []).length === 0 && <div className="text-xs text-muted-foreground">No tasks yet.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
              <SelectContent>
                {members && Array.from(members.entries()).map(([id, m]) => (
                  <SelectItem key={id} value={id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <DialogFooter><Button onClick={create}>Create task</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- ACTIVITY ----------------- */
function ActivityPanel({ incidentId, members }: { incidentId: string; members: Map<string, { name: string; email: string }> | undefined }) {
  const { data: activity } = useQuery({
    queryKey: ["activity", incidentId],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log").select("*")
        .eq("incident_id", incidentId).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  return (
    <div className="p-3 flex-1 min-h-0 flex flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ActivityIcon className="size-3.5" /> Timeline
      </div>
      <ol className="space-y-2 overflow-y-auto flex-1 text-xs">
        {(activity ?? []).map((a) => (
          <li key={a.id} className="border-l-2 border-primary/30 pl-2">
            <div className="font-medium">{a.action}</div>
            <div className="text-[10px] text-muted-foreground">
              {memberName(members, a.user_id)} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
            </div>
          </li>
        ))}
        {(activity ?? []).length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
      </ol>
    </div>
  );
}

/* ----------------- CHAT ----------------- */
type Msg = {
  id: string;
  user_id: string | null;
  body: string;
  reactions: Record<string, string[]>;
  pinned: boolean;
  parent_id: string | null;
  created_at: string;
  edited_at: string | null;
};

function ChatPanel({ incidentId, organizationId, members }: { incidentId: string; organizationId: string; members: Map<string, { name: string; email: string }> | undefined }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { data: profile } = useProfile();

  const { data: messages } = useQuery({
    queryKey: ["mission-messages", incidentId],
    queryFn: async () => {
      const { data } = await supabase.from("mission_messages").select("*")
        .eq("incident_id", incidentId).order("created_at", { ascending: true });
      return (data ?? []) as unknown as Msg[];
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

  // typing presence
  useEffect(() => {
    if (!incidentId || !profile?.id) return;
    const ch = supabase.channel(`typing-${incidentId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const uid = payload.payload?.userId as string | undefined;
      if (!uid || uid === profile.id) return;
      setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      setTimeout(() => setTypingUsers((p) => p.filter((u) => u !== uid)), 3000);
    }).subscribe();
    typingChRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [incidentId, profile?.id]);

  function broadcastTyping() {
    if (!typingChRef.current || !profile?.id) return;
    typingChRef.current.send({ type: "broadcast", event: "typing", payload: { userId: profile.id } });
  }

  async function send() {
    if (!text.trim() || !organizationId || !profile?.id) return;
    const body = text;
    setText(""); setReplyTo(null);
    const { error } = await supabase.from("mission_messages").insert({
      organization_id: organizationId, incident_id: incidentId,
      user_id: profile.id, body, parent_id: replyTo?.id ?? null,
    } as never);
    if (error) { toast.error(error.message); return; }
    await notify({ organizationId, type: "new_message", title: "New Mission Room message", message: body.slice(0, 80), link: `/mission/${incidentId}` });
  }

  async function react(id: string, emoji: string, current: Record<string, string[]>) {
    if (!profile?.id) return;
    const list = current?.[emoji] ?? [];
    const next = list.includes(profile.id) ? list.filter((u) => u !== profile.id) : [...list, profile.id];
    const updated = { ...(current || {}), [emoji]: next };
    if (next.length === 0) delete updated[emoji];
    await supabase.from("mission_messages").update({ reactions: updated } as never).eq("id", id);
  }
  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("mission_messages").update({ pinned: !pinned } as never).eq("id", id);
  }
  async function markRead(ids: string[]) {
    if (!profile?.id || ids.length === 0) return;
    await supabase.from("message_reads").upsert(
      ids.map((id) => ({ message_id: id, user_id: profile.id })) as never,
      { onConflict: "message_id,user_id", ignoreDuplicates: true },
    );
  }
  useEffect(() => {
    const ids = (messages ?? []).map((m) => m.id);
    markRead(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, profile?.id]);

  const filtered = useMemo(() => {
    if (!search) return messages ?? [];
    return (messages ?? []).filter((m) => m.body.toLowerCase().includes(search.toLowerCase()));
  }, [messages, search]);

  const pinned = (messages ?? []).filter((m) => m.pinned);
  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <Input placeholder="Search messages…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 border-0 px-0 shadow-none focus-visible:ring-0" />
      </div>

      {pinned.length > 0 && (
        <div className="border-b bg-primary/5 px-4 py-2 text-xs">
          <div className="mb-1 flex items-center gap-1.5 text-primary"><Pin className="size-3" /> Pinned</div>
          {pinned.slice(0, 3).map((m) => (
            <div key={m.id} className="truncate text-muted-foreground">— {m.body}</div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {filtered.length === 0 && <div className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</div>}
        {filtered.map((m) => {
          const parent = m.parent_id ? byId.get(m.parent_id) : null;
          return (
            <div key={m.id} className="group">
              {parent && (
                <div className="ml-9 mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CornerDownRight className="size-3" /> replying to {memberName(members, parent.user_id)}: "{parent.body.slice(0, 60)}"
                </div>
              )}
              <div className="flex gap-2.5">
                <Avatar className="size-7 mt-0.5"><AvatarFallback className="text-[10px]">{(memberName(members, m.user_id))[0]}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{memberName(members, m.user_id)}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</span>
                    {m.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{m.body}</div>

                  {m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(m.reactions).map(([emo, users]) => users.length > 0 && (
                        <button key={emo} onClick={() => react(m.id, emo, m.reactions)}
                          className={cn("rounded-full border bg-card px-1.5 py-0.5 text-[11px]", users.includes(profile?.id ?? "") && "border-primary bg-primary/10")}>
                          {emo} {users.length}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-0.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {REACTIONS.map((r) => (
                      <button key={r} onClick={() => react(m.id, r, m.reactions)} className="text-xs hover:scale-110">{r}</button>
                    ))}
                    <button onClick={() => setReplyTo(m)} className="ml-1 text-[10px] text-muted-foreground hover:text-foreground">Reply</button>
                    <button onClick={() => togglePin(m.id, m.pinned)} className="text-[10px] text-muted-foreground hover:text-primary">
                      {m.pinned ? "Unpin" : "Pin"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-muted-foreground">
          {typingUsers.map((u) => memberName(members, u)).join(", ")} typing…
        </div>
      )}

      {replyTo && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-1.5 text-xs">
          <span>Replying to {memberName(members, replyTo.user_id)}: "{replyTo.body.slice(0, 60)}"</span>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground">✕</button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); broadcastTyping(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the mission team…"
          rows={1}
          className="min-h-[40px] resize-none"
        />
        <Button onClick={send} disabled={!text.trim()}><Send className="size-4" /></Button>
      </div>
    </div>
  );
}
