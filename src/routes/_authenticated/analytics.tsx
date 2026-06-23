import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { useMemo } from "react";
import { STAGE_LABELS } from "@/lib/incident-constants";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Spasecor" }] }),
  component: Analytics,
});

const COLORS = ["#664EAE", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

function Analytics() {
  const { data: incidents } = useQuery({
    queryKey: ["analytics-incidents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("id, status, priority, threat_category, asset_id, created_at, resolution_date, space_assets(name)");
      return data ?? [];
    },
  });

  const all = incidents ?? [];

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((i) => m.set(i.threat_category, (m.get(i.threat_category) ?? 0) + 1));
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [all]);

  const byPriority = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((i) => m.set(i.priority, (m.get(i.priority) ?? 0) + 1));
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, [all]);

  const byAsset = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((i) => {
      const n = (i.space_assets as { name?: string } | null)?.name ?? "Unassigned";
      m.set(n, (m.get(n) ?? 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [all]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    return months.map((m) => {
      const end = startOfMonth(subMonths(m, -1));
      const created = all.filter((i) => new Date(i.created_at) >= m && new Date(i.created_at) < end).length;
      return { month: format(m, "MMM"), incidents: created };
    });
  }, [all]);

  const openVsClosed = useMemo(() => {
    const closed = all.filter((i) => i.status === "closed" || i.status === "resolved").length;
    return [
      { name: "Open", value: all.length - closed },
      { name: "Closed", value: closed },
    ];
  }, [all]);

  const avgResolution = useMemo(() => {
    const resolved = all.filter((i) => i.resolution_date);
    if (resolved.length === 0) return null;
    const total = resolved.reduce(
      (acc, i) =>
        acc + (new Date(i.resolution_date!).getTime() - new Date(i.created_at).getTime()),
      0,
    );
    return total / resolved.length;
  }, [all]);

  function fmtDuration(ms: number | null) {
    if (!ms) return "—";
    const hours = ms / 3_600_000;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Operational metrics across your space cyber program.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total incidents" value={all.length} />
        <Stat label="Resolved" value={all.filter((i) => i.status === "resolved" || i.status === "closed").length} />
        <Stat label="Critical open" value={all.filter((i) => i.priority === "critical" && i.status !== "closed" && i.status !== "resolved").length} />
        <Stat label="Avg resolution" value={fmtDuration(avgResolution)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidents by category</CardTitle>
            <CardDescription>Distribution across threat categories</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidents by priority</CardTitle>
            <CardDescription>How critical your queue is</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byPriority} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byPriority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly trend</CardTitle>
            <CardDescription>Incidents created per month</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="incidents" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open vs closed</CardTitle>
            <CardDescription>Current state of the queue</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={openVsClosed} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                  {openVsClosed.map((_, i) => <Cell key={i} fill={i === 0 ? "var(--color-warning)" : "var(--color-success)"} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Incidents by asset</CardTitle>
            <CardDescription>Top assets generating incidents</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byAsset}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
