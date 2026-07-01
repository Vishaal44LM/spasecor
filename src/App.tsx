import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RouterProvider, Link } from "@/lib/navigation";
import { ThemeProvider } from "@/lib/theme";
import { Landing } from "@/routes";
import { AuthPage } from "@/routes/auth";
import { ResetPasswordPage } from "@/routes/reset-password";
import { InvitePage } from "@/routes/invite";
import { AuthedLayout } from "@/routes/_authenticated/route";
import { Dashboard } from "@/routes/_authenticated/dashboard";
import { Board } from "@/routes/_authenticated/board";
import { IncidentsList } from "@/routes/_authenticated/incidents";
import { NewIncident } from "@/routes/_authenticated/incidents/new";
import { IncidentDetail } from "@/routes/_authenticated/incidents/$incidentId";
import { AssetsList } from "@/routes/_authenticated/assets";
import { AssetDetail } from "@/routes/_authenticated/assets/$assetId";
import { Analytics } from "@/routes/_authenticated/analytics";
import { ActivityPage } from "@/routes/_authenticated/activity";
import { Settings } from "@/routes/_authenticated/settings";
import { MissionRoom } from "@/routes/_authenticated/mission/$incidentId";
import { DecisionsPage } from "@/routes/_authenticated/decisions";
import { EvidenceVault } from "@/routes/_authenticated/evidence";

type Match = {
  component: ComponentType;
  params?: Record<string, string>;
  protected?: boolean;
  title: string;
  bare?: boolean;
};

const queryClient = new QueryClient();

const protectedRoutes: Array<{
  pattern: RegExp;
  title: string;
  component: ComponentType;
  names?: string[];
  bare?: boolean;
}> = [
  { pattern: /^\/dashboard$/, title: "Dashboard — Spasecor", component: Dashboard },
  { pattern: /^\/board$/, title: "Incident board — Spasecor", component: Board },
  { pattern: /^\/incidents$/, title: "Incidents — Spasecor", component: IncidentsList },
  { pattern: /^\/incidents\/new$/, title: "New incident — Spasecor", component: NewIncident },
  { pattern: /^\/incidents\/([^/]+)$/, title: "Incident — Spasecor", component: IncidentDetail, names: ["incidentId"] },
  { pattern: /^\/mission\/([^/]+)$/, title: "Mission Room — Spasecor", component: MissionRoom, names: ["incidentId"] },
  { pattern: /^\/decisions$/, title: "Decisions — Spasecor", component: DecisionsPage },
  { pattern: /^\/evidence$/, title: "Evidence Vault — Spasecor", component: EvidenceVault },
  { pattern: /^\/assets$/, title: "Space assets — Spasecor", component: AssetsList },
  { pattern: /^\/assets\/([^/]+)$/, title: "Asset — Spasecor", component: AssetDetail, names: ["assetId"] },
  { pattern: /^\/analytics$/, title: "Analytics — Spasecor", component: Analytics },
  { pattern: /^\/activity$/, title: "Activity & audit — Spasecor", component: ActivityPage },
  { pattern: /^\/settings$/, title: "Settings — Spasecor", component: Settings },
];

function getCurrentMatch(): Match {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (pathname === "/") return { component: Landing, title: "Spasecor — Space Cyber Incident Management Platform" };
  if (pathname === "/auth") return { component: AuthPage, title: "Sign in — Spasecor" };
  if (pathname === "/reset-password") return { component: ResetPasswordPage, title: "Reset password — Spasecor" };

  for (const route of protectedRoutes) {
    const match = pathname.match(route.pattern);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.names?.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1] ?? "");
    });
    return { component: route.component, title: route.title, params, protected: true };
  }

  return { component: NotFound, title: "Page not found — Spasecor" };
}

export default function App() {
  const [locationKey, setLocationKey] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const update = () => setLocationKey((v) => v + 1);
    window.addEventListener("popstate", update);
    window.addEventListener("spasecor:navigate", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("spasecor:navigate", update);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(!!data.user);
      setSessionReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSignedIn(!!session?.user);
      if (event === "SIGNED_OUT") queryClient.clear();
      else queryClient.invalidateQueries();
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const match = useMemo(() => {
    void locationKey;
    return getCurrentMatch();
  }, [locationKey]);

  useEffect(() => {
    document.title = match.title;
  }, [match.title]);

  const Page = match.component;

  useEffect(() => {
    if (!match.protected || !sessionReady || signedIn) return;
    const redirect = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, "", `/auth?redirect=${encodeURIComponent(redirect)}`);
    window.dispatchEvent(new Event("spasecor:navigate"));
  }, [match.protected, sessionReady, signedIn]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider params={match.params}>
        {match.protected ? (
          sessionReady && signedIn ? (
            <AuthedLayout>
              <Page />
            </AuthedLayout>
          ) : (
            <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
              Loading workspace…
            </div>
          )
        ) : (
          <Page />
        )}
        <Toaster richColors position="top-right" />
      </RouterProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}