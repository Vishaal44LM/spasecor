import { cn } from "@/lib/utils";
import logo from "@/assets/spasecor-logo.png.asset.json";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, string> = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-40 w-40",
  xl: "h-56 w-56",
};

const TEXT_MAP: Record<Size, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-4xl",
  xl: "text-6xl",
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
    <div className={cn("flex flex-col items-center gap-2", className)}>
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
