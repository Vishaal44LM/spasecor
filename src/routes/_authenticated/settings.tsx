import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Spasecor" }] }),
  component: Settings,
});

function Settings() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setOrg((profile.organizations as { name?: string } | null)?.name ?? "");
    }
  }, [profile]);

  async function save() {
    if (!profile) return;
    await supabase.from("profiles").update({ name }).eq("id", profile.id);
    if (profile.organization_id) {
      await supabase.from("organizations").update({ name: org }).eq("id", profile.organization_id);
    }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function resetPw() {
    if (!profile?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Reset link sent to your email");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={profile?.email ?? ""} disabled />
          </Field>
          <Field label="Organization">
            <Input value={org} onChange={(e) => setOrg(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Reset your password via email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={resetPw}>Send password reset email</Button>
        </CardContent>
      </Card>
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
