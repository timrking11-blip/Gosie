import { useState } from "react";
import { cn } from "@/lib/utils";
import { GooseMark } from "./Logo";

const items = [
  { day: "Mon", time: "09:30", title: "Quarterly planning review", cat: "Work", tone: "bg-mist" },
  { day: "Mon", time: "18:00", title: "Climbing session", cat: "Personal", tone: "bg-sage" },
  { day: "Tue", time: "11:00", title: "Design critique · Atlas", cat: "Work", tone: "bg-mist" },
  { day: "Wed", time: "08:00", title: "Dentist", cat: "Errands", tone: "bg-gold" },
  { day: "Wed", time: "14:00", title: "Draft board memo", cat: "Work", tone: "bg-mist" },
  { day: "Thu", time: "19:30", title: "Dinner with Sam & Priya", cat: "Personal", tone: "bg-sage" },
  { day: "Fri", time: "16:00", title: "Renew passport form", cat: "Errands", tone: "bg-gold" },
];

const busy = [2, 3, 1, 3, 2, 0, 1, 3, 4, 2, 1, 2, 0, 0, 1, 2, 3, 2, 2, 1, 0, 3, 2, 4, 1, 1, 0, 0];

export function WeekMock({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<"category" | "chrono">("category");
  const groups = view === "category" ? ["Work", "Personal", "Errands"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-midnight text-cream shadow-float">
      <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-moon" />
      <div className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full border border-mist/10" />
      <div className="relative grid gap-3 p-4 sm:p-5 md:grid-cols-[150px_1fr]">
        {!compact && (
          <aside className="hidden flex-col gap-1 text-xs text-cream/60 md:flex">
            <div className="mb-3 flex items-center gap-2 text-cream">
              <GooseMark className="h-5 w-5" tone="cream" />
              <span className="font-serif text-sm">gosie.</span>
            </div>
            {["Week Ahead", "Weekend Ahead", "Digest", "Preferences"].map((l, i) => (
              <span key={l} className={cn("rounded-md px-2 py-1.5", i === 0 && "bg-cream/10 text-cream")}>{l}</span>
            ))}
          </aside>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-mist/80">Week of 9 November</p>
              <h4 className="font-serif text-xl sm:text-2xl">Your week, in perspective</h4>
            </div>
            <div role="tablist" aria-label="Group week by" className="flex rounded-full bg-cream/5 p-1 text-xs">
              {(["category", "chrono"] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn("rounded-full px-3 py-1 transition-colors", view === v ? "bg-mist text-ink" : "text-cream/70 hover:text-cream")}
                >
                  {v === "category" ? "Category" : "Chronological"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
            <div className="glass rounded-xl p-3">
              <div className="mb-2 flex justify-between text-[10px] uppercase tracking-widest text-cream/50">
                <span>Monthly grid</span><span>Nov</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {busy.map((b, i) => (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-[4px]",
                      i >= 7 && i < 14 ? "ring-1 ring-mist/50" : "",
                      ["bg-cream/5", "bg-mist/15", "bg-mist/30", "bg-mist/50", "bg-mist/75"][b],
                    )}
                  />
                ))}
              </div>
              {!compact && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-cream/5 p-2">
                    <p className="text-cream/50">Work · Life</p>
                    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
                      <span className="w-[62%] bg-mist" /><span className="w-[38%] bg-sage" />
                    </div>
                    <p className="mt-1 text-cream/80">62 / 38</p>
                  </div>
                  <div className="rounded-lg bg-cream/5 p-2">
                    <p className="text-cream/50">Open evenings</p>
                    <p className="mt-1 font-serif text-lg">3</p>
                  </div>
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-3">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-cream/50">Priority rail</p>
              <ol className="space-y-1.5 text-xs">
                {["Board memo draft by Wed", "Confirm Thursday dinner", "Passport renewal"].map((p, i) => (
                  <li key={p} className="flex items-center gap-2 rounded-lg bg-cream/5 px-2 py-1.5">
                    <span className="font-serif text-mist">{i + 1}</span>{p}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-live="polite">
            {groups.slice(0, compact ? 2 : 3).map((g) => (
              <div key={g} className="glass rounded-xl p-3">
                <p className="mb-2 text-[10px] uppercase tracking-widest text-cream/50">{g}</p>
                <ul className="space-y-1.5">
                  {items
                    .filter((it) => (view === "category" ? it.cat === g : it.day === g))
                    .slice(0, 3)
                    .map((it) => (
                      <li key={it.title} className="flex items-start gap-2 text-xs">
                        <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", it.tone)} />
                        <span className="min-w-0">
                          <span className="block truncate text-cream/90">{it.title}</span>
                          <span className="text-cream/45">{view === "category" ? it.day : it.cat} · {it.time}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>

          {!compact && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-mist/15 bg-mist/5 p-3 text-xs">
              <GooseMark className="h-6 w-6" tone="cream" />
              <p className="text-cream/80">
                <span className="text-cream">Digest:</span> Wednesday is your heaviest day. Moving the memo draft to Tuesday afternoon would leave Thursday evening free.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="relative border-t border-cream/5 px-4 py-2 text-[10px] text-cream/40">Illustrative preview · fictional data</p>
    </div>
  );
}
