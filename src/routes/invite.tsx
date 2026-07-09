import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrandWordmark } from "@/components/brand";
import { Link, useNavigate, useSearch } from "@/lib/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InvitePage() {
  const { token } = useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Checking invitation…");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setError("Missing invite token");
        return;
      }

      const { data, error: inviteErr } = await supabase
        .from("organization_invitations")
        .select("id, organization_id, email, role, expires_at, accepted_at")
        .eq("token", token)
        .maybeSingle();

      if (!mounted) return;
      if (inviteErr || !data) return setError("Invite not found or expired");
      if (data.accepted_at) return setError("This invitation has already been accepted");
      if (new Date(data.expires_at) < new Date()) return setError("This invitation has expired");

      const { data: u } = await supabase.auth.getUser();

      if (u.user) {
        // If signed in with a different account, sign out and route to signup
        if (u.user.email && u.user.email.toLowerCase() !== data.email.toLowerCase()) {
          setStatus("Signing out to accept invitation…");
          await supabase.auth.signOut();
          navigate({ to: "/auth", search: { mode: "signup", token } });
          return;
        }
        setStatus("Joining organization…");
        const { error: acceptErr } = await supabase.rpc("accept_invitation", { _token: token });
        if (acceptErr) return setError(acceptErr.message);
        toast.success("Joined the organization");
        navigate({ to: "/dashboard" });
        return;
      }

      // Not signed in — send to Create account with details prefilled
      setStatus("Redirecting to create account…");
      navigate({ to: "/auth", search: { mode: "signup", token } });
    })();
    return () => {
      mounted = false;
    };
  }, [token, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandWordmark size="md" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Organization invitation</CardTitle>
            <CardDescription>Processing your invitation link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <>
                <p className="text-sm text-destructive">{error}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Back to home</Link>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {status}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
