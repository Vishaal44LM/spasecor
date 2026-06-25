import { Link } from "@/lib/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASSET_TYPES, ASSET_STATUSES } from "@/lib/incident-constants";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PlusCircle, Satellite } from "lucide-react";
import { logActivity } from "@/lib/activity";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AssetsList() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useQuery({
    queryKey: ["assets", showArchived],
    queryFn: async () => {
      const q = supabase.from("space_assets").select("*").order("created_at", { ascending: false });
      if (!showArchived) q.eq("archived", false);
      const { data } = await q;
      return data ?? [];
    },
  });

  const typeLabel = (t: string) => ASSET_TYPES.find((x) => x.value === t)?.label ?? t;
  const statusLabel = (s: string) => ASSET_STATUSES.find((x) => x.value === s)?.label ?? s;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Space asset registry</h1>
          <p className="text-sm text-muted-foreground">
            Satellites, ground stations and mission infrastructure under cyber watch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <NewAssetDialog />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mission</TableHead>
              <TableHead>Orbit / Location</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((a) => (
              <TableRow key={a.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    to="/assets/$assetId"
                    params={{ assetId: a.id }}
                    className="flex items-center gap-2 font-medium hover:text-primary"
                  >
                    <Satellite className="size-4 text-muted-foreground" />
                    {a.name}
                    {a.archived && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{typeLabel(a.asset_type)}</TableCell>
                <TableCell className="text-muted-foreground">{a.mission_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{a.orbit_type || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{a.operator || "—"}</TableCell>
                <TableCell>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {statusLabel(a.status)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                  No assets registered yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewAssetDialog() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    asset_type: "satellite",
    mission_name: "",
    orbit_type: "",
    operator: "",
    launch_date: "",
    status: "operational",
    description: "",
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profile?.organization_id) return;
    const { data, error } = await supabase
      .from("space_assets")
      .insert({
        ...form,
        launch_date: form.launch_date || null,
        organization_id: profile.organization_id,
        created_by: profile.id,
      } as never)
      .select()
      .single();
    if (error) return toast.error(error.message);
    await logActivity({
      organizationId: profile.organization_id,
      action: "Asset created",
      entityType: "asset",
      entityId: data!.id,
      details: { name: form.name },
    });
    toast.success("Asset created");
    qc.invalidateQueries({ queryKey: ["assets"] });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="size-4" /> New asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register space asset</DialogTitle>
          <DialogDescription>Add a satellite, ground station or system to the registry.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Mission</Label>
              <Input value={form.mission_name} onChange={(e) => setForm({ ...form, mission_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Orbit / Location</Label>
              <Input
                value={form.orbit_type}
                onChange={(e) => setForm({ ...form, orbit_type: e.target.value })}
                placeholder="LEO, GEO, MEO, ground site…"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Operator</Label>
              <Input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Launch date</Label>
              <Input type="date" value={form.launch_date} onChange={(e) => setForm({ ...form, launch_date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Create asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
