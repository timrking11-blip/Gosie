import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Compass, FilePlus2, Heart, LoaderCircle, MapPin, Pencil, Plus, Settings2,
  Sparkles, Trash2, X,
} from "lucide-react";
import {
  useCarryForwardWeekItem, useCopyDemoProfile, useCopyDemoWeek, useCreateProfile, useCreateWeekItem,
  useDeleteAccount, useDeleteProfile, useDeleteWeekItem, useDemoProfiles, useExportProfile,
  useFeedback, useImportProfile, useLogout, useProfiles, useSession, useSubmitFeedback,
  useUpdateProfile, useUpdateWeekItem, useWeek, useWeekend,
} from "@workspace/api-client-react";
import type { Profile, ProfileConfig, ProfileExport, SocialContext, WeekItem, WeekendIdea } from "../../../../lib/api-client-react/src/generated/api.schemas";
import { ProductShell, PageHeading, Notice } from "@/components/product/ProductShell";
import { groupPlans, localDate } from "@/lib/planning";
import * as Dialog from "@radix-ui/react-dialog";
import ResearchedDiscoveries from "@/components/product/ResearchedDiscoveries";
import "@/research-discoveries.css";
import { TimeSelect } from "@workspace/community/time";
const CommunityPanel = lazy(() => import("@workspace/community/panel").then((module) => ({ default: module.CommunityPanel })));
const CommunityDiscoveries = lazy(() => import("@workspace/community/panel").then((module) => ({ default: module.CommunityDiscoveries })));

export const Route = createFileRoute("/app")({ component: AppPage });

const freshConfig: ProfileConfig = {
  schemaVersion: "1.0.0-draft", balance: "balanced", weekGrouping: "chronological",
  budgetPerActivity: 60, budgetHard: false, maxTravelMinutes: 45, exceptionTravelMinutes: 75,
  allowExceptions: true, transportModes: ["walking", "transit"], homeBase: "",
  weekendInterests: [], customInterests: [], socialContexts: ["solo", "friends", "date", "group", "family"],
  surpriseMe: false, balancedPriorities: [], customSections: [],
};
const socialOptions: { value: SocialContext; label: string }[] = [
  { value: "all", label: "Any company" }, { value: "solo", label: "Just me" }, { value: "friends", label: "Friends" },
  { value: "date", label: "A date" }, { value: "group", label: "A group" }, { value: "family", label: "Family" },
];
const interestOptions = ["Arts, museums, and theater", "Restaurants and food", "Outdoors", "Live music", "Learning and workshops", "Hidden gems"];

function weekDate(date = new Date()) {
  const monday = new Date(date);
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  return localDate(monday);
}
function shiftWeek(start: string, amount: number) {
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + amount * 7);
  return localDate(date);
}
function shortWeek(start: string) {
  const d = new Date(`${start}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}
function AppPage() {
  const session = useSession();
  if (session.isLoading) return <main className="product-loading" aria-label="Loading Gosie"><div className="loading-mark" /><div className="loading-line" /><div className="loading-line short" /></main>;
  if (!session.data?.authenticated) return <main className="product-guest">
    <div className="guest-card"><div className="guest-seal"><Compass size={24} /></div><p className="product-eyebrow">YOUR GOSIE SPACE</p><h1>A little room for everything ahead.</h1>
      <p>Sign in to see your plans and preferences. Until then, we won't ask for any personal details here.</p>
      <Link className="product-primary" to="/login">Go to sign in <ChevronRight size={17} /></Link>
      {session.isError && <button className="text-button" onClick={() => session.refetch()}>Try again</button>}
    </div>
  </main>;
  return <Dashboard email={session.data.user?.email || ""} />;
}

function Dashboard({ email }: { email: string }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const initialView = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("view");
  const [view, setView] = useState<"week" | "weekend" | "community" | "settings">(initialView === "weekend" || initialView === "settings" || initialView === "community" ? initialView : "week");
  const [profileId, setProfileId] = useState("");
  const [weekStart, setWeekStart] = useState(weekDate());
  const [sampleItemIds, setSampleItemIds] = useState<string[]>([]);
  const [fictionalProfileIds, setFictionalProfileIds] = useState<string[]>([]);
  const profilesQuery = useProfiles();
  const profiles = profilesQuery.data || [];
  const activeProfile = profiles.find((profile) => profile.id === profileId) || profiles[0];
  const chosenId = activeProfile?.id;
  const weekQuery = useWeek(chosenId, weekStart);
  const weekendQuery = useWeekend(chosenId);
  const feedbackQuery = useFeedback(chosenId);
  const demosQuery = useDemoProfiles();
  const logout = useLogout();
  const createProfile = useCreateProfile();
  const copyProfile = useCopyDemoProfile();
  const copyDemoWeekMut = useCopyDemoWeek();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();
  const deleteAccount = useDeleteAccount();
  const exportProfile = useExportProfile();
  const importProfile = useImportProfile();
  const submitFeedback = useSubmitFeedback();
  const [planEditor, setPlanEditor] = useState<WeekItem | null | "new">(null);
  const [profileEditor, setProfileEditor] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const searchView = new URLSearchParams(loc.searchStr).get("view");
    setView(searchView === "weekend" || searchView === "settings" || searchView === "community" ? searchView : "week");
  }, [loc.searchStr]);
  useEffect(() => {
    if (!profileId && profiles.length) setProfileId(profiles[0].id);
  }, [profiles, profileId]);
  function changeView(next: "week" | "weekend" | "community" | "settings") {
    setView(next);
    navigate({ to: "/app", search: next === "week" ? {} : { view: next } as never, replace: true });
  }
  async function exportCurrent() {
    if (!chosenId) return;
    try {
      const data = await exportProfile.mutateAsync(chosenId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${activeProfile?.title || "gosie-profile"}.gosie.json`; link.click();
      URL.revokeObjectURL(url);
      setNotice("Your profile file has been downloaded.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Export could not be completed."); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ProfileExport;
      if (parsed.schemaVersion !== "1.0.0-draft" || !parsed.config || !parsed.title) throw new Error("This file isn't a Gosie profile export.");
      const imported = await importProfile.mutateAsync(parsed);
      setProfileId(imported.id);
      setNotice("Profile imported.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "That file could not be imported."); }
  }
  async function makeProfile(title: string, config: ProfileConfig) {
    const profile = await createProfile.mutateAsync({ title, config });
    setProfileId(profile.id);
    setProfileEditor(false);
    setNotice("Your profile is ready.");
  }
  const onSignOut = async () => {
    try { await logout.mutateAsync(); navigate({ to: "/login" }); }
    catch { setNotice("Sign-out could not be completed. Please try again."); }
  };
  if (profilesQuery.isLoading) return <div className="product-loading"><div className="loading-mark" /><div className="loading-line" /><div className="loading-line short" /></div>;
  if (profilesQuery.isError) return <ProductShell email={email}><div className="product-content"><Notice tone="error">We couldn't load your profiles. {profilesQuery.error.message}</Notice><button className="product-primary" onClick={() => profilesQuery.refetch()}>Retry</button></div></ProductShell>;
  return <ProductShell email={email} active={view} onSignOut={onSignOut}>
    <div className="product-content">
      <div className="product-toolbar">
        <div className="profile-picker-wrap">
          <label htmlFor="profile-picker">Planning for</label>
          <div className="profile-picker"><select id="profile-picker" value={chosenId || ""} onChange={(e) => setProfileId(e.target.value)} aria-label="Select a profile">
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select><ChevronDown size={15} /></div>
        </div>
        <button type="button" className="text-button" onClick={() => setProfileEditor(true)}><Plus size={16} /> New profile</button>
      </div>
      {notice && <div className="inline-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}
      {view === "community" ? <Suspense fallback={<p role="status">Loading Communities…</p>}><CommunityPanel /></Suspense> : !activeProfile ? <EmptyProfiles demos={demosQuery.data || []} onCopy={async (id, title) => {
        try {
          const copied = await copyProfile.mutateAsync({ demoId: id, title });
          setProfileId(copied.id);
          if (copied.sampleWeekAdded) setFictionalProfileIds((current) => [...new Set([...current, copied.id])]);
          setNotice(copied.sampleWeekAdded ? "A copy of the fictional profile and its fictional sample week was added. Sample content is not your personal plan." : "A copy of the fictional sample profile was added. Its sample week is not your personal plan.");
        } catch (error) { setNotice(error instanceof Error ? error.message : "The sample profile could not be copied."); }
      }} onCreate={() => setProfileEditor(true)} loading={copyProfile.isPending} error={demosQuery.isError ? demosQuery.error.message : ""} retry={() => demosQuery.refetch()} /> :
        view === "week" ? <WeekView
          profile={activeProfile} data={weekQuery.data} loading={weekQuery.isLoading} error={weekQuery.isError ? weekQuery.error.message : ""} sampleItemIds={sampleItemIds} fictionalProfile={fictionalProfileIds.includes(activeProfile.id)}
          weekStart={weekStart} setWeekStart={setWeekStart} grouping={activeProfile.config.weekGrouping}
          onAdd={() => setPlanEditor("new")} onEdit={(item) => setPlanEditor(item)}
          copyDemoWeekPending={copyDemoWeekMut.isPending} onCopySample={async () => {
            if (window.confirm("Add the clearly fictional sample week to this profile? It will be marked as a sample in your plan.")) {
              try {
                const result = await copyDemoWeekMut.mutateAsync({ profileId: activeProfile.id, weekStart });
                setSampleItemIds((previous) => [...new Set([...previous, ...result.items.map((item) => item.id)])]);
                setNotice("Fictional sample week copied. Sample items are marked in your list.");
              }
              catch (error) { setNotice(error instanceof Error ? error.message : "Sample week could not be copied."); }
            }
          }}
          onRetry={() => weekQuery.refetch()}
        /> : view === "weekend" ? <WeekendView profile={activeProfile} data={weekendQuery.data} loading={weekendQuery.isLoading}
          error={weekendQuery.isError ? weekendQuery.error.message : ""} feedback={feedbackQuery.data || []}
          onRetry={() => weekendQuery.refetch()} onFeedback={(idea, action, rating, value) => submitFeedback.mutateAsync({ profileId: activeProfile.id, itemId: idea.id, action, rating, value })}
          onManage={() => changeView("settings")} /> : <SettingsView
          profile={activeProfile} onSave={async (title, config) => { await updateProfile.mutateAsync({ id: activeProfile.id, title, config }); setNotice("Preferences saved."); }}
          onDelete={async () => { if (window.confirm(`Delete “${activeProfile.title}” and its Gosie data? This cannot be undone.`)) { try { await deleteProfile.mutateAsync(activeProfile.id); setProfileId(""); setNotice("Profile deleted."); } catch (error) { setNotice(error instanceof Error ? error.message : "Profile could not be deleted."); } } }}
          onExport={exportCurrent} onImport={importFile} onDeleteAccount={async () => { if (window.confirm("Delete your account and all associated Gosie data? This cannot be undone.")) { try { await deleteAccount.mutateAsync(); navigate({ to: "/" }); } catch (error) { setNotice(error instanceof Error ? error.message : "Account could not be deleted."); } } }}
          saving={updateProfile.isPending} working={deleteProfile.isPending || exportProfile.isPending || importProfile.isPending || deleteAccount.isPending}
        />}
      {profileEditor && <ProfileCreateDialog onClose={() => setProfileEditor(false)} onCreate={makeProfile} busy={createProfile.isPending} />}
      {planEditor && activeProfile && <PlanDialog item={planEditor === "new" ? null : planEditor} profileId={activeProfile.id} weekStart={weekStart} onClose={() => setPlanEditor(null)} onSaved={() => { setPlanEditor(null); setNotice("Plan updated."); }} />}
    </div>
  </ProductShell>;

}

function EmptyProfiles({ demos, onCopy, onCreate, loading, error, retry }: { demos: Profile[]; onCopy: (id: string, title: string) => void; onCreate: () => void; loading: boolean; error: string; retry: () => void }) {
  return <section className="empty-space">
    <div className="empty-orbit"><Compass size={32} /></div><p className="product-eyebrow">A FRESH START</p><h1>Your plans have a place.</h1>
    <p>Create a personal profile, or copy a clearly fictional sample profile to explore how Gosie works. Sample plans will always be labelled.</p>
    <div className="empty-actions"><button className="product-primary" onClick={onCreate}><Plus size={17} /> Create your profile</button></div>
    {error ? <div className="demo-shelf"><Notice tone="error">Sample profiles couldn't load: {error}</Notice><button className="text-button" onClick={retry}>Try again</button></div> :
      demos.length > 0 && <div className="demo-shelf"><p className="product-eyebrow">OPTIONAL FICTIONAL STARTING POINT</p>{demos.map((demo) => <div className="demo-row" key={demo.id}>
        <div><strong>{demo.title}</strong><span>Fictional profile · not a real person's plans</span></div>
        <button className="secondary-button" disabled={loading} onClick={() => onCopy(demo.id, `${demo.title} · copy`)}><FilePlus2 size={15} /> Copy</button>
      </div>)}</div>}
  </section>;
}

function WeekView({ profile, data, loading, error, weekStart, setWeekStart, grouping, onAdd, onEdit, onCopySample, onRetry, sampleItemIds, fictionalProfile, copyDemoWeekPending }: {
  profile: Profile; data?: { items: WeekItem[]; why: string[] }; loading: boolean; error: string; weekStart: string; sampleItemIds: string[]; fictionalProfile: boolean;
  setWeekStart: (value: string) => void; grouping: ProfileConfig["weekGrouping"]; onAdd: () => void; onEdit: (item: WeekItem) => void;
  onCopySample: () => void; onRetry: () => void; copyDemoWeekPending: boolean;
}) {
  const updateProfile = useUpdateProfile();
  const updateGroup = async (next: ProfileConfig["weekGrouping"]) => {
    await updateProfile.mutateAsync({ id: profile.id, title: profile.title, config: { ...profile.config, weekGrouping: next } });
  };
  const items = data?.items || [];
  const grouped = useMemo(() => groupPlans(items, grouping), [grouping, items]);
  const done = items.filter((item) => item.completed).length;
  return <section>
    <PageHeading eyebrow="YOUR WEEK · A LITTLE MORE IN VIEW" title="Week Ahead">
      Plans and priorities, held in one place. Keep it yours; change it as life changes.
    </PageHeading>
    <div className="week-summary">
      <div><span className="summary-icon"><CalendarDays size={18} /></span><div><strong>{items.length} plans</strong><span>{done} marked complete</span></div></div>
      <div className="week-controls">
        <button type="button" aria-label="Previous week" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}><ChevronLeft size={18} /></button>
        <span>{shortWeek(weekStart)}</span>
        <button type="button" aria-label="Next week" onClick={() => setWeekStart(shiftWeek(weekStart, 1))}><ChevronRight size={18} /></button>
        {weekStart !== weekDate() && <button className="today-link" onClick={() => setWeekStart(weekDate())}>Today</button>}
      </div>
    </div>
    <div className="section-controls">
      <div className="segmented" role="group" aria-label="Group plans">
        {(["chronological", "category", "company"] as const).map((key) => <button key={key} type="button" aria-pressed={grouping === key} onClick={() => updateGroup(key)}>{key === "chronological" ? "By day" : key === "category" ? "By kind" : "By company"}</button>)}
      </div>
      <button className="product-primary compact" type="button" onClick={onAdd}><Plus size={16} /> Add a plan</button>
    </div>
    {updateProfile.isError && <Notice tone="error">Grouping could not be saved. Try again.</Notice>}
    {loading ? <SkeletonCards /> : error ? <div className="panel-error"><Notice tone="error">Your week couldn't load. {error}</Notice><button className="secondary-button" onClick={onRetry}>Retry</button></div> :
      items.length === 0 ? <div className="week-empty"><div className="empty-orbit small"><CalendarDays size={22} /></div><h2>A little open space.</h2><p>Add a plan you want to remember, or bring in an optional fictional sample week to see the layout.</p><div className="empty-actions"><button className="product-primary compact" onClick={onAdd}><Plus size={16} /> Add a plan</button><button className="secondary-button" disabled={copyDemoWeekPending} onClick={onCopySample}>{copyDemoWeekPending ? "Adding…" : "Copy fictional sample week"}</button></div></div> :
      <div className={`week-grid grouping-${grouping}`}>{Object.entries(grouped).map(([group, groupItems]) => <section className="day-column" key={group}>
        <div className="day-heading"><span>{group}</span><span>{groupItems.length}</span></div>
        <div className="plan-list">{groupItems.map((item) => <PlanCard key={item.id} item={item} sample={fictionalProfile || sampleItemIds.includes(item.id)} profileId={profile.id} weekStart={weekStart} onEdit={() => onEdit(item)} />)}</div>
      </section>)}</div>}
    <div className="week-note"><CircleHelp size={15} /><span>Only plans you add or import appear here. Gosie isn't connected to your calendar.</span></div>
    <Suspense fallback={<p role="status">Loading community discoveries…</p>}><CommunityDiscoveries weekStart={weekStart} communityHref="/app?view=community" /></Suspense>
  </section>;
}

function PlanCard({ item, sample, profileId, weekStart, onEdit }: { item: WeekItem; sample: boolean; profileId: string; weekStart: string; onEdit: () => void }) {
  const update = useUpdateWeekItem();
  const remove = useDeleteWeekItem();
  const carry = useCarryForwardWeekItem();
  const isSample = item.sourceType === "fictional-demo" || sample;
  return <article className={`plan-card ${item.completed ? "plan-complete" : ""}`}>
    <div className={`plan-domain domain-${item.domain}`} aria-hidden="true" />
    <div className="plan-card-main">
      <div className="plan-topline"><span className="plan-time">{item.timeLabel || "Any time"}</span><span className="plan-priority">{item.priority}</span></div>
      <h3>{item.title}</h3>
      <div className="plan-meta"><span>{item.category}</span>{item.company && <><i /> <span>{item.company}</span></>}</div>
      {isSample && <span className="sample-label">Fictional sample</span>}
    </div>
    <div className="plan-actions">
      <button type="button" aria-label={item.completed ? "Mark as not complete" : "Mark as complete"} title={item.completed ? "Mark as not complete" : "Mark as complete"}
        className={`icon-button ${item.completed ? "is-checked" : ""}`} onClick={() => update.mutate({ profileId, weekStart, itemId: item.id, update: { completed: !item.completed } })}><Check size={16} /></button>
      <button type="button" aria-label={`Edit ${item.title}`} className="icon-button" onClick={onEdit}><Pencil size={15} /></button>
      <button type="button" aria-label={`Carry ${item.title} forward`} title="Carry forward" className="icon-button" onClick={() => carry.mutate({ profileId, weekStart, itemId: item.id })}><ArrowDownToLine size={15} /></button>
      <button type="button" aria-label={`Delete ${item.title}`} className="icon-button danger-icon" onClick={() => { if (window.confirm(`Delete “${item.title}”?`)) remove.mutate({ profileId, weekStart, itemId: item.id }); }}><Trash2 size={15} /></button>
    </div>
    {(update.isError || remove.isError || carry.isError) && <p role="alert">This change could not be saved. Please try again.</p>}
  </article>;
}

function SkeletonCards() { return <div className="skeleton-list" aria-label="Loading plans"><div /><div /><div /></div>; }

function PlanDialog({ item, profileId, weekStart, onClose, onSaved }: { item: WeekItem | null; profileId: string; weekStart: string; onClose: () => void; onSaved: () => void }) {
  const create = useCreateWeekItem();
  const update = useUpdateWeekItem();
  const [title, setTitle] = useState(item?.title || "");
  const [day, setDay] = useState(item?.day || weekStart);
  const [timeLabel, setTime] = useState(item?.timeLabel || "");
  const [category, setCategory] = useState(item?.category || "Personal");
  const [company, setCompany] = useState(item?.company || "");
  const [domain, setDomain] = useState<WeekItem["domain"]>(item?.domain || "personal");
  const [priority, setPriority] = useState<WeekItem["priority"]>(item?.priority || "Medium");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const value = { title: title.trim(), day, timeLabel: timeLabel.trim() || null, category, company: company.trim() || null, domain, priority, completed: item?.completed || false };
      if (item) await update.mutateAsync({ profileId, weekStart, itemId: item.id, update: value });
      else await create.mutateAsync({ profileId, weekStart, item: value });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "The plan couldn't be saved."); }
  }
  const busy = create.isPending || update.isPending;
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="product-modal-backdrop">
    <Dialog.Content className="product-modal" aria-describedby={undefined}>
      <div className="modal-head"><div><p className="product-eyebrow">{item ? "MAKE A CHANGE" : "ADD SOMETHING TO YOUR WEEK"}</p><Dialog.Title asChild><h2>{item ? "Edit this plan" : "A plan to remember"}</h2></Dialog.Title></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      {error && <Notice tone="error">{error}</Notice>}
      <form className="product-form" onSubmit={submit}>
        <label htmlFor="plan-title">What's the plan?</label><input id="plan-title" autoFocus required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-row"><div><label htmlFor="plan-day">Date</label><input id="plan-day" type="date" required value={day} onChange={(e) => setDay(e.target.value)} /></div><div><label htmlFor="plan-time">Time</label><TimeSelect id="plan-time" emptyLabel="Any time" value={timeLabel} onChange={(e) => setTime(e.target.value)} /></div></div>
        <div className="form-row"><div><label htmlFor="plan-kind">Kind</label><input id="plan-kind" value={category} onChange={(e) => setCategory(e.target.value)} required /></div><div><label htmlFor="plan-priority">Priority</label><select id="plan-priority" value={priority} onChange={(e) => setPriority(e.target.value as WeekItem["priority"])}><option>High</option><option>Medium</option><option>Low</option></select></div></div>
        <div className="form-row"><div><label htmlFor="plan-domain">For</label><select id="plan-domain" value={domain} onChange={(e) => setDomain(e.target.value as WeekItem["domain"])}><option value="personal">Personal</option><option value="professional">Work</option></select></div><div><label htmlFor="plan-company">Company or project</label><input id="plan-company" value={company} onChange={(e) => setCompany(e.target.value)} /></div></div>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="product-primary compact" type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add to week"}</button></div>
      </form>
    </Dialog.Content>
  </Dialog.Overlay></Dialog.Portal></Dialog.Root>;
}

function WeekendView({ profile, data, loading, error, feedback, onRetry, onFeedback, onManage }: {
  profile: Profile; data?: { included: WeekendIdea[]; exceptions: WeekendIdea[]; excluded: WeekendIdea[]; dismissed: WeekendIdea[] };
  loading: boolean; error: string; feedback: { itemId: string; action: string; rating: number | null }[];
  onRetry: () => void; onFeedback: (idea: WeekendIdea, action: "saved" | "dismissed" | "rating", rating?: number, value?: boolean) => Promise<unknown>; onManage: () => void;
}) {
  const [social, setSocial] = useState<SocialContext>("all");
  const weekend = useWeekend(profile.id, social);
  const response = social === "all" ? data : weekend.data;
  const ideas = [...(response?.included || []), ...(response?.exceptions || [])];
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { setOpenWhy(null); }, [social]);
  const isLoading = loading || (social !== "all" && weekend.isLoading);
  const errorText = social === "all" ? error : weekend.isError ? weekend.error.message : "";
  return <section className="weekend-page">
    <PageHeading eyebrow="YOUR WEEKEND · ROOM TO WANDER" title="Weekend Ahead">
      Fictional sample ideas ranked using this profile's interests, limits, and feedback. Listings, prices, and travel times are illustrative—not live or verified.
    </PageHeading>
    <ResearchedDiscoveries />
    <div className="weekend-intro">
      <div className="weekend-intro-mark"><Sparkles size={20} /></div><div><strong>Make it your kind of weekend.</strong><span>Adjust interests and limits in your profile preferences.</span></div>
      <button className="text-button" onClick={onManage}>Tune preferences <ChevronRight size={15} /></button>
    </div>
    <div className="social-picker"><span>Who are you thinking of?</span><div className="social-chips" role="group" aria-label="Choose social context">{socialOptions.map(({ value, label }) =>
      <button type="button" key={value} aria-pressed={social === value} onClick={() => setSocial(value)}>{label}</button>)}</div></div>
    {message && <div className="inline-notice" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss message"><X size={15} /></button></div>}
    {isLoading ? <SkeletonCards /> : errorText ? <div className="panel-error"><Notice tone="error">Weekend suggestions couldn't load. {errorText}</Notice><button className="secondary-button" onClick={onRetry}>Retry</button></div> :
      ideas.length === 0 ? <div className="week-empty"><div className="empty-orbit small"><Sparkles size={22} /></div><h2>Nothing to suggest just yet.</h2><p>Try another social setting or revisit your weekend interests.</p></div> :
        <div className="idea-grid">{ideas.map((idea) => <WeekendCard key={idea.id} idea={idea} isOpen={openWhy === idea.id} onToggle={() => setOpenWhy(openWhy === idea.id ? null : idea.id)}
          existingFeedback={feedback.filter((f) => f.itemId === idea.id)} onFeedback={async (action, rating, value) => {
            try { await onFeedback(idea, action, rating, value); setMessage(action === "saved" ? (value ? "Saved for later." : "Removed from saved ideas.") : action === "dismissed" ? "We'll leave this one out." : "Thanks — your rating has been recorded."); }
            catch (e) { setMessage(e instanceof Error ? e.message : "Feedback could not be saved."); }
          }} />)}</div>}
    {!isLoading && !errorText && (["excluded", "dismissed"] as const).map((status) => <details key={status} className="demo-shelf">
      <summary>{status === "excluded" ? "Outside your limits" : "Dismissed ideas"} ({response?.[status].length || 0})</summary>
      <div className="idea-grid">{(response?.[status] || []).map((idea) => <WeekendCard key={idea.id} idea={idea}
        isOpen={openWhy === idea.id} onToggle={() => setOpenWhy(openWhy === idea.id ? null : idea.id)}
        existingFeedback={feedback.filter((f) => f.itemId === idea.id)} onFeedback={async (action, rating, value) => {
          try { await onFeedback(idea, action, rating, value); setMessage("Feedback updated for this profile."); }
          catch (e) { setMessage(e instanceof Error ? e.message : "Feedback could not be saved."); }
        }} />)}</div>
    </details>)}
    <p className="weekend-footnote"><CircleHelp size={15} /> Fictional data only. Social context changes ranking, never hard limits. Saved ideas and your latest rating affect this profile's order; this is not learned personalization.</p>
  </section>;
}

function WeekendCard({ idea, isOpen, onToggle, onFeedback, existingFeedback }: { idea: WeekendIdea; isOpen: boolean; onToggle: () => void; existingFeedback: { action: string; rating: number | null }[]; onFeedback: (action: "saved" | "dismissed" | "rating", rating?: number, value?: boolean) => void }) {
  const saved = existingFeedback.some((item) => item.action === "saved") || idea.saved;
  const rating = [...existingFeedback].reverse().find((item) => item.action === "rating")?.rating ?? idea.rating;
  return <article className="idea-card">
    <div className="idea-art" aria-hidden="true"><span className="idea-art-orbit" /><span className="idea-art-index">{idea.category.slice(0, 1).toUpperCase()}</span></div>
    <div className="idea-card-body">
      <div className="idea-card-top"><span className="idea-category">{idea.category}</span><span className={`idea-status status-${idea.status}`}>{idea.status === "exception" ? "A little farther" : idea.status === "included" ? "A good fit" : idea.status}</span></div>
      <h2>{idea.name}</h2>
      <div className="idea-facts"><span><MapPin size={14} />{idea.travelMinutes} min</span><span><Clock3 size={14} />{idea.transport}</span><span>{idea.price === 0 ? "Free" : `$${idea.price}`}</span></div>
      <button className="why-toggle" type="button" aria-expanded={isOpen} onClick={onToggle}>Why this idea? <ChevronDown size={15} className={isOpen ? "rotate" : ""} /></button>
      {isOpen && <div className="idea-explanation"><strong>What stood out</strong><ul>{(idea.why.length ? idea.why : ["A match with the preferences in this profile."]).map((reason) => <li key={reason}>{reason}</li>)}</ul>{idea.excludeReasons.length > 0 && <p className="exclude-reason">A note: {idea.excludeReasons.join(" · ")}</p>}</div>}
      <div className="idea-actions">
        <button type="button" className={`save-idea ${saved ? "saved" : ""}`} aria-pressed={saved} onClick={() => onFeedback("saved", undefined, !saved)}><Heart size={16} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save idea"}</button>
        <button type="button" className="dismiss-idea" onClick={() => onFeedback("dismissed", undefined, idea.status !== "dismissed")}>{idea.status === "dismissed" ? "Restore idea" : "Not for me"}</button>
      </div>
      <div className="rating-row"><span>How does this feel?</span>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={Number(rating) >= star ? "rated" : ""} aria-label={`Rate ${star} out of 5`} aria-pressed={Number(rating) === star} onClick={() => onFeedback("rating", star)}>{star}</button>)}</div>
      {idea.sourceType === "fictional-demo" && <p className="fiction-tag">Fictional sample recommendation</p>}
    </div>
  </article>;
}

function SettingsView({ profile, onSave, onDelete, onExport, onImport, onDeleteAccount, saving, working }: {
  profile: Profile; onSave: (title: string, config: ProfileConfig) => Promise<void>; onDelete: () => void;
  onExport: () => void; onImport: (file?: File) => void; onDeleteAccount: () => void; saving: boolean; working: boolean;
}) {
  const [title, setTitle] = useState(profile.title);
  const [config, setConfig] = useState<ProfileConfig>(profile.config);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setTitle(profile.title); setConfig(profile.config); }, [profile.id, profile.title, profile.config]);
  const set = <K extends keyof ProfileConfig>(key: K, value: ProfileConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const toggleString = (key: "weekendInterests" | "transportModes" | "socialContexts", value: string) => {
    const current = config[key];
    set(key, (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]) as ProfileConfig[typeof key]);
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSavedMessage("");
    try { await onSave(title.trim(), config); setSavedMessage("Your preferences are saved."); }
    catch (e) { setError(e instanceof Error ? e.message : "Preferences could not be saved."); }
  }
  return <section>
    <PageHeading eyebrow="YOUR PREFERENCES · YOUR CALL" title="Make it feel like you.">
      Gosie uses these choices to shape your week and weekend. Change them whenever you like.
    </PageHeading>
    {error && <Notice tone="error">{error}</Notice>}{savedMessage && <Notice tone="success">{savedMessage}</Notice>}
    <form className="settings-form" onSubmit={submit}>
      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-number">01</span><div><h2>Your profile</h2><p>A name for this planning space.</p></div></div>
        <div className="settings-field"><label htmlFor="profile-title">Profile name</label><input id="profile-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} required /></div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-number">02</span><div><h2>Your week</h2><p>Choose how plans should come together.</p></div></div>
        <div className="settings-field"><label htmlFor="balance">Balance</label><select id="balance" value={config.balance} onChange={(e) => set("balance", e.target.value as ProfileConfig["balance"])}><option value="balanced">A bit of both</option><option value="professional">More work-focused</option><option value="personal">More life-focused</option></select></div>
        <div className="settings-field"><label htmlFor="grouping">Week grouping</label><select id="grouping" value={config.weekGrouping} onChange={(e) => set("weekGrouping", e.target.value as ProfileConfig["weekGrouping"])}><option value="chronological">By day and time</option><option value="category">By kind</option><option value="company">By company</option></select></div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-number">03</span><div><h2>Your weekend</h2><p>A few gentle boundaries for recommendations.</p></div></div>
        <div className="settings-field"><label htmlFor="homebase">Home base <span className="label-optional">optional</span></label><input id="homebase" value={config.homeBase || ""} onChange={(e) => set("homeBase", e.target.value)} placeholder="City or neighbourhood" /></div>
        <div className="settings-field"><label htmlFor="budget">Typical spend per activity</label><div className="number-unit"><span>$</span><input id="budget" type="number" min={0} max={10000} value={config.budgetPerActivity} onChange={(e) => set("budgetPerActivity", Number(e.target.value))} /></div></div>
        <Toggle label="Treat this budget as a firm limit" checked={config.budgetHard} onChange={(v) => set("budgetHard", v)} />
        <div className="settings-field"><label htmlFor="travel">Usual travel limit <span>{config.maxTravelMinutes} min</span></label><input id="travel" type="range" min={0} max={180} step={5} value={config.maxTravelMinutes} onChange={(e) => set("maxTravelMinutes", Number(e.target.value))} /></div>
        <Toggle label="Allow an occasional farther-away idea" checked={config.allowExceptions} onChange={(v) => set("allowExceptions", v)} />
        {config.allowExceptions && <div className="settings-field"><label htmlFor="exceptionTravel">Farther-away limit <span>{config.exceptionTravelMinutes} min</span></label><input id="exceptionTravel" type="range" min={config.maxTravelMinutes} max={240} step={5} value={config.exceptionTravelMinutes} onChange={(e) => set("exceptionTravelMinutes", Number(e.target.value))} /></div>}
        <fieldset className="settings-field"><legend>Getting around</legend><div className="check-chips">{["walking", "transit", "cycling", "driving"].map((mode) => <label key={mode}><input type="checkbox" checked={config.transportModes.includes(mode)} onChange={() => toggleString("transportModes", mode)} /><span>{mode === "transit" ? "public transit" : mode}</span></label>)}</div></fieldset>
        <fieldset className="settings-field"><legend>Interests to explore</legend><div className="check-chips interest-chips">{interestOptions.map((interest) => <label key={interest}><input type="checkbox" checked={config.weekendInterests.includes(interest)} onChange={() => toggleString("weekendInterests", interest)} /><span>{interest}</span></label>)}</div></fieldset>
        <div className="settings-field"><label htmlFor="custom-interests">Custom interests, one per line</label><textarea id="custom-interests" value={config.customInterests.map((interest) => interest.label).join("\n")} maxLength={5000} onChange={(e) => set("customInterests", e.target.value.split("\n").slice(0, 50).map((label, index) => ({ ...config.customInterests[index], label: label.slice(0, 200), specificInterest: label.slice(0, 200) })))} /><p className="form-help">These are simple keyword matches against fictional examples, not live discovery.</p></div>
        <fieldset className="settings-field"><legend>Good company for recommendations</legend><div className="check-chips">{socialOptions.filter((item) => item.value !== "all").map((item) => <label key={item.value}><input type="checkbox" checked={config.socialContexts.includes(item.value)} onChange={() => toggleString("socialContexts", item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
        <p className="form-help">Home base, balance, social preferences, and any imported variety setting are stored for portability only. Ranking currently uses interests, transport, budget, travel limits, your current social lens, and explicit feedback. Home base does not calculate travel.</p>
      </section>
      <div className="settings-save-row"><button type="submit" className="product-primary" disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button></div>
    </form>
    <section className="account-tools">
      <div className="settings-section-heading"><span className="settings-number">04</span><div><h2>Your Gosie data</h2><p>Keep a copy or bring in another profile export.</p></div></div>
      <div className="data-actions"><button className="secondary-button" type="button" disabled={working} onClick={onExport}><ArrowDownToLine size={16} /> Export this profile</button>
        <label className="secondary-button import-label"><ArrowUpFromLine size={16} /> Import profile<input type="file" accept="application/json,.json" disabled={working} onChange={(e) => { onImport(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label></div>
      <div className="danger-zone"><div><strong>Delete this profile</strong><p>Removes this profile and its plans and feedback.</p></div><button className="danger-button" type="button" disabled={working} onClick={onDelete}>Delete profile</button></div>
      <div className="danger-zone account-danger"><div><strong>Delete your account</strong><p>Permanently removes your account and all associated Gosie data.</p></div><button className="danger-button" type="button" disabled={working} onClick={onDeleteAccount}>Delete account</button></div>
    </section>
  </section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i aria-hidden="true" /></label>;
}

function ProfileCreateDialog({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (title: string, config: ProfileConfig) => void; busy: boolean }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await onCreate(title.trim(), freshConfig); } catch (err) { setError(err instanceof Error ? err.message : "Profile couldn't be created."); }
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="product-modal-backdrop">
    <Dialog.Content className="product-modal" aria-describedby={undefined}>
      <div className="modal-head"><div><p className="product-eyebrow">A SPACE OF YOUR OWN</p><Dialog.Title asChild><h2>Create a profile</h2></Dialog.Title></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      {error && <Notice tone="error">{error}</Notice>}<form className="product-form" onSubmit={submit}><label htmlFor="new-profile-title">What should we call it?</label><input id="new-profile-title" autoFocus required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. My week" /><p className="form-help">Start with balanced defaults. You can change your preferences at any time.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="product-primary compact" disabled={busy}>{busy ? "Creating…" : "Create profile"}</button></div></form>
    </Dialog.Content>
  </Dialog.Overlay></Dialog.Portal></Dialog.Root>;
}
