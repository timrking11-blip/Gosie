import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Menu, X, Plus, Compass, SlidersHorizontal, Sparkles, MessageCircleHeart, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GooseMark, Wordmark } from "@/components/gosie/Logo";
import { PromoVideo } from "@/components/gosie/PromoVideo";
import { WeekMock } from "@/components/gosie/WeekMock";
import { WeekendMock } from "@/components/gosie/WeekendMock";

const TITLE = "Gosie — A little help for everything ahead";
const DESC = "Explore Gosie's personal-intelligence concept through illustrative demos: group sample events, re-rank fictional weekend ideas and open example explanations. Release date TBA.";

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
  ["Watch", "#promo"],
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
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <header onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    }} className="sticky top-0 z-40 border-b border-cream/10 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" aria-label="gosie. home"><Wordmark tone="cream" /></a>
        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {nav.map(([l, h]) => (
            <a key={h} href={h} className="text-sm text-cream/70 transition-colors hover:text-cream">{l}</a>
          ))}
        </nav>
        <a href="#promo" className="hidden rounded-full bg-cream px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-peach lg:inline-flex">Watch the promo</a>
        <button ref={menuButton} type="button" className="rounded-md p-2 text-cream lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav id="mnav" aria-label="Mobile" className="border-t border-cream/10 bg-ink px-5 pb-6 pt-2 lg:hidden">
          {nav.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block border-b border-cream/5 py-3 font-serif text-lg text-cream">{l}</a>
          ))}
          <a href="#promo" onClick={() => setOpen(false)} className={cn(btnPrimary, "mt-5 w-full")}>Watch the promo</a>
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
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="max-w-3xl animate-rise">
            <GooseMark className="mb-8 h-12 w-12 animate-float" tone="cream" />
            <p className="eyebrow text-sage">Personal intelligence, with a personal touch</p>
            <h1 className="mt-5 text-[2.6rem] font-light leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Make more of the <em className="font-normal text-peach">life ahead.</em>
            </h1>
            <p className="mt-6 max-w-xl text-base text-cream/75 sm:text-lg">
              A concept for bringing plans, priorities, and possibilities together. Explore fictional examples below—not a connected personal app.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#promo" className={btnPrimary}>Watch the promo <ArrowRight className="h-4 w-4" /></a>
              <a href="#how" className={btnGhost}>See how it works</a>
            </div>
          </div>

          <div id="promo" className="scroll-mt-24">
            <div className="mb-5 max-w-3xl">
              <p className="eyebrow text-sage">The Gosie promo</p>
              <h2 className="mt-3 font-serif text-3xl font-light tracking-tight sm:text-4xl">A concept for everything ahead.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cream/75 sm:text-base">
                Watch the introductory film. It presents illustrative examples of Gosie’s Week Ahead and Weekend Ahead concepts.
              </p>
            </div>
            <PromoVideo />
            <p className="mt-3 text-center text-xs leading-relaxed text-cream/65">
              Fictional examples · no live calendar connection · product release date to be announced
            </p>
          </div>
        </div>

        <div id="preview" className="mt-16 scroll-mt-24">
          <div className="rounded-[1.25rem] border border-cream/10 bg-ink/70 p-2 shadow-float">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="hidden gap-1.5 sm:flex" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-cream/20" /><span className="h-2.5 w-2.5 rounded-full bg-cream/20" /><span className="h-2.5 w-2.5 rounded-full bg-cream/20" />
              </div>
              <div role="group" aria-label="Preview" className="mx-auto flex flex-wrap justify-center gap-1 rounded-2xl bg-cream/5 p-1 text-sm">
                {(["week", "weekend"] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}
                    className={cn("rounded-full px-3 py-2 transition-colors", tab === t ? "bg-cream text-ink" : "text-cream/80 hover:text-cream")}>
                    {t === "week" ? "Week Ahead" : "Weekend Ahead"}
                  </button>
                ))}
              </div>
              <span className="hidden w-12 sm:block" />
            </div>
            <p className="px-3 pb-3 text-xs leading-relaxed text-cream/75">Choose a preview on smaller screens. Both demos appear side by side on desktop.</p>
            <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className={tab === "week" ? "block" : "hidden lg:block"}>
                <WeekMock />
              </div>
              <div className={tab === "weekend" ? "block" : "hidden lg:block"}>
                <WeekendMock />
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-cream/75">Interactive website demos · fictional data · no connected accounts</p>
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
    { icon: Compass, t: "Clarity for work and real life", d: "Explore fictional meetings, personal plans and errands. Switch between category and chronological grouping." },
    { icon: Sparkles, t: "Possibilities for your weekends", d: "Choose a social context to reorder sample ideas using preset scores. The Gosie Mobile demo also has temporary budget and travel limits that filter fictional ideas; they are not saved preferences. Pace remains an illustrative label." },
    { icon: SlidersHorizontal, t: "Recommendations you understand", d: "Open and close an example explanation for each fictional idea. The demo does not save feedback or learn from your activity." },
  ];
  return (
    <section id="idea" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:py-32">
      <SectionHead eyebrow="The idea" title={<>More than a <em className="text-forest">calendar.</em></>}>
        <p>Gosie's vision is a curious, well-mannered companion for the week and weekend ahead. This promotional website explores that concept with interactive, fictional examples—not live planning or personalised recommendations.</p>
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
        Try the demo interactions below. The full product is in development; release date to be announced.
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
            <p>Explore a fictional week of work and personal plans. Switch between category and chronological views. The activity grid, priority rail and digest are static examples, not analysis of your calendar.</p>
          </SectionHead>
          <ul className="mt-8 space-y-3 text-sm text-cream/75">
            {["Sample work / life metrics", "Switch grouping by category or by day", "An illustrative priority rail", "A written example of a weekly digest"].map((x) => (
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
          <p className="mt-5 text-base text-cream/80 sm:text-lg">A fictional jazz set, film night or long lunch. On this website, choose a social context to reorder sample ideas using preset scores. The Gosie Mobile demo also lets you adjust temporary budget and travel limits to filter fictional examples. Those selections are not saved preferences or synced; pace remains an illustrative label.</p>
          <p className="mt-6 text-sm text-cream/75">Try the social-context buttons and open an example explanation. No live listings, real prices or personal history are used.</p>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: "01", t: "Choose a demo view", d: "Use the hero preview selector on smaller screens, or explore both demos side by side on desktop. All content is illustrative." },
    { n: "02", t: "Try grouping and context", d: "Switch the sample week between categories and weekdays. Choose a weekend social context to reorder fictional ideas using preset scores; the Gosie Mobile demo's budget and travel caps filter its sample list locally." },
    { n: "03", t: "Explore the examples", d: "Open and close the sample explanations. The Gosie Mobile preview also includes save, dismiss and rating controls that change only local demo state for the current session." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:py-32">
      <SectionHead eyebrow="How this demo works" title="Three quiet steps." />
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
          <p className="eyebrow text-sage">Try on this website</p>
          <p className="mt-3 text-sm text-cream/80">Hero preview selection, sample week grouping, social-context ranking of fictional weekend ideas, and example explanation toggles. This website does not save data or learn preferences.</p>
          <p className="mt-3 text-sm text-cream/80">The Gosie Mobile preview also has temporary budget and travel caps that filter fictional ideas, plus save, dismiss and rating controls. These affect only local demo state; nothing is stored or synced, and the limits are not saved preferences.</p>
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
        <p className="mx-auto mt-6 max-w-xl text-cream/80">This website offers illustrative demos only. The full personal-intelligence app is not available here, and there is no product sign-up or calendar connection.</p>
        <a href="#preview" className={cn(btnPrimary, "mt-10")}>Explore the preview <ArrowRight className="h-4 w-4" /></a>
      </div>
    </section>
  );
}

function Faq() {
  const qs = [
    ["What is Gosie?", "A personal-intelligence concept for the week and weekend ahead. This promotional website contains fictional demos: select a hero preview, group sample events, change the social context of sample ideas, and open example explanations."],
    ["Is Gosie available now?", "The website demos are available to explore. The full product is in development, with release date to be announced. This website has no product sign-up."],
    ["Does Gosie connect to my calendar?", "No. All displayed events are fictional and there is no live calendar integration. Calendar connections are planned for the future, not implemented here."],
      ["How are suggestions chosen?", "The recommendations and scores are hardcoded examples. Selecting a social context reorders those ideas using preset scores. Explanations describe sample interests, not your activity. The Gosie Mobile preview has local-only budget and travel caps that filter fictional sample ideas; those selections are not saved preferences or synced. Pace is an illustrative label. No listing, price or travel time is real. The website has no save, dismiss or rate actions; those controls in the Gosie Mobile preview change only temporary local demo state and do not persist or sync."],
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
          <p>This website demonstrates fictional content. It does not connect to your calendar, collect personal preferences, or save feedback. Future connections are planned, not available here.</p>
          <p className="mt-3">© 2026 Gosie. All previews show fictional data.</p>
        </div>
      </div>
    </footer>
  );
}
