import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity as ActivityIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity & audit — Spasecor" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data } = useQuery({
    queryKey: ["activity-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*, profiles(name), incidents(incident_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity & audit</h1>
        <p className="text-sm text-muted-foreground">
          Immutable audit log of every action across your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="size-4 text-primary" /> Audit trail
          </CardTitle>
          <CardDescription>Most recent 200 events</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-3 border-l pl-5">
            {(data ?? []).map((a) => {
              const incident = a.incidents as { incident_number?: string } | null;
              return (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[22px] mt-2 size-2.5 rounded-full bg-primary" />
                  <div className="rounded-md border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium">{a.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{(a.profiles as { name?: string } | null)?.name ?? "system"}</span>
                      {a.entity_type && <span>· {a.entity_type}</span>}
                      {incident?.incident_number && (
                        <>
                          <span>·</span>
                          <Link
                            to="/incidents/$incidentId"
                            params={{ incidentId: a.incident_id! }}
                            className="font-mono text-primary hover:underline"
                          >
                            {incident.incident_number}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {(data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
