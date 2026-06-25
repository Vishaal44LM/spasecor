import { useNavigate } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_THREAT_CATEGORIES, PRIORITIES } from "@/lib/incident-constants";
import { useProfile } from "@/hooks/use-profile";
import { logActivity, notify } from "@/lib/activity";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function NewIncident() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: assets } = useQuery({
    queryKey: ["assets-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("space_assets")
        .select("id, name, asset_type")
        .eq("archived", false)
        .order("name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    asset_id: "",
    threat_category: "",
    custom_category: "",
    priority: "medium",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profile?.organization_id) return;
    const category = form.threat_category === "__custom" ? form.custom_category : form.threat_category;
    if (!category) return toast.error("Pick a threat category");
    if (!form.asset_id) return toast.error("Link an asset");
    setSaving(true);
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        organization_id: profile.organization_id,
        title: form.title,
        description: form.description,
        asset_id: form.asset_id,
        threat_category: category,
        priority: form.priority as never,
        created_by: profile.id,
      } as never)
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logActivity({
      organizationId: profile.organization_id,
      incidentId: data!.id,
      action: "Incident created",
      entityType: "incident",
      entityId: data!.id,
      details: { title: form.title, priority: form.priority },
    });
    await notify({
      organizationId: profile.organization_id,
      userId: profile.id,
      type: "incident_created",
      title: `Incident ${data!.incident_number} created`,
      message: form.title,
      link: `/incidents/${data!.id}`,
    });
    toast.success(`Incident ${data!.incident_number} created`);
    navigate({ to: "/incidents/$incidentId", params: { incidentId: data!.id } });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/incidents" })}>
        <ArrowLeft className="size-4" /> Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Create incident</CardTitle>
          <CardDescription>
            Capture the essentials. You can attach evidence and run analysis after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Suspected GPS spoofing on Sat-NORDIC-3"
                required
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What happened, when was it detected, observed effects on the mission…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Linked asset">
                <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    {(assets ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Threat category">
              <Select value={form.threat_category} onValueChange={(v) => setForm({ ...form, threat_category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_THREAT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__custom">+ Custom category…</SelectItem>
                </SelectContent>
              </Select>
              {form.threat_category === "__custom" && (
                <Input
                  className="mt-2"
                  value={form.custom_category}
                  onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                  placeholder="Custom threat category"
                />
              )}
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => navigate({ to: "/incidents" })}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>Create incident</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
