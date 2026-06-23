import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INCIDENT_STAGES, STAGE_LABELS } from "@/lib/incident-constants";
import { PriorityBadge } from "@/components/status-badge";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({ meta: [{ title: "Incident board — Spasecor" }] }),
  component: Board,
});

function Board() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: incidents } = useQuery({
    queryKey: ["incidents-board"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*, space_assets(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function onDrop(e: React.DragEvent, stage: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const incident = (incidents ?? []).find((i) => i.id === id);
    if (!incident || incident.status === stage) return;
    const { error } = await supabase
      .from("incidents")
      .update({ status: stage as never })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (profile?.organization_id) {
      await logActivity({
        organizationId: profile.organization_id,
        incidentId: id,
        action: `Status changed to ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}`,
        entityType: "incident",
        entityId: id,
      });
    }
    qc.invalidateQueries({ queryKey: ["incidents-board"] });
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incident board</h1>
        <p className="text-sm text-muted-foreground">
          Drag incidents across stages to move them through the workflow.
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {INCIDENT_STAGES.map((stage) => {
          const items = (incidents ?? []).filter((i) => i.status === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, stage)}
              className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30"
            >
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <div className="text-sm font-semibold">{STAGE_LABELS[stage]}</div>
                <span className="rounded-full bg-background px-2 py-0.5 font-mono text-xs">
                  {items.length}
                </span>
              </div>
              <div className="flex max-h-[calc(100vh-220px)] flex-col gap-2 overflow-y-auto p-2">
                {items.map((i) => (
                  <Link
                    key={i.id}
                    to="/incidents/$incidentId"
                    params={{ incidentId: i.id }}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                    className="cursor-grab rounded-lg border bg-card p-3 shadow-sm hover:border-primary/40 active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{i.incident_number}</span>
                      <PriorityBadge priority={i.priority} />
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-sm font-medium">{i.title}</div>
                    <div className="mt-1.5 truncate text-xs text-muted-foreground">
                      {i.threat_category}
                      {(i.space_assets as { name?: string } | null)?.name
                        ? ` · ${(i.space_assets as { name: string }).name}`
                        : ""}
                    </div>
                  </Link>
                ))}
                {items.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
