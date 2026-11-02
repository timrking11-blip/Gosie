import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Plus, Compass, SlidersHorizontal, Sparkles, MessageCircleHeart, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GooseMark, Wordmark } from "@/components/gosie/Logo";
import { WeekMock } from "@/components/gosie/WeekMock";
import { WeekendMock } from "@/components/gosie/WeekendMock";

const TITLE = "Gosie — A little help for everything ahead";
const DESC = "Gosie is a warm, thoughtful personal-intelligence sidekick that brings your week's priorities and your weekend's possibilities together. In development.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
  component: Index,
});

const nav = [
  ["The idea", "#idea"],
  ["Week Ahead", "#week"],
  ["Weekend Ahead", "#weekend"],
  ["How it works", "#how"],
  ["Release", "#release"],
] as const;

const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full bg-peach px-6 py-3 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-soft";
const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-cream/25 px-6 py-3 text-sm font-semibold text-cream transition-colors hover:border-cream/60 hover:bg-cream/5";

function Index() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cream focus:px-3 focus:py-2">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <Idea />
        <WeekSection />
        <WeekendSection />
        <How />
        <Companion />
        <Release />
        <Faq />
      </main>
      <Footer />
    </>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-cream/10 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" aria-label="gosie. home"><Wordmark tone="cream" /></a>
        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {nav.map(([l, h]) => (
            <a key={h} href={h} className="text-sm text-cream/70 transition-colors hover:text-cream">{l}</a>
          ))}
        </nav>
        <a href="#preview" className="hidden rounded-full bg-cream px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-peach lg:inline-flex">Explore the preview</a>
        <button className="rounded-md p-2 text-cream lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav id="mnav" aria-label="Mobile" className="border-t border-cream/10 bg-ink px-5 pb-6 pt-2 lg:hidden">
          {nav.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block border-b border-cream/5 py-3 font-serif text-lg text-cream">{l}</a>
          ))}
          <a href="#preview" onClick={() => setOpen(false)} className={cn(btnPrimary, "mt-5 w-full")}>Explore the preview</a>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  const [tab, setTab] = useState<"week" | "weekend">("week");
  return (
    <section id="top" className="relative overflow-hidden bg-hero text-cream">
      <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[38rem] w-[38rem] rounded-full bg-moon" />
      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
        <div className="max-w-3xl animate-rise">
          <GooseMark className="mb-8 h-12 w-12 animate-float" tone="cream" />
          <p className="eyebrow text-sage">Personal intelligence, with a personal touch</p>
          <h1 className="mt-5 text-[2.6rem] font-light leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Make more of the <em className="font-normal text-peach">life ahead.</em>
          </h1>
          <p className="mt-6 max-w-xl text-base text-cream/75 sm:text-lg">
            Your plans, priorities, and possibilities—brought together by a thoughtful sidekick.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#preview" className={btnPrimary}>Explore Gosie <ArrowRight className="h-4 w-4" /></a>
            <a href="#how" className={btnGhost}>See how it works</a>
          </div>
        </div>

        <div id="preview" className="mt-16 scroll-mt-24">
          <div className="rounded-[1.25rem] border border-cream/10 bg-ink/70 p-2 shadow-float">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-cream/20" /><span className="h-2.5 w-2.5 rounded-full bg-cream/20" /><span className="h-2.5 w-2.5 rounded-full bg-cream/20" />
              </div>
              <div role="tablist" aria-label="Preview" className="mx-auto flex rounded-full bg-cream/5 p-1 text-xs">
                {(["week", "weekend"] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={cn("rounded-full px-4 py-1.5 transition-colors", tab === t ? "bg-cream text-ink" : "text-cream/70 hover:text-cream")}>
                    {t === "week" ? "Week Ahead" : "Weekend Ahead"}
                  </button>
                ))}
              </div>
              <span className="hidden w-12 sm:block" />
            </div>
            <div className="grid gap-2 lg:grid-cols-[1.6fr_1fr]">
              <div className={cn(tab === "week" ? "block" : "hidden lg:block", "transition-opacity", tab !== "week" && "lg:opacity-60")}>
                <WeekMock />
              </div>
              <div className={cn(tab === "weekend" ? "block" : "hidden lg:block", "transition-opacity", tab !== "weekend" && "lg:opacity-60")}>
                <WeekendMock compact={tab !== "weekend"} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-cream/45">Illustrative preview · fictional data</p>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, children, light = false }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode; light?: boolean }) {
  return (
    <div className="max-w-2xl">
      <p className={cn("eyebrow", light ? "text-sage" : "text-forest/70")}>{eyebrow}</p>
      <h2 className={cn("mt-4 text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl", light ? "text-cream" : "text-ink")}>{title}</h2>
      {children && <div className={cn("mt-5 text-base sm:text-lg", light ? "text-cream/70" : "text-muted-foreground")}>{children}</div>}
    </div>
  );
}

function Idea() {
  const pillars = [
    { icon: Compass, t: "Clarity for work and real life", d: "One calm view of meetings, errands and the people who matter—so the important things don't get buried." },
    { icon: Sparkles, t: "Possibilities for your weekends", d: "Ideas shaped around who you're with, what you can spend, and how far you'd like to go." },
    { icon: SlidersHorizontal, t: "Recommendations you understand", d: "Every suggestion can explain itself. Adjust, dismiss, or rate it—and Gosie learns from you." },
  ];
  return (
    <section id="idea" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:py-32">
      <SectionHead eyebrow="The idea" title={<>More than a <em className="text-forest">calendar.</em></>}>
        <p>Calendars tell you where to be. Gosie helps you make more of your life, not just manage your calendar—a curious, well-mannered companion that notices what's coming and offers a little help. Helpful, never intrusive.</p>
      </SectionHead>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {pillars.map(({ icon: I, t, d }) => (
          <article key={t} className="group rounded-2xl border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-soft">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-forest text-cream transition-colors group-hover:bg-peach group-hover:text-ink"><I className="h-5 w-5" strokeWidth={1.5} /></span>
            <h3 className="mt-6 text-xl">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </article>
        ))}
      </div>
      <p className="mt-10 flex items-center gap-3 text-sm text-forest">
        <MessageCircleHeart className="h-5 w-5 shrink-0" strokeWidth={1.5} />
        Gosie is being shaped with early testers. Their feedback decides what comes next.
      </p>
    </section>
  );
}

function WeekSection() {
  return (
    <section id="week" className="scroll-mt-16 bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 sm:py-32 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHead light eyebrow="Week Ahead · executive clarity" title="See your week in perspective.">
            <p>Work and personal plans, grouped the way you think. Switch between category and chronological views, spot the heavy days early, and get a short digest of what deserves attention first.</p>
          </SectionHead>
          <ul className="mt-8 space-y-3 text-sm text-cream/75">
            {["Work / life balance at a glance", "Grouped by category or by day", "A priority rail for what matters most", "A calm weekly digest"].map((x) => (
              <li key={x} className="flex gap-3"><span className="mt-2 h-px w-5 bg-mist" />{x}</li>
            ))}
          </ul>
        </div>
        <WeekMock />
      </div>
    </section>
  );
}

function WeekendSection() {
  return (
    <section id="weekend" className="scroll-mt-16 bg-espresso text-cream">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 sm:py-32 lg:grid-cols-[1.1fr_1fr]">
        <div className="order-2 lg:order-1"><WeekendMock /></div>
        <div className="order-1 lg:order-2">
          <p className="eyebrow text-peach">Weekend Ahead · life in motion</p>
          <h2 className="mt-4 text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">Leave a little room for <em className="text-peach">something good.</em></h2>
          <p className="mt-5 text-base text-cream/70 sm:text-lg">A late jazz set, a restored film, a long lunch with friends. Tell Gosie who's coming—solo, friends, a date, a group—and watch the ideas re-rank. Budget, travel and pace stay in your hands.</p>
          <p className="mt-6 text-sm text-cream/50">Try the pills on the card. Each idea can tell you why it's there.</p>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: "01", t: "Tell Gosie what matters", d: "Set your balance between work and life, a weekend budget, how far you'll travel, and the kinds of things you enjoy." },
    { n: "02", t: "Get a clear view", d: "Your week, grouped and prioritised. Your weekend, with a handful of ideas—each with a clear note on where it came from." },
    { n: "03", t: "Choose what feels right", d: "Save, dismiss, or rate. Preferences stay editable, and nothing happens without you." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:py-32">
      <SectionHead eyebrow="How Gosie works" title="Three quiet steps." />
      <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="bg-card p-8">
            <span className="font-serif text-4xl font-light text-peach">{s.n}</span>
            <h3 className="mt-5 text-xl">{s.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-forest p-7 text-cream">
          <p className="eyebrow text-sage">In the prototype</p>
          <p className="mt-3 text-sm text-cream/80">Week Ahead and Weekend Ahead concepts, context-based re-ranking, preference controls, explanations, and save / dismiss / rate.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-forest/30 p-7">
          <p className="eyebrow text-forest/70">Planned · future</p>
          <p className="mt-3 text-sm text-muted-foreground">Calendar integrations and other connections—only ever with your explicit authorisation. Not available today.</p>
        </div>
      </div>
    </section>
  );
}

function Companion() {
  return (
    <section className="bg-sage/30">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-24 text-center sm:py-28">
        <GooseMark className="h-14 w-14 animate-float" />
        <blockquote className="mt-8 font-serif text-2xl font-light leading-snug text-forest sm:text-4xl">
          "Good morning. A few priorities worth your attention—and a few possibilities worth looking forward to."
        </blockquote>
        <p className="mt-6 text-sm text-muted-foreground">How Gosie might greet you. A quiet note when you open it—not a stream of notifications.</p>
      </div>
    </section>
  );
}

function Release() {
  return (
    <section id="release" className="scroll-mt-16 bg-hero text-cream">
      <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:py-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-4 py-1.5 text-xs text-cream/80">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> In development · Release date to be announced
        </span>
        <h2 className="mt-8 text-4xl font-light tracking-tight sm:text-6xl">The experience is <em className="text-peach">taking shape.</em></h2>
        <p className="mx-auto mt-6 max-w-xl text-cream/70">Prototype in active testing. Public access is not yet open. We'd rather get it right than get it out early.</p>
        <a href="#preview" className={cn(btnPrimary, "mt-10")}>Explore the preview <ArrowRight className="h-4 w-4" /></a>
      </div>
    </section>
  );
}

function Faq() {
  const qs = [
    ["What is Gosie?", "A personal-intelligence companion that brings together your Week Ahead—priorities, plans and balance—and your Weekend Ahead—ideas for time well spent—with suggestions you can understand and adjust."],
    ["Is Gosie available now?", "Not yet. Gosie is in development and being tested as a private prototype. There's no public access or sign-up, and no release date has been set."],
    ["Does Gosie connect to my calendar?", "Not today. Calendar integration is planned and being explored in limited testing only. If it becomes available, it will only ever connect with your explicit authorisation."],
    ["How are suggestions chosen?", "From the preferences you set—who you're with, budget, travel distance, pace—and your feedback. Every idea carries a short 'why', and you can dismiss or rate anything."],
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-24 sm:py-32">
      <SectionHead eyebrow="Questions" title="Fair questions." />
      <div className="mt-10 divide-y border-y">
        {qs.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <Plus className="h-5 w-5 shrink-0 text-forest transition-transform group-open:rotate-45" strokeWidth={1.5} />
            </summary>
            <p className="mt-3 pr-8 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 md:flex-row md:items-end md:justify-between">
        <div>
          <Wordmark tone="cream" />
          <p className="mt-3 font-serif text-lg text-cream/80">A little help for everything ahead.</p>
          <p className="mt-2 text-xs text-cream/45">Gosie is a working product name and identity.</p>
        </div>
        <div className="max-w-sm text-xs leading-relaxed text-cream/50">
          <p>Designed with accessibility in mind and a privacy-first approach: your data should serve you, and connections happen only with your permission.</p>
          <p className="mt-3">© 2026 Gosie. All previews show fictional data.</p>
        </div>
      </div>
    </footer>
  );
}
