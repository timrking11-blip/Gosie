import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const contexts = ["All", "Solo", "Friends", "Date", "Group"] as const;
type Ctx = (typeof contexts)[number];

const ideas = [
  { id: "jazz", title: "Late set at a small jazz room", kind: "Music", when: "Sat · evening", budget: "$$", travel: "20 min", fit: { All: 9, Solo: 7, Friends: 7, Date: 10, Group: 5 }, why: "Sample interest: live music. This fictional evening idea has an illustrative score for each social context, not a score learned from your history." },
  { id: "film", title: "Restored-print film night", kind: "Film", when: "Fri · 8 pm", budget: "$", travel: "12 min", fit: { All: 8, Solo: 10, Friends: 7, Date: 8, Group: 6 }, why: "Sample interest: classic cinema. This fictional film ranks highest for Solo using preset example scores, not ratings or saved activity." },
  { id: "lunch", title: "Long lunch, shared plates", kind: "Food", when: "Sun · midday", budget: "$$", travel: "15 min", fit: { All: 8, Solo: 4, Friends: 10, Date: 7, Group: 9 }, why: "Sample interest: relaxed meals together. Preset example scores put this fictional lunch first for Friends and Group; no personal preferences were collected." },
  { id: "walk", title: "Riverside walk & market", kind: "Outdoors", when: "Sun · morning", budget: "Free", travel: "8 min", fit: { All: 7, Solo: 9, Friends: 8, Date: 6, Group: 8 }, why: "Sample interest: time outdoors. This fictional walk illustrates a low-key option; prices, travel times and availability have not been checked." },
];

export function WeekendMock({ compact = false }: { compact?: boolean }) {
  const explanationId = useId();
  const [ctx, setCtx] = useState<Ctx>("All");
  const [open, setOpen] = useState<string | null>(null);
  const ranked = [...ideas].sort((a, b) => b.fit[ctx] - a.fit[ctx]);
  const list = compact ? ranked.slice(0, 2) : ranked;

  return (
    <section aria-label="Weekend Ahead demo" className="relative min-w-0 overflow-hidden rounded-2xl bg-weekend text-cream shadow-float">
      <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-peach/20 blur-3xl" />
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-peach">Weekend Ahead</p>
            <h4 className="font-serif text-xl sm:text-2xl">Things to do</h4>
          </div>
          <span className="rounded-full border border-cream/20 px-2.5 py-1 text-xs uppercase tracking-widest text-cream/80">Example demo</span>
        </div>

        <div role="group" aria-label="Who's coming" className="mt-4 flex flex-wrap gap-1.5">
          {contexts.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={ctx === c}
              onClick={() => setCtx(c)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm transition-colors",
                ctx === c ? "border-peach bg-peach text-espresso" : "border-cream/20 text-cream/80 hover:border-peach/60",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {!compact && (
          <div className="mt-3 text-xs leading-relaxed text-cream/80">
            <p className="mb-1.5">Example assumptions · not editable</p>
            <div className="flex flex-wrap gap-1.5">
            {["Budget · up to $$", "Travel · under 25 min", "Pace · unhurried"].map((p) => (
              <span key={p} className="rounded-md bg-cream/10 px-2 py-1">{p}</span>
            ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-gold" aria-live="polite">
          Sample ranking for <span className="font-semibold">{ctx}</span> · preset illustrative scores
        </p>

        <ul className="mt-2 space-y-2">
          {list.map((it, i) => (
            <li key={it.title} className="rounded-xl border border-cream/10 bg-espresso/60 p-3 backdrop-blur-sm transition-all">
              <div className="flex flex-wrap items-start gap-3">
                <span className="font-serif text-2xl leading-none text-peach">{i + 1}</span>
                <div className="min-w-0 flex-1 basis-32">
                  <p className="text-xs uppercase tracking-widest text-gold">{it.kind} · {it.when}</p>
                  <p className="break-words font-serif text-base leading-snug">{it.title}</p>
                  <p className="mt-1 text-xs text-cream/80">Example: {it.budget} · {it.travel} travel</p>
                </div>
                <span className="text-xs text-peach">Sample fit: {it.fit[ctx]}/10</span>
              </div>
              {!compact && (
                <>
                  <button
                    type="button"
                    aria-label={`Why this idea? ${it.title}`}
                    aria-expanded={open === it.title}
                    aria-controls={`${explanationId}-${it.id}`}
                    onClick={() => setOpen(open === it.title ? null : it.title)}
                    className="mt-2 inline-flex items-center gap-1 py-1 text-sm text-peach hover:text-cream"
                  >
                    Why this idea?
                    <ChevronDown className={cn("h-3 w-3 transition-transform", open === it.title && "rotate-180")} />
                  </button>
                  <p id={`${explanationId}-${it.id}`} hidden={open !== it.title} className="mt-1 text-sm leading-relaxed text-cream/85">{it.why}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative border-t border-cream/10 px-4 py-3 text-xs leading-relaxed text-cream/80">Illustrative recommendations, scores and explanations · not real listings, prices or availability · no personal history</p>
    </section>
  );
}
