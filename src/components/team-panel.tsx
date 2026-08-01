import { Link } from "@/lib/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { useTeam, ROLE_LABELS, initialsOf } from "@/hooks/use-team";

type WorkloadIncident = {
  assigned_to: string | null;
  status: string;
};

const CLOSED = new Set(["resolved", "closed"]);

export function TeamPanel({ incidents = [] }: { incidents?: WorkloadIncident[] }) {
  const { data: team, isLoading } = useTeam();

  const openFor = (id: string) =>
    incidents.filter((i) => i.assigned_to === id && !CLOSED.has(i.status)).length;
  const unassigned = incidents.filter((i) => !i.assigned_to && !CLOSED.has(i.status)).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Your team
          </CardTitle>
          <CardDescription>
            Everyone here shares this workspace and sees the same incidents.
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings">
            <UserPlus className="size-4" /> Invite
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading team…</p>}
        {!isLoading && (team ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No teammates yet.</p>
        )}
        {(team ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initialsOf(m.name || m.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.name || m.email}</div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {m.roles.length === 0 && (
                  <span className="text-xs text-muted-foreground">No role assigned</span>
                )}
                {m.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px]">
                    {ROLE_LABELS[r] ?? r}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-sm font-semibold">{openFor(m.id)}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">open</div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm">
          <span className="text-muted-foreground">Unassigned open incidents</span>
          <Link to="/incidents" className="font-mono font-semibold text-primary hover:underline">
            {unassigned}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
