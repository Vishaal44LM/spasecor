import { cn } from "@/lib/utils";
import logo from "@/assets/spasecor-logo.png.asset.json";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Spasecor"
      className={cn("size-8 object-contain", className)}
      aria-hidden
    />
  );
}

export function BrandWordmark({
  subtle: _subtle = false,
  className,
}: {
  subtle?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <BrandMark />
      <div className="text-[15px] font-semibold tracking-tight leading-none">Spasecor</div>
    </div>
  );
}
