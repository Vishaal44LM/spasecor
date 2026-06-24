import { cn } from "@/lib/utils";
import logo from "@/assets/spasecor-logo.png.asset.json";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, string> = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-24 w-24",
  xl: "h-36 w-36",
};

const TEXT_MAP: Record<Size, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-3xl",
  xl: "text-5xl",
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
      src={logo.url}
      alt="Spasecor"
      className={cn(SIZE_MAP[size], "object-contain shrink-0", className)}
    />
  );
}

export function BrandWordmark({
  size = "md",
  className,
}: {
  subtle?: boolean;
  size?: Size;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <BrandMark size={size} />
      <div
        className={cn(
          "font-semibold tracking-tight leading-none",
          TEXT_MAP[size],
        )}
      >
        Spasecor
      </div>
    </div>
  );
}
