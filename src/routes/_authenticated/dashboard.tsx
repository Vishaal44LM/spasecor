import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  PlusCircle,
  Activity,
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  Hammer,
  Archive,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Spasecor" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();

  const { data: incidents } = useQuery({
    queryKey: ["incidents-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*, space_assets(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: activity } = useQuery({
    queryKey: ["activity-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["reports-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_reports")
        .select("*, incidents(incident_number, title)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const all = incidents ?? [];
  const count = (s: string) => all.filter((i) => i.status === s).length;

  const trend = Array.from({ length: 14 }).map((_, idx) => {
    const day = startOfDay(subDays(new Date(), 13 - idx));
    const dayEnd = new Date(day.getTime() + 86_400_000);
    const created = all.filter(
      (i) => new Date(i.created_at) >= day && new Date(i.created_at) < dayEnd,
    ).length;
    return { date: format(day, "MMM d"), incidents: created };
  });

  const stats = [
    { label: "Total", value: all.length, icon: ShieldAlert, tone: "text-foreground" },
    { label: "Open", value: count("open"), icon: AlertOctagon, tone: "text-foreground" },
    { label: "Assigned", value: count("assigned"), icon: UserCheck, tone: "text-info" },
    { label: "Investigating", value: count("investigating"), icon: Search, tone: "text-warning-foreground" },
    {
      label: "Mitigation",
      value: count("mitigation_in_progress"),
      icon: Hammer,
      tone: "text-primary",
    },
    { label: "Resolved", value: count("resolved"), icon: CheckCircle2, tone: "text-success" },
    { label: "Closed", value: count("closed"), icon: Archive, tone: "text-muted-foreground" },
    {
      label: "Critical",
      value: all.filter((i) => i.priority === "critical").length,
      icon: TrendingUp,
      tone: "text-destructive",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {profile?.organizations?.name ?? "Organization"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {profile?.name?.split(" ")[0] || "Operator"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mission-critical incident operations at a glance.
          </p>
        </div>
        <Button asChild>
          <Link to="/incidents/new">
            <PlusCircle className="size-4" /> New incident
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </span>
              <s.icon className={`size-4 ${s.tone}`} />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Incident trend</CardTitle>
            <CardDescription>Incidents created in the last 14 days</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="incidents"
                  stroke="var(--color-primary)"
                  fill="url(#g)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Audit-grade event stream</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(activity ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
            {(activity ?? []).map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Activity className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="truncate font-medium">{a.action}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.entity_type ?? "system"} ·{" "}
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent incidents</CardTitle>
              <CardDescription>Latest 8 incidents across your organization</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/incidents">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border">
              {all.slice(0, 8).map((i) => (
                <Link
                  key={i.id}
                  to="/incidents/$incidentId"
                  params={{ incidentId: i.id }}
                  className="grid grid-cols-[110px_1fr_auto_auto] items-center gap-4 px-3 py-2.5 hover:bg-muted/40"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {i.incident_number}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{i.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {i.threat_category}
                      {(i.space_assets as { name?: string } | null)?.name
                        ? ` · ${(i.space_assets as { name: string }).name}`
                        : ""}
                    </div>
                  </div>
                  <PriorityBadge priority={i.priority} />
                  <StatusBadge status={i.status} />
                </Link>
              ))}
              {all.length === 0 && (
                <div className="px-3 py-12 text-center text-sm text-muted-foreground">
                  No incidents yet.{" "}
                  <Link to="/incidents/new" className="text-primary hover:underline">
                    Create your first incident
                  </Link>
                  .
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent reports</CardTitle>
            <CardDescription>Generated incident reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(reports ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            )}
            {(reports ?? []).map((r) => (
              <Link
                key={r.id}
                to="/incidents/$incidentId"
                params={{ incidentId: r.incident_id }}
                className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/40"
              >
                <Clock className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {(r.incidents as { incident_number?: string } | null)?.incident_number ?? ""}{" "}
                    · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
