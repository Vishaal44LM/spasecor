import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandWordmark } from "@/components/brand";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { Link, useNavigate, useSearch } from "@/lib/navigation";

export function AuthPage() {
  const { mode, redirect, confirmed } = useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPw, setSignInPw] = useState("");

  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPw, setSignUpPw] = useState("");

  useEffect(() => {
    if (confirmed === "1") toast.success("Email confirmed. You can sign in now.");
  }, [confirmed]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) toast.error(error.message);
        else {
          toast.success("Email confirmed. Welcome to Spasecor.");
          navigate({ to: "/dashboard", replace: true });
        }
      });
      return;
    }

    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) toast.error(error.message);
      else {
        toast.success("Email confirmed. Welcome to Spasecor.");
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPw,
    });
    setLoading(false);
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("email not confirmed")) {
        setConfirmEmail(signInEmail);
        return toast.error("Please confirm your email before signing in. You can resend the confirmation email below.");
      }
      if (message.includes("failed to fetch") || message.includes("load failed")) {
        return toast.error("Authentication failed to load. Verify your Vercel Supabase environment variables and try again.");
      }
      return toast.error(error.message);
    }
    toast.success("Welcome back");
    navigate({ to: redirect || "/dashboard" });
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (signUpPw.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPw,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?confirmed=1`,
        data: { name, organization: org },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("Account created");
      return navigate({ to: "/dashboard" });
    }
    setConfirmEmail(signUpEmail);
    setSignInEmail(signUpEmail);
    setTab("signin");
    toast.success("Account created. Confirm your email, then sign in.");
  }

  async function resendConfirmation(email = confirmEmail || signInEmail || signUpEmail) {
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth?confirmed=1` },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("security purposes")) {
        return toast.error("A confirmation email was sent recently. Please wait before resending.");
      }
      return toast.error(error.message);
    }
    toast.success("Confirmation email sent");
  }

  async function handleForgot() {
    if (!signInEmail) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(signInEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 lg:p-12">
        <Link to="/" className="inline-block">
          <BrandWordmark size="lg" />
        </Link>
        <div className="mx-auto w-full max-w-md">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-8">
              <h1 className="text-2xl font-semibold tracking-tight">Sign in to Spasecor</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Access your organization's incident operations.
              </p>
              <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Work email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    autoComplete="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="si-pw">Password</Label>
                    <button
                      type="button"
                      onClick={handleForgot}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="si-pw"
                    type="password"
                    autoComplete="current-password"
                    value={signInPw}
                    onChange={(e) => setSignInPw(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}Sign in
                </Button>
                {confirmEmail && (
                  <div className="rounded-lg border bg-primary/5 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MailCheck className="mt-0.5 size-4 text-primary" />
                      <div>
                        <p className="font-medium">Email confirmation required</p>
                        <p className="text-muted-foreground">
                          Confirm {confirmEmail} from your inbox before signing in.
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-primary"
                          onClick={() => resendConfirmation(confirmEmail)}
                          disabled={loading}
                        >
                          Resend confirmation email
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-8">
              <h1 className="text-2xl font-semibold tracking-tight">Create your organization</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Spin up a Spasecor workspace for your space cyber team.
              </p>
              <form onSubmit={handleSignUp} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Your name</Label>
                    <Input
                      id="su-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-org">Organization</Label>
                    <Input
                      id="su-org"
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                      placeholder="ACME Aerospace"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Work email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input
                    id="su-pw"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={signUpPw}
                    onChange={(e) => setSignUpPw(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <div className="text-xs text-muted-foreground">
          By signing in you agree to operate Spasecor responsibly.
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="text-sm font-medium tracking-wide opacity-90">SPASECOR</div>
          <div>
            <blockquote className="text-2xl font-medium leading-snug">
              "We finally have a single source of truth for every cyber incident across our
              constellation — from initial detection to post-mission review."
            </blockquote>
            <div className="mt-6 text-sm opacity-80">
              Director of Mission Security — global satellite operator
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {[
              ["238", "Active satellites tracked"],
              ["1.2k", "Incidents resolved"],
              ["14m", "Avg time to mitigate"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-lg bg-white/10 p-3 backdrop-blur">
                <div className="font-mono text-2xl font-semibold">{n}</div>
                <div className="mt-1 opacity-80">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
