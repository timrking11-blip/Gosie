import { cn } from "@/lib/utils";

/** Original gosie. goose mark: graceful neck + head in a circle, tiny peach beak. */
export function GooseMark({ className, tone = "forest" }: { className?: string; tone?: "forest" | "cream" }) {
  const bg = tone === "forest" ? "fill-forest" : "fill-cream";
  const fg = tone === "forest" ? "fill-cream" : "fill-forest";
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden="true">
      <circle cx="32" cy="32" r="32" className={bg} />
      <path
        d="M22 52c-1-9 6-13 8-20 1.6-5.5-3-7.5-3-13 0-5 3.6-8.5 8-8.5 4 0 7 2.7 7.4 6.3-1.5 1.9-4 2.8-6.6 2.8-.6 4.4 3.8 8.6 3.8 15.4 0 7.5-6 12.5-17.6 17Z"
        className={fg}
      />
      <path d="M42.2 15.6l7.6 1.8-7.6 2.4c.4-1.4.4-2.8 0-4.2Z" className="fill-peach" />
      <circle cx="37.2" cy="15.2" r="1.3" className={bg} />
    </svg>
  );
}

export function Wordmark({ className, tone = "forest" }: { className?: string; tone?: "forest" | "cream" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <GooseMark className="h-8 w-8" tone={tone === "forest" ? "forest" : "cream"} />
      <span className={cn("font-serif text-2xl font-medium tracking-tight leading-none", tone === "forest" ? "text-forest" : "text-cream")}>
        gosie<span className="text-peach">.</span>
      </span>
    </span>
  );
}
