import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const contexts = ["All", "Solo", "Friends", "Date", "Group"] as const;
type Ctx = (typeof contexts)[number];

const ideas = [
  { title: "Late set at a small jazz room", kind: "Music", when: "Sat · evening", budget: "$$", travel: "20 min", fit: { All: 9, Solo: 7, Friends: 7, Date: 10, Group: 5 }, why: "You saved two live-music ideas last month and kept Saturday evening open." },
  { title: "Restored-print film night", kind: "Film", when: "Fri · 8 pm", budget: "$", travel: "12 min", fit: { All: 8, Solo: 10, Friends: 7, Date: 8, Group: 6 }, why: "You rated a classic-cinema idea highly, and it's within your travel bound." },
  { title: "Long lunch, shared plates", kind: "Food", when: "Sun · midday", budget: "$$", travel: "15 min", fit: { All: 8, Solo: 4, Friends: 10, Date: 7, Group: 9 }, why: "Matches your 'unhurried weekends' preference and moderate budget." },
  { title: "Riverside walk & market", kind: "Outdoors", when: "Sun · morning", budget: "Free", travel: "8 min", fit: { All: 7, Solo: 9, Friends: 8, Date: 6, Group: 8 }, why: "A low-key counterweight to a busy week ahead." },
];

export function WeekendMock({ compact = false }: { compact?: boolean }) {
  const [ctx, setCtx] = useState<Ctx>("All");
  const [open, setOpen] = useState<string | null>(null);
  const ranked = [...ideas].sort((a, b) => b.fit[ctx] - a.fit[ctx]);
  const list = compact ? ranked.slice(0, 2) : ranked;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-weekend text-cream shadow-float">
      <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-peach/20 blur-3xl" />
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow text-peach/90">Weekend Ahead</p>
            <h4 className="font-serif text-xl sm:text-2xl">Things to do</h4>
          </div>
          <span className="rounded-full border border-cream/20 px-2.5 py-1 text-[10px] uppercase tracking-widest text-cream/70">Example demo</span>
        </div>

        <div role="group" aria-label="Who's coming" className="mt-4 flex flex-wrap gap-1.5">
          {contexts.map((c) => (
            <button
              key={c}
              aria-pressed={ctx === c}
              onClick={() => setCtx(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-all",
                ctx === c ? "border-peach bg-peach text-espresso" : "border-cream/20 text-cream/80 hover:border-peach/60",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {!compact && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-cream/70">
            {["Budget · up to $$", "Travel · under 25 min", "Pace · unhurried"].map((p) => (
              <span key={p} className="rounded-md bg-cream/10 px-2 py-1">{p}</span>
            ))}
          </div>
        )}

        <p className="mt-3 text-[11px] text-gold" aria-live="polite">
          Re-ranked for <span className="font-semibold">{ctx}</span>
        </p>

        <ul className="mt-2 space-y-2">
          {list.map((it, i) => (
            <li key={it.title} className="rounded-xl border border-cream/10 bg-espresso/60 p-3 backdrop-blur-sm transition-all">
              <div className="flex items-start gap-3">
                <span className="font-serif text-2xl leading-none text-peach">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-gold/90">{it.kind} · {it.when}</p>
                  <p className="font-serif text-base leading-snug">{it.title}</p>
                  <p className="mt-1 text-[11px] text-cream/55">{it.budget} · {it.travel} away</p>
                </div>
                <div className="flex h-1.5 w-12 overflow-hidden rounded-full bg-cream/10" aria-label={`Fit ${it.fit[ctx]} of 10`}>
                  <span className="bg-peach" style={{ width: `${it.fit[ctx] * 10}%` }} />
                </div>
              </div>
              {!compact && (
                <>
                  <button
                    aria-expanded={open === it.title}
                    onClick={() => setOpen(open === it.title ? null : it.title)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-peach hover:text-cream"
                  >
                    Why this idea?
                    <ChevronDown className={cn("h-3 w-3 transition-transform", open === it.title && "rotate-180")} />
                  </button>
                  {open === it.title && <p className="mt-1 text-xs text-cream/75">{it.why}</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative border-t border-cream/10 px-4 py-2 text-[10px] text-cream/45">Illustrative preview · fictional data · not real listings, prices or availability</p>
    </div>
  );
}
