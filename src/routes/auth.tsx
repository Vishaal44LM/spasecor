import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandWordmark } from "@/components/brand";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useSearch } from "@/lib/navigation";

export function AuthPage() {
  const { mode, redirect } = useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPw, setSignInPw] = useState("");

  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPw, setSignUpPw] = useState("");

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
      if (message.includes("failed to fetch") || message.includes("load failed")) {
        return toast.error("Authentication failed to load. Check your connection and try again.");
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
        data: { name, organization: org },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (!data.session) {
      // auto-confirm on; sign in immediately if session was not returned
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signUpEmail,
        password: signUpPw,
      });
      if (signInError) {
        setLoading(false);
        return toast.error(signInError.message);
      }
    }
    setLoading(false);
    toast.success("Account created");
    navigate({ to: "/dashboard" });
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
          <BrandWordmark size="md" />
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
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45) 0%, transparent 45%), radial-gradient(circle at 80% 75%, rgba(255,255,255,0.3) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm font-medium tracking-[0.2em] opacity-90">
            <span className="size-1.5 rounded-full bg-primary-foreground" />
            SPASECOR
          </div>
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-medium backdrop-blur">
              Space Cyber Incident Management
            </div>
            <blockquote className="text-3xl font-semibold leading-tight tracking-tight">
              One source of truth for every cyber incident across your constellation.
            </blockquote>
            <p className="max-w-md text-sm leading-relaxed opacity-80">
              Triage, investigate, and resolve threats to satellites and ground systems with a
              workflow built for mission security teams.
            </p>
          </div>
          <div className="grid max-w-md grid-cols-1 gap-3 text-sm">
            {[
              ["Incident workflow", "Six-stage board from detection to closure"],
              ["AI investigation", "Threat analysis and mitigation guidance"],
              ["Evidence & reports", "Secure storage and audit-ready exports"],
            ].map(([t, d]) => (
              <div
                key={t}
                className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-3 backdrop-blur"
              >
                <div className="font-medium">{t}</div>
                <div className="mt-0.5 text-xs opacity-75">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
