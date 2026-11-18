import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  communityEventsInWindow, communityRequest, communityWeekWindow, hasOrganizationRole,
} from "./api";
import type { CommunityComment, CommunityDraft, CommunityItem, CommunityMine } from "./api";
import "./community.css";
import { TimeSelect, localEventIso } from "./TimeSelect";

type Session = { authenticated: boolean; user?: { email?: string } | null; csrfToken?: string };
type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

function fmtDate(value: string | null, withTime = true) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, withTime
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}
function eventRange(item: CommunityItem) {
  if (!item.startsAt) return "";
  const s = fmtDate(item.startsAt);
  if (!item.endsAt) return s;
  const a = new Date(item.startsAt), b = new Date(item.endsAt);
  const end = a.toDateString() === b.toDateString()
    ? b.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : fmtDate(item.endsAt);
  return `${s} – ${end}`;
}
function errText(e: unknown, fallback: string) { return e instanceof Error ? e.message : fallback; }
function isAbort(e: unknown) { return e instanceof DOMException && e.name === "AbortError"; }

function useLoad<T>(path: string | null, apiBase: string, version: number): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    communityRequest<T>(path, { signal: ctrl.signal }, apiBase)
      .then((data) => setState({ status: "ready", data }))
      .catch((e) => { if (!isAbort(e)) setState({ status: "error", message: errText(e, "Something went wrong.") }); });
    return () => ctrl.abort();
  }, [path, apiBase, version, tick]);
  return [state, useCallback(() => setTick((t) => t + 1), [])];
}

async function write<T>(path: string, body: unknown, apiBase: string): Promise<T> {
  // Token is fetched fresh for each write and kept only in memory for this call.
  const session = await communityRequest<Session>("/auth/session", {}, apiBase);
  if (!session.authenticated || !session.csrfToken) throw new Error("Please sign in again to continue.");
  return communityRequest<T>(path, { method: "POST", body: JSON.stringify(body), headers: { "X-CSRF-Token": session.csrfToken } }, apiBase);
}

function StatusChip({ status, expired }: { status: CommunityItem["status"]; expired?: boolean }) {
  return <span className="gc-chips">
    <span className={`gc-chip gc-chip-${status}`}>{status === "pending" ? "Awaiting review" : status === "approved" ? "Approved" : "Not approved"}</span>
    {expired && <span className="gc-chip gc-chip-expired">Past event</span>}
  </span>;
}

function Skeleton({ label }: { label: string }) {
  return <div className="gc-skeleton" role="status" aria-label={label}><div /><div /><div /></div>;
}
function ErrorBox({ message, onRetry, what }: { message: string; onRetry: () => void; what: string }) {
  return <div className="gc-error" role="alert"><p>{what} couldn't load. {message}</p><button type="button" className="gc-btn gc-btn-ghost" onClick={onRetry}>Try again</button></div>;
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="gc-empty"><span className="gc-empty-ring" aria-hidden="true" /><h4>{title}</h4><p>{children}</p></div>;
}

function ItemCard({ item, footer, showStatus }: { item: CommunityItem; footer?: ReactNode; showStatus?: boolean }) {
  const [open, setOpen] = useState(false);
  const approvedComments = item.comments.filter((c) => c.status === "approved");
  return <article className={`gc-card gc-kind-${item.kind}${item.expired ? " is-expired" : ""}`}>
    <div className="gc-card-top">
      <span className="gc-kind">{item.kind === "event" ? "Event" : "Local gem"}</span>
      {(showStatus || item.expired) && <StatusChip status={item.status} expired={item.expired} />}
    </div>
    <h4 className="gc-title">{item.title}</h4>
    {item.kind === "event" && item.startsAt && <p className="gc-when">{eventRange(item)}</p>}
    <p className="gc-where">{item.location}</p>
    <p className="gc-desc">{item.description}</p>
    <p className="gc-byline">Shared by <strong>{item.attribution}</strong>
      <span>{item.reviewedAt ? ` · reviewed ${fmtDate(item.reviewedAt, false)}` : ` · submitted ${fmtDate(item.createdAt, false)}`}</span></p>
    <div className="gc-card-links">
      {item.sourceUrl && <a className="gc-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source<span className="gc-sr"> for {item.title} (opens in a new tab)</span></a>}
      {item.why && <button type="button" className="gc-link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Hide why" : "Why it's here"}</button>}
    </div>
    {open && <p className="gc-why">{item.why}</p>}
    {approvedComments.length > 0 && <ul className="gc-comments" aria-label={`Notes on ${item.title}`}>
      {approvedComments.map((c) => <li key={c.id}><p>{c.text}</p><span>{c.attribution} · {fmtDate(c.reviewedAt || c.createdAt, false)}</span></li>)}
    </ul>}
    {footer}
  </article>;
}

const blankDraft = { kind: "event" as CommunityItem["kind"], title: "", description: "", location: "", attribution: "", sourceUrl: "", startDate: "", startTime: "", endDate: "", endTime: "" };

function SubmitForm({ apiBase, onDone }: { apiBase: string; onDone: (msg: string) => void }) {
  const [d, setD] = useState(blankDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof blankDraft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    if (d.kind === "event") {
      try { startsAt = localEventIso(d.startDate, d.startTime); endsAt = localEventIso(d.endDate, d.endTime); }
      catch (error) { setError(errText(error, "Choose valid start and end dates and times.")); return; }
      if (endsAt <= startsAt) { setError("The end time needs to be after the start time. For an overnight event, choose the following end date."); return; }
      if (Date.parse(endsAt) <= Date.now()) { setError("Choose an event that ends in the future."); return; }
    }
    const draft: CommunityDraft = {
      kind: d.kind, title: d.title.trim(), description: d.description.trim(), location: d.location.trim(), attribution: d.attribution.trim(),
      sourceUrl: d.sourceUrl.trim() || undefined,
      startsAt,
      endsAt,
    };
    setBusy(true);
    try { await write<{ item: CommunityItem }>("/community/items", draft, apiBase); setD(blankDraft); onDone("Thanks — your suggestion is waiting for review."); }
    catch (err) { setError(errText(err, "Your suggestion couldn't be sent.")); }
    finally { setBusy(false); }
  }
  return <form className="gc-form" onSubmit={submit}>
    <fieldset className="gc-kind-pick"><legend>What are you sharing?</legend>
      {(["event", "gem"] as const).map((k) => <label key={k}><input type="radio" name="gc-kind" checked={d.kind === k} onChange={() => setD((p) => ({ ...p, kind: k }))} /><span>{k === "event" ? "A dated event" : "An evergreen local gem"}</span></label>)}
    </fieldset>
    <label>Title<input required maxLength={120} value={d.title} onChange={set("title")} /></label>
    <label>Where<input required maxLength={160} value={d.location} onChange={set("location")} placeholder="Venue and neighbourhood" /></label>
    <label>What makes it worth knowing<textarea required maxLength={800} rows={3} value={d.description} onChange={set("description")} /></label>
    {d.kind === "event" && <>
      <p className="gc-fine">Choose times in 15-minute increments. Times use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. If the venue is in another timezone, convert to this timezone before submitting.</p>
      <div className="gc-row">
        <label>Starts date<input type="date" required value={d.startDate} onChange={set("startDate")} /></label>
        <label>Starts time<TimeSelect required value={d.startTime} onChange={set("startTime")} /></label>
      </div>
      <div className="gc-row">
        <label>Ends date<input type="date" required value={d.endDate} onChange={set("endDate")} /></label>
        <label>Ends time<TimeSelect required value={d.endTime} onChange={set("endTime")} /></label>
      </div>
    </>}
    <div className="gc-row">
      <label>Credit it to<input required maxLength={80} value={d.attribution} onChange={set("attribution")} placeholder="Your name or group, shown publicly" /></label>
      <p className="gc-fine">For people, not promotion: explain what someone can do, who it is useful for, and practical details. Organization posts use the name assigned by Gosie's operator, not a name supplied here. Every post needs moderator approval.</p>
      <label>Source link (optional)<input type="url" value={d.sourceUrl} onChange={set("sourceUrl")} placeholder="https://" /></label>
    </div>
    <p className="gc-fine">If approved, the title, details, location, link, and credit above become public. Approval means a moderator found it relevant — it is not a guarantee of availability, price, or that plans won't change.</p>
    {error && <p className="gc-inline-error" role="alert">{error}</p>}
    <div className="gc-actions"><button className="gc-btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send for review"}</button></div>
  </form>;
}

function OwnerComment({ item, apiBase, onDone }: { item: CommunityItem; apiBase: string; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (item.kind !== "event" || item.expired || item.status !== "approved") return null;
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await write(`/community/items/${encodeURIComponent(item.id)}/comments`, { text: text.trim() }, apiBase); setText(""); setOpen(false); onDone("Your note is waiting for review. It will appear under your organization's designated name."); }
    catch (err) { setError(errText(err, "Your note couldn't be sent.")); }
    finally { setBusy(false); }
  }
  return <div className="gc-owner">
    {!open ? <button type="button" className="gc-link" onClick={() => setOpen(true)}>Add a note as your organization</button> :
      <form onSubmit={submit} className="gc-form gc-form-tight">
        <label>Useful note for the community<textarea required maxLength={500} rows={2} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <p className="gc-fine">Share practical details people need, not advertising. Shown under your operator-designated organization name only after moderation. Identity is not automatically verified.</p>
        {error && <p className="gc-inline-error" role="alert">{error}</p>}
        <div className="gc-actions"><button type="button" className="gc-btn gc-btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="gc-btn" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send note"}</button></div>
      </form>}
  </div>;
}

function Decide({ kind, id, apiBase, onDone }: { kind: "items" | "comments"; id: string; apiBase: string; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(decision: "approved" | "rejected") {
    setBusy(true); setError("");
    try { await write(`/community/moderation/${kind}/${encodeURIComponent(id)}`, { decision }, apiBase); onDone(decision === "approved" ? "Approved and now public." : "Marked as not approved."); }
    catch (err) { setError(errText(err, "That decision couldn't be saved.")); setBusy(false); }
  }
  return <div className="gc-decide">
    <button type="button" className="gc-btn" disabled={busy} onClick={() => decide("approved")}>Approve</button>
    <button type="button" className="gc-btn gc-btn-danger" disabled={busy} onClick={() => decide("rejected")}>Reject</button>
    {error && <p className="gc-inline-error" role="alert">{error}</p>}
  </div>;
}

function CommentRow({ c, footer }: { c: CommunityComment; footer?: ReactNode }) {
  return <li className="gc-mine-comment"><div><p>{c.text}</p><span>{c.attribution} · {fmtDate(c.createdAt, false)}</span></div><StatusChip status={c.status} />{footer}</li>;
}

export function CommunityPanel({ apiBase = "/api", loginHref = "/login" }: { apiBase?: string; loginHref?: string }) {
  const [version, setVersion] = useState(0);
  const [showExpired, setShowExpired] = useState(false);
  const [message, setMessage] = useState("");
  const [session, retrySession] = useLoad<Session>("/auth/session", apiBase, version);
  const signedIn = session.status === "ready" && session.data.authenticated;
  const [feed, retryFeed] = useLoad<{ items: CommunityItem[] }>(`/community/items${showExpired ? "?includeExpired=true" : ""}`, apiBase, version);
  const [mine, retryMine] = useLoad<CommunityMine>(signedIn ? "/community/mine" : null, apiBase, version);
  const roles = mine.status === "ready" ? mine.data.roles : [];
  const isMod = roles.includes("moderator");
  const isOwner = hasOrganizationRole(roles);
  const canSubmit = roles.includes("contributor") || isOwner;
  const [queue, retryQueue] = useLoad<{ items: CommunityItem[]; comments: CommunityComment[] }>(isMod ? "/community/moderation" : null, apiBase, version);
  const done = useCallback((msg: string) => { setMessage(msg); setVersion((v) => v + 1); }, []);
  const feedItems = feed.status === "ready" ? feed.data.items : [];
  const itemTitle = useMemo(() => Object.fromEntries(feedItems.map((i) => [i.id, i.title])), [feedItems]);

  return <div className="gc-root">
    <header className="gc-head">
      <p className="gc-eyebrow">Gosie Communities</p>
      <h2>For people. Made better by local knowledge.</h2>
      <p className="gc-lede">Gosie Communities helps people find useful events and local gems—not an advertising directory. People come first; invited contributors, restaurants, venues, municipalities, and nonprofits can share local knowledge, with every submission reviewed before it appears.</p>
      <p className="gc-fine">Approval means "worth knowing about" — not a guarantee of tickets, tables, prices, or opening hours. Check the source before you go.</p>
    </header>
    {message && <div className="gc-toast" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">Close</button></div>}

    <section className="gc-section" aria-labelledby="gc-feed-h">
      <div className="gc-section-head">
        <h3 id="gc-feed-h">Approved by the community</h3>
        <label className="gc-toggle"><input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} /><span>Include past events</span></label>
      </div>
      {feed.status === "loading" ? <Skeleton label="Loading community picks" /> :
        feed.status === "error" ? <ErrorBox what="Community picks" message={feed.message} onRetry={retryFeed} /> :
        feedItems.length === 0 ? <Empty title="Nothing approved yet.">When a suggestion passes review it will appear here with its credit and source.</Empty> :
        <div className="gc-grid">{feedItems.map((item) => <ItemCard key={item.id} item={item} footer={isOwner ? <OwnerComment item={item} apiBase={apiBase} onDone={done} /> : undefined} />)}</div>}
    </section>

    {session.status === "loading" ? <Skeleton label="Checking your sign-in" /> :
      session.status === "error" ? <ErrorBox what="Your sign-in status" message={session.message} onRetry={retrySession} /> :
      !signedIn ? <section className="gc-section gc-invite"><h3>Want to help your community?</h3><p>Sign in to see your suggestions and their review status. Sharing is open to invited people and designated restaurants, venues, municipalities, and nonprofits. Organization access is assigned separately; it never allows self-publishing.</p><a className="gc-btn" href={loginHref}>Sign in</a></section> :
      <>
        <section className="gc-section" aria-labelledby="gc-mine-h">
          <div className="gc-section-head"><h3 id="gc-mine-h">Your suggestions</h3><span className="gc-private">Pending and rejected: you and moderators only</span></div>
          {mine.status === "loading" ? <Skeleton label="Loading your suggestions" /> :
            mine.status === "error" ? <ErrorBox what="Your suggestions" message={mine.message} onRetry={retryMine} /> :
            mine.data.items.length + mine.data.comments.length === 0 ? <Empty title="You haven't shared anything yet.">{canSubmit ? "Use the form below — you'll see each suggestion's review status here." : "Your account isn't set up to share yet. You can still browse everything approved above."}</Empty> :
            <>
              {mine.data.items.length > 0 && <div className="gc-grid">{mine.data.items.map((item) => <ItemCard key={item.id} item={item} showStatus />)}</div>}
              {mine.data.comments.length > 0 && <><h4 className="gc-subhead">Your organization notes</h4><ul className="gc-mine-comments">{mine.data.comments.map((c) => <CommentRow key={c.id} c={c} />)}</ul></>}
            </>}
        </section>
        {canSubmit && <section className="gc-section gc-submit" aria-labelledby="gc-submit-h"><h3 id="gc-submit-h">Suggest an event or gem</h3><SubmitForm apiBase={apiBase} onDone={done} /></section>}
        {isMod && <section className="gc-section gc-mod" aria-labelledby="gc-mod-h">
          <div className="gc-section-head"><h3 id="gc-mod-h">Waiting for review</h3><span className="gc-private">Moderators only</span></div>
          <p className="gc-fine">Your own submissions are reviewed by someone else.</p>
          {queue.status === "loading" ? <Skeleton label="Loading review queue" /> :
            queue.status === "error" ? <ErrorBox what="The review queue" message={queue.message} onRetry={retryQueue} /> :
            queue.data.items.length + queue.data.comments.length === 0 ? <Empty title="All caught up.">No suggestions or notes are waiting.</Empty> :
            <>
              {queue.data.items.length > 0 && <div className="gc-grid">{queue.data.items.map((item) => <ItemCard key={item.id} item={item} showStatus footer={<Decide kind="items" id={item.id} apiBase={apiBase} onDone={done} />} />)}</div>}
              {queue.data.comments.length > 0 && <><h4 className="gc-subhead">Restaurant notes</h4><ul className="gc-mine-comments">{queue.data.comments.map((c) => <CommentRow key={c.id} c={{ ...c, text: itemTitle[c.itemId] ? `On “${itemTitle[c.itemId]}”: ${c.text}` : c.text }} footer={<Decide kind="comments" id={c.id} apiBase={apiBase} onDone={done} />} />)}</ul></>}
            </>}
        </section>}
      </>}
  </div>;
}

function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export function CommunityDiscoveries({ weekStart, apiBase = "/api", communityHref }: { weekStart?: string; apiBase?: string; communityHref?: string }) {
  const [feed, retry] = useLoad<{ items: CommunityItem[] }>("/community/items", apiBase, 0);
  const { start, end } = useMemo(() => communityWeekWindow(weekStart ? new Date(`${weekStart.slice(0, 10)}T12:00:00`) : new Date()), [weekStart]);
  const items = feed.status === "ready" ? feed.data.items : [];
  const events = useMemo(() => communityEventsInWindow(items, start, end), [items, start, end]);
  const gems = useMemo(() => items.filter((i) => i.kind === "gem" && i.status === "approved"), [items]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, n) => {
    const d0 = new Date(start); d0.setDate(d0.getDate() + n);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    return { key: dayKey(d0), label: d0.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      items: events.filter((e) => new Date(e.startsAt as string) < d1 && new Date(e.endsAt as string) > d0) };
  }).filter((d) => d.items.length), [events, start]);
  return <section className="gc-root gc-discover" aria-labelledby="gc-disc-h">
    <div className="gc-section-head">
      <div><p className="gc-eyebrow">From Gosie Communities · contributor suggestions</p><h3 id="gc-disc-h">Happening around this week</h3></div>
      {communityHref && <a className="gc-link" href={communityHref}>Open Communities</a>}
    </div>
    <p className="gc-fine">Separate from your plans and from any fictional samples. Credited to the people who shared them; approval isn't a promise of availability.</p>
    {feed.status === "loading" ? <Skeleton label="Loading community discoveries" /> :
      feed.status === "error" ? <ErrorBox what="Community discoveries" message={feed.message} onRetry={retry} /> :
      <>
        {days.length === 0 ? <Empty title="No community events this week.">Approved events will appear here on each day they run.</Empty> :
          <div className="gc-days">{days.map((d) => <div className="gc-day" key={d.key}><h4>{d.label}</h4><div className="gc-grid">{d.items.map((i) => <ItemCard key={`${d.key}-${i.id}`} item={i} />)}</div></div>)}</div>}
        {gems.length > 0 && <div className="gc-day gc-gems"><h4>Anytime local gems</h4><div className="gc-grid">{gems.map((i) => <ItemCard key={i.id} item={i} />)}</div></div>}
      </>}
  </section>;
}

export default CommunityPanel;
