import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Info,
  MapPin,
  Sparkles,
  Tag,
} from 'lucide-react';
import { CommunityPanel, CommunityDiscoveries } from '@workspace/community/panel';
import PersonalPlans from './components/PersonalPlans';
import WeekendPreferences from './components/WeekendPreferences';
import ReviewedDiscoveries from './components/ReviewedDiscoveries';
import {
  defaultWeekendPreferences,
  rankSampleIdeas,
  sampleWeekendIdeas,
  type SocialContext,
  type WeekendPreferences as Preferences,
} from './lib/weekend-discovery';

type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
type EventCategory = 'Work' | 'Wellbeing' | 'Home' | 'Social';
type WeekEvent = {
  id: string;
  weekday: Weekday;
  time: string;
  title: string;
  category: EventCategory;
  note: string;
};
type ActionItem = { id: string; title: string; detail: string; done: boolean };
const weekdays: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const categories: EventCategory[] = ['Work', 'Wellbeing', 'Home', 'Social'];

const events: WeekEvent[] = [
  { id: 'e1', weekday: 'Monday', time: '9:30 am', title: 'Set a gentle intention', category: 'Wellbeing', note: 'A short check-in before the week gathers speed.' },
  { id: 'e2', weekday: 'Monday', time: '1:00 pm', title: 'Focus block', category: 'Work', note: 'A quiet hour for the thing that needs your attention.' },
  { id: 'e3', weekday: 'Tuesday', time: '10:00 am', title: 'Project planning hour', category: 'Work', note: 'Sketch the next small steps, then leave it there.' },
  { id: 'e4', weekday: 'Tuesday', time: '6:15 pm', title: 'Take the longer way home', category: 'Wellbeing', note: 'A little fresh air between work and evening.' },
  { id: 'e5', weekday: 'Wednesday', time: '11:30 am', title: 'Catch-up with a teammate', category: 'Work', note: 'A friendly midweek touchpoint.' },
  { id: 'e6', weekday: 'Wednesday', time: '7:00 pm', title: 'Make something simple for dinner', category: 'Home', note: 'Keep the recipe easy and the evening unhurried.' },
  { id: 'e7', weekday: 'Thursday', time: '9:00 am', title: 'A little stretch break', category: 'Wellbeing', note: 'Ten minutes counts. No special setup needed.' },
  { id: 'e8', weekday: 'Thursday', time: '2:30 pm', title: 'Creative work session', category: 'Work', note: 'A protected window to follow one idea.' },
  { id: 'e9', weekday: 'Friday', time: '4:00 pm', title: 'Close a few loops', category: 'Work', note: 'Write down what can wait until next week.' },
  { id: 'e10', weekday: 'Friday', time: '7:30 pm', title: 'A no-plan evening', category: 'Wellbeing', note: 'The plan is to keep the evening open.' },
  { id: 'e11', weekday: 'Saturday', time: '10:30 am', title: 'Browse the neighborhood market', category: 'Social', note: 'A fictional weekend idea; take it at your own pace.' },
  { id: 'e12', weekday: 'Saturday', time: '4:00 pm', title: 'Room for a good book', category: 'Wellbeing', note: 'A pocket of quiet before the evening.' },
  { id: 'e13', weekday: 'Sunday', time: '11:00 am', title: 'Slow breakfast', category: 'Home', note: 'Something easy, with nowhere to rush.' },
  { id: 'e14', weekday: 'Sunday', time: '5:00 pm', title: 'A soft landing for Monday', category: 'Home', note: 'Pick one small thing that will make tomorrow kinder.' },
];

const sampleActions: ActionItem[] = [
  { id: 'a1', title: 'Choose one thing to make easier', detail: 'A tiny preparation can give the rest of the week more room.', done: false },
  { id: 'a2', title: 'Put a little space around Friday', detail: 'Keep one evening unclaimed, even if only for an hour.', done: false },
  { id: 'a3', title: 'Check the everyday essentials', detail: 'A quick look at the week’s basics before they become urgent.', done: false },
  { id: 'a4', title: 'Make a weekend idea feel possible', detail: 'Pick a time window, not a whole itinerary.', done: false },
];

const daysShort: Record<Weekday, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

function useLocalActionItems() {
  const [items, setItems] = useState<ActionItem[]>(() => {
    try {
      const saved = window.localStorage.getItem('gosie-week-ahead-actions-v1');
      if (!saved) return sampleActions;
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      return sampleActions.map((item) => ({ ...item, done: parsed[item.id] ?? false }));
    } catch {
      return sampleActions;
    }
  });

  useEffect(() => {
    try {
      const state = Object.fromEntries(items.map((item) => [item.id, item.done]));
      window.localStorage.setItem('gosie-week-ahead-actions-v1', JSON.stringify(state));
    } catch {
      // The checklist still works for this visit when browser storage is unavailable.
    }
  }, [items]);

  const toggle = (id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  };

  return { items, toggle };
}

function BrandHeader({ active }: { active: 'week' | 'outings' | 'communities' }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand-lockup" aria-label="Gosie, Week Ahead">
        <img className="brand-wordmark" src={`${import.meta.env.BASE_URL}brand/gosie-wordmark.svg`} alt="gosie." />
      </Link>
      <div className="topbar-right">
        <nav className="nav-links" aria-label="Main navigation">
          <Link href="/" className={`nav-link${active === 'week' ? ' active' : ''}`} aria-current={active === 'week' ? 'page' : undefined}>Week ahead</Link>
          <Link href="/outings" className={`nav-link${active === 'outings' ? ' active' : ''}`} aria-current={active === 'outings' ? 'page' : undefined}>Weekend ideas</Link>
          <Link href="/communities" className={`nav-link${active === 'communities' ? ' active' : ''}`} aria-current={active === 'communities' ? 'page' : undefined}>Communities</Link>
        </nav>
        <span className="prototype-label">{active === 'communities' ? 'Moderated community' : 'Illustrative preview'}</span>
      </div>
    </header>
  );
}

function DemoBadge() {
  return <span className="demo-badge"><Sparkles size={13} aria-hidden="true" /> A sample week, just for the demo</span>;
}

function Summary() {
  return (
    <section className="week-summary" aria-label="Illustrative week at a glance">
      <div className="summary-lead">
        <div className="summary-sun"><CalendarDays size={21} aria-hidden="true" /></div>
        <div><strong>A week with room to breathe</strong><span>Little anchors, and space between them.</span></div>
      </div>
      <div className="summary-stat"><strong>{events.length}</strong><span>gentle moments across the week</span></div>
      <div className="summary-stat"><strong>{events.filter((event) => event.weekday === 'Saturday' || event.weekday === 'Sunday').length}</strong><span>weekend ideas already in view</span></div>
      <div className="summary-stat"><strong>{sampleActions.length}</strong><span>small things you can carry forward</span></div>
    </section>
  );
}

function EventEntry({ event }: { event: WeekEvent }) {
  return (
    <div className="event-line" data-category={event.category}>
      <time className="event-time">{event.time}</time>
      <span className="event-dot" aria-hidden="true" />
      <div className="event-copy"><strong>{event.title}</strong><p>{event.note}</p></div>
    </div>
  );
}

function ChronologicalEvents() {
  return (
    <div className="events-list">
      {weekdays.map((weekday, index) => {
        const dayEvents = events.filter((event) => event.weekday === weekday);
        return (
          <section className="day-row" key={weekday} aria-labelledby={`day-${weekday}`}>
            <div className={`day-marker${index > 4 ? ' is-weekend' : ''}`}>
              <span className="day-name">{daysShort[weekday]}</span><span className="day-number">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="day-events">
              <div className="day-heading"><h3 id={`day-${weekday}`}>{weekday}</h3><span>{dayEvents.length ? `${dayEvents.length} ${dayEvents.length === 1 ? 'moment' : 'moments'}` : 'Open day'}</span></div>
              {dayEvents.length ? dayEvents.map((event) => <EventEntry event={event} key={event.id} />) : (
                <div className="event-copy"><p>No sample plans here. Keep the day open if that feels good.</p></div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CategoryEvents() {
  return (
    <div className="category-mode">
      {categories.map((category) => {
        const items = events.filter((event) => event.category === category)
          .sort((a, b) => weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday));
        return (
          <section className="category-group" key={category} aria-labelledby={`category-${category}`}>
            <div className="category-heading" data-category={category}><span aria-hidden="true" /><h3 id={`category-${category}`}>{category}</h3></div>
            <div className="category-items">
              {items.map((event) => (
                <article className="category-event" key={event.id}>
                  <time>{daysShort[event.weekday]} · {event.time}</time>
                  <strong>{event.title}</strong>
                  <p>{event.note}</p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EventSchedule() {
  const [view, setView] = useState<'chronological' | 'category'>('chronological');
  return (
    <section className="surface-card" aria-labelledby="schedule-heading">
      <div className="section-title-row">
        <div><span className="section-kicker">Illustrative sample</span><h2 className="section-title" id="schedule-heading">A fictional week, at a glance</h2></div>
        <div className="view-switch" aria-label="Event grouping">
          <button type="button" aria-pressed={view === 'chronological'} onClick={() => setView('chronological')}>By day</button>
          <button type="button" aria-pressed={view === 'category'} onClick={() => setView('category')}>By kind</button>
        </div>
      </div>
      <p className="section-note" style={{ margin: '10px 23px 0' }}>Switch views to find your rhythm. Every sample event stays in the list.</p>
      {view === 'chronological' ? <ChronologicalEvents /> : <CategoryEvents />}
    </section>
  );
}

function ActionBoard() {
  const { items, toggle } = useLocalActionItems();
  const completeCount = items.filter((item) => item.done).length;
  return (
    <section className="surface-card action-card" aria-labelledby="action-heading">
      <div className="action-head">
        <span className="section-kicker">A softer kind of to-do</span>
        <h2 className="section-title" id="action-heading">Small things, in reach</h2>
        <p>No rush to finish everything. Check off what feels useful and leave the rest for later.</p>
      </div>
      <div className="action-progress" aria-live="polite"><span>Little steps</span><strong>{completeCount} of {items.length} done</strong></div>
      <div className="progress-track" aria-hidden="true"><div className="progress-fill" style={{ width: `${items.length ? (completeCount / items.length) * 100 : 0}%` }} /></div>
      <ul className="action-list">
        {items.map((item) => (
          <li className={`action-item${item.done ? ' is-done' : ''}`} key={item.id}>
            <label className="action-label">
              <input className="action-check" type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
              <span className="action-text"><strong>{item.title}</strong><span>{item.detail}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="local-note"><Info size={14} aria-hidden="true" /><span>Local demo only: checklist ticks are saved in this browser on this device. They are not sent anywhere.</span></div>
    </section>
  );
}

function WeekendTeaser() {
  return (
    <section className="surface-card weekend-teaser" aria-labelledby="weekend-teaser-title">
      <span className="section-kicker">Weekend ahead</span>
      <h2 id="weekend-teaser-title">A little room for something good.</h2>
      <p>Fictional ideas, with simple context scores to help you find a plan that fits the company you have in mind.</p>
      <Link className="teaser-link" href="/outings">Explore weekend ideas <ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}

function WeekAheadPage() {
  return (
    <div className="app-shell">
      <BrandHeader active="week" />
      <main className="page-wrap">
        <div className="intro">
          <span className="eyebrow">A little help for everything ahead</span>
          <h1>Make space for <em>your week.</em></h1>
          <p className="intro-copy">A thoughtful view of what’s coming, plus a few small anchors to make the days feel more manageable. The sample week below is fictional. Plans you add stay in this browser; Gosie is not connected to your calendar.</p>
          <DemoBadge />
        </div>
        <Summary />
        <PersonalPlans />
        <div className="content-grid">
          <EventSchedule />
          <aside className="aside-column" aria-label="Planning notes">
            <ActionBoard />
            <WeekendTeaser />
          </aside>
        </div>
        <CommunityDiscoveries communityHref={`${import.meta.env.BASE_URL}communities`} />
        <Footer />
      </main>
    </div>
  );
}

function OutingCard({ sample, context, rank }: { sample: ReturnType<typeof rankSampleIdeas>['included'][number]; context: SocialContext; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const { idea: outing, score, reasons } = sample;
  return (
    <article className="outing-card">
      <div className="outing-top">
        <span className="outing-category">{outing.category} · idea {String(rank).padStart(2, '0')}</span>
        <span className="outing-score" aria-label={`Illustrative fit score ${score} out of 10`}>{score}<small> / 10</small></span>
      </div>
      <h4>{outing.title}</h4>
      <div className="outing-when">{outing.when}</div>
      <div className="outing-labels">
        <span className="outing-label"><Tag size={12} aria-hidden="true" />Fictional cost · ${outing.sampleCostUsd}</span>
        <span className="outing-label"><MapPin size={12} aria-hidden="true" />Fictional travel · {outing.sampleTravelMinutes} min</span>
      </div>
      <div className="outing-contextline" aria-label="Fixed sample scores by context">
        {(['All', 'Solo', 'Friends', 'Date', 'Group'] as SocialContext[]).map((choice) => <span className={`context-score${choice === context ? ' is-selected' : ''}`} key={choice}>{choice} {outing.contextScores[choice]}/10</span>)}
      </div>
      <button className="explanation-toggle" type="button" aria-expanded={expanded} aria-controls={`why-${outing.id}`} onClick={() => setExpanded((current) => !current)}>
        <span>{expanded ? 'Close the why' : 'Why this sample is ranked here'}</span>{expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
      </button>
      {expanded && <div className="explanation-copy" id={`why-${outing.id}`}>{reasons.map((reason, index) => <p key={`${outing.id}-reason-${index}`}>{reason}</p>)}</div>}
    </article>
  );
}

function OutingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(defaultWeekendPreferences);
  const ranking = useMemo(() => rankSampleIdeas(sampleWeekendIdeas, preferences), [preferences]);
  return (
    <div className="app-shell">
      <BrandHeader active="outings" />
      <main className="page-wrap">
        <DemoBadge />
        <section className="outing-intro">
          <div>
            <span className="eyebrow">Weekend ahead · life in motion</span>
            <h2>Leave room for <em>something good.</em></h2>
            <p>A few fictional ideas, reordered by the choices you save on this device. The list is a demo—not live event discovery.</p>
          </div>
          <div className="weekend-note"><strong>Just an illustration</strong>This preview is not connected to live event sources. These are sample ideas, not real listings, prices, or availability.</div>
        </section>
        <WeekendPreferences onPreferencesChange={setPreferences} />
        <ReviewedDiscoveries />
        <div className="outing-results-head">
          <h3>Fictional sample ideas</h3><span>Ordered for {preferences.context} · {ranking.included.length} in view</span>
        </div>
        {ranking.included.length ? (
          <section className="outing-grid" aria-label={`Fictional sample ideas for ${preferences.context}`}>
            {ranking.included.map((sample, index) => <OutingCard key={sample.idea.id} sample={sample} context={preferences.context} rank={index + 1} />)}
          </section>
        ) : (
          <p className="sample-empty">No fictional examples fit both hard limits. Clear or widen a limit to see the sample ideas again.</p>
        )}
        {ranking.excluded.length > 0 && (
          <details className="excluded-samples">
            <summary>Why {ranking.excluded.length} fictional {ranking.excluded.length === 1 ? 'idea is' : 'ideas are'} excluded by your limits</summary>
            <ul>
              {ranking.excluded.map(({ idea, reasons }) => (
                <li key={idea.id}>
                  <strong>{idea.title}</strong>
                  <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="ranking-note"><Info size={15} aria-hidden="true" /><span>These are {sampleWeekendIdeas.length} fictional examples across arts, festivals, community, sports, markets, and more. Their tags, score, cost, and travel figures are sample values—not live listings or verified facts. Interests and context only reorder eligible examples; explicit limits exclude them with a reason.</span></div>
        <Footer />
      </main>
    </div>
  );
}

function CommunitiesPage() {
  return (
    <div className="app-shell">
      <BrandHeader active="communities" />
      <main className="page-wrap">
        <p className="section-note">This feed contains moderated contributor suggestions, not the fictional sample data shown elsewhere in this preview.</p>
        <CommunityPanel />
        <footer className="app-footer">Gosie Communities · contributor-supplied details · check the source before going.</footer>
      </main>
    </div>
  );
}

function Footer() {
  return <footer className="app-footer"><span className="footer-brand"><img className="footer-mark" src={`${import.meta.env.BASE_URL}brand/gosie-mark.svg`} alt="" /><strong>gosie.</strong> A little help for everything ahead.</span><span>Illustrative preview · fictional sample data</span></footer>;
}

function NotFoundPage() {
  return (
    <main className="page-wrap">
      <div className="surface-card" style={{ padding: 24 }}>
        <span className="eyebrow">Not quite the right path</span>
        <h1 style={{ margin: '10px 0', font: '500 42px/1.05 var(--app-font-serif)', color: 'var(--espresso)' }}>Let’s find your week.</h1>
        <Link className="teaser-link" style={{ background: 'var(--forest)' }} href="/">Back to Week Ahead <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
    </main>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <Switch key={location}>
      <Route path="/" component={WeekAheadPage} />
      <Route path="/outings" component={OutingsPage} />
      <Route path="/communities" component={CommunitiesPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Router />
    </WouterRouter>
  );
}

export default App;
