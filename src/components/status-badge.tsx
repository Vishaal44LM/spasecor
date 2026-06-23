import { cn } from "@/lib/utils";
import { STAGE_LABELS, type IncidentStage, type Priority, PRIORITY_LABELS } from "@/lib/incident-constants";

const STAGE_STYLES: Record<IncidentStage, string> = {
  open: "bg-muted text-foreground/80 ring-border",
  assigned: "bg-info/10 text-info ring-info/20",
  investigating: "bg-warning/15 text-warning-foreground ring-warning/30",
  mitigation_in_progress: "bg-primary/10 text-primary ring-primary/20",
  resolved: "bg-success/10 text-success ring-success/20",
  closed: "bg-foreground/5 text-muted-foreground ring-border",
};

export function StatusBadge({ status, className }: { status: IncidentStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STAGE_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STAGE_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground ring-border",
  medium: "bg-info/10 text-info ring-info/20",
  high: "bg-warning/20 text-warning-foreground ring-warning/30",
  critical: "bg-destructive/10 text-destructive ring-destructive/20",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
