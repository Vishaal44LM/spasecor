import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_TYPES, ASSET_STATUSES } from "@/lib/incident-constants";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, ArchiveRestore, ArrowLeft, Save, Satellite, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { logActivity } from "@/lib/activity";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/assets/$assetId")({
  head: () => ({ meta: [{ title: "Asset — Spasecor" }] }),
  component: AssetDetail,
});

function AssetDetail() {
  const { assetId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  const { data: asset } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_assets")
        .select("*")
        .eq("id", assetId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: incidents } = useQuery({
    queryKey: ["asset-incidents", assetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | null>>({});

  function startEdit() {
    if (!asset) return;
    setForm({
      name: asset.name,
      asset_type: asset.asset_type,
      mission_name: asset.mission_name ?? "",
      orbit_type: asset.orbit_type ?? "",
      operator: asset.operator ?? "",
      launch_date: asset.launch_date ?? "",
      status: asset.status,
      description: asset.description ?? "",
    });
    setEditing(true);
  }

  async function save() {
    const { error } = await supabase
      .from("space_assets")
      .update({
        ...form,
        launch_date: form.launch_date || null,
      } as never)
      .eq("id", assetId);
    if (error) return toast.error(error.message);
    if (profile?.organization_id) {
      await logActivity({
        organizationId: profile.organization_id,
        action: "Asset updated",
        entityType: "asset",
        entityId: assetId,
      });
    }
    toast.success("Asset updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["asset", assetId] });
    qc.invalidateQueries({ queryKey: ["assets"] });
  }

  async function toggleArchive() {
    if (!asset) return;
    const { error } = await supabase
      .from("space_assets")
      .update({ archived: !asset.archived } as never)
      .eq("id", assetId);
    if (error) return toast.error(error.message);
    if (profile?.organization_id) {
      await logActivity({
        organizationId: profile.organization_id,
        action: asset.archived ? "Asset unarchived" : "Asset archived",
        entityType: "asset",
        entityId: assetId,
      });
    }
    qc.invalidateQueries({ queryKey: ["asset", assetId] });
  }

  if (!asset) {
    return <div className="p-6 text-sm text-muted-foreground">Loading asset…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/assets" })}>
          <ArrowLeft className="size-4" /> Back to assets
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleArchive}>
            {asset.archived ? (
              <>
                <ArchiveRestore className="size-4" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="size-4" /> Archive
              </>
            )}
          </Button>
          {!editing ? (
            <Button size="sm" onClick={startEdit}>Edit</Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={save}>
                <Save className="size-4" /> Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Satellite className="size-5" />
              </div>
              <div>
                {editing ? (
                  <Input
                    value={(form.name as string) ?? ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                ) : (
                  <CardTitle className="text-xl">{asset.name}</CardTitle>
                )}
                <p className="text-xs text-muted-foreground">
                  {ASSET_TYPES.find((t) => t.value === asset.asset_type)?.label}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <Select value={form.asset_type as string} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={form.status as string} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_STATUSES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Mission">
                    <Input value={(form.mission_name as string) ?? ""} onChange={(e) => setForm({ ...form, mission_name: e.target.value })} />
                  </Field>
                  <Field label="Orbit / Location">
                    <Input value={(form.orbit_type as string) ?? ""} onChange={(e) => setForm({ ...form, orbit_type: e.target.value })} />
                  </Field>
                  <Field label="Operator">
                    <Input value={(form.operator as string) ?? ""} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
                  </Field>
                  <Field label="Launch date">
                    <Input type="date" value={(form.launch_date as string) ?? ""} onChange={(e) => setForm({ ...form, launch_date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Description">
                  <Textarea
                    rows={4}
                    value={(form.description as string) ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info label="Mission" value={asset.mission_name} />
                <Info label="Orbit / Location" value={asset.orbit_type} />
                <Info label="Operator" value={asset.operator} />
                <Info label="Launch date" value={asset.launch_date} />
                <Info
                  label="Status"
                  value={ASSET_STATUSES.find((s) => s.value === asset.status)?.label ?? asset.status}
                />
                <Info label="Created" value={new Date(asset.created_at).toLocaleDateString()} />
                <div className="col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Description
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">
                    {asset.description || <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-primary" /> Related incidents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(incidents ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No incidents linked to this asset.</p>
            )}
            {(incidents ?? []).map((i) => (
              <Link
                key={i.id}
                to="/incidents/$incidentId"
                params={{ incidentId: i.id }}
                className="block rounded-md border p-3 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {i.incident_number}
                  </span>
                  <PriorityBadge priority={i.priority} />
                </div>
                <div className="mt-1 truncate text-sm font-medium">{i.title}</div>
                <div className="mt-1.5">
                  <StatusBadge status={i.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
