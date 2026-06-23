import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 2 L12 22 M2 12 L22 12" strokeLinecap="round" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="9" strokeDasharray="2 3" opacity="0.6" />
      </svg>
    </div>
  );
}

export function BrandWordmark({ subtle = false }: { subtle?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Spasecor</div>
        {!subtle && (
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Space Cyber Ops
          </div>
        )}
      </div>
    </div>
  );
}
