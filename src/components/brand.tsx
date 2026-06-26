import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const MARK_SIZE: Record<Size, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

const TEXT_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: Size;
}) {
  return (
    <img
      src="/spasecor-logo.png"
      alt="Spasecor"
      className={cn(MARK_SIZE[size], "object-contain shrink-0", className)}
    />
  );
}

export function BrandWordmark({
  size = "md",
  className,
  orientation = "horizontal",
}: {
  size?: Size;
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  if (orientation === "vertical") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <BrandMark size={size} />
        <div className={cn("font-semibold tracking-tight leading-none", TEXT_SIZE[size])}>
          Spasecor
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <BrandMark size={size} />
      <span className={cn("font-semibold tracking-tight leading-none", TEXT_SIZE[size])}>
        Spasecor
      </span>
    </div>
  );
}
