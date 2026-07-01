import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin, type AppRole } from "@/hooks/use-role";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Trash2, Copy, Loader2 } from "lucide-react";

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrator" },
  { value: "mission_manager", label: "Mission Manager" },
  { value: "security_analyst", label: "Security Analyst" },
  { value: "satellite_engineer", label: "Satellite Engineer" },
  { value: "viewer", label: "Viewer" },
];

export function Settings() {
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

      <MembersCard organizationId={profile?.organization_id ?? null} />
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

function MembersCard({ organizationId }: { organizationId: string | null }) {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("security_analyst");
  const [creating, setCreating] = useState(false);

  const members = useQuery({
    queryKey: ["org-members", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, name, email").eq("organization_id", organizationId!),
        supabase.from("user_roles").select("user_id, role, id").eq("organization_id", organizationId!),
      ]);
      return { profiles: profiles ?? [], roles: roles ?? [] };
    },
  });

  const invites = useQuery({
    queryKey: ["org-invites", organizationId],
    enabled: !!organizationId && isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_invitations")
        .select("*")
        .eq("organization_id", organizationId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!organizationId || !inviteEmail) return;
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("organization_invitations").insert({
      organization_id: organizationId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: u.user?.id ?? null,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Invitation created");
    setInviteEmail("");
    qc.invalidateQueries({ queryKey: ["org-invites", organizationId] });
  }

  async function revokeInvite(id: string) {
    await supabase.from("organization_invitations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["org-invites", organizationId] });
  }

  async function updateRole(userId: string, oldRoleId: string, newRole: AppRole) {
    if (!organizationId) return;
    await supabase.from("user_roles").delete().eq("id", oldRoleId);
    await supabase.from("user_roles").insert({
      user_id: userId,
      organization_id: organizationId,
      role: newRole,
    });
    qc.invalidateQueries({ queryKey: ["org-members", organizationId] });
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  if (!organizationId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {isAdmin
            ? "Invite people, assign roles, and manage access to your organization."
            : "People with access to this organization."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-medium">Team members</div>
          <div className="rounded-md border">
            {members.data?.profiles.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No members yet.</div>
            ) : (
              members.data?.profiles.map((p) => {
                const roleRows = members.data.roles.filter((r) => r.user_id === p.id);
                const primary = roleRows[0];
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name || p.email}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                    </div>
                    {isAdmin && primary ? (
                      <Select
                        value={primary.role as AppRole}
                        onValueChange={(v) => updateRole(p.id, primary.id, v as AppRole)}
                      >
                        <SelectTrigger className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-xs capitalize text-muted-foreground">
                        {(primary?.role as string)?.replace(/_/g, " ") || "no role"}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Invite a new member</div>
            <form onSubmit={createInvite} className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="email@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send invite
              </Button>
            </form>

            {invites.data && invites.data.length > 0 && (
              <div className="rounded-md border">
                <div className="border-b p-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pending invitations
                </div>
                {invites.data.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 border-b p-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{inv.email}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {String(inv.role).replace(/_/g, " ")} · expires{" "}
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyLink(inv.token as string)}
                        title="Copy invite link"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => revokeInvite(inv.id)}
                        title="Revoke"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
