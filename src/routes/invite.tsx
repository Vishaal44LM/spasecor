import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrandWordmark } from "@/components/brand";
import { Link, useNavigate, useSearch } from "@/lib/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Invite = {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  organizations?: { name: string } | null;
};

export function InvitePage() {
  const { token } = useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setError("Missing invite token");
        setLoading(false);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!mounted) return;
      setSignedIn(!!u.user);

      const { data, error } = await supabase
        .from("organization_invitations")
        .select("id, organization_id, email, role, expires_at, accepted_at, organizations(name)")
        .eq("token", token)
        .maybeSingle();
      if (!mounted) return;
      if (error || !data) {
        setError("Invite not found or expired");
      } else if (data.accepted_at) {
        setError("This invitation has already been accepted");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired");
      } else {
        setInvite(data as unknown as Invite);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    const { error } = await supabase.rpc("accept_invitation", { _token: token });
    setAccepting(false);
    if (error) return toast.error(error.message);
    toast.success("Joined the organization");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandWordmark size="md" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Organization invitation</CardTitle>
            <CardDescription>
              {invite?.organizations?.name
                ? `You've been invited to join ${invite.organizations.name}.`
                : "Review your invitation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading invitation…
              </div>
            ) : error ? (
              <>
                <p className="text-sm text-destructive">{error}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Back to home</Link>
                </Button>
              </>
            ) : invite ? (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium">{invite.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Role:</span>{" "}
                    <span className="font-medium capitalize">{invite.role.replace(/_/g, " ")}</span>
                  </div>
                </div>
                {signedIn ? (
                  <Button className="w-full" onClick={accept} disabled={accepting}>
                    {accepting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Accept invitation
                  </Button>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Sign in or create your account with <b>{invite.email}</b> to accept.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild variant="outline">
                        <Link to="/auth" search={{ token }}>
                          Sign in
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link to="/auth" search={{ mode: "signup", token }}>
                          Create account
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
