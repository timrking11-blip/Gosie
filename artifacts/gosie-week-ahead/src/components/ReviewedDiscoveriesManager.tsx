import { useEffect, useState } from 'react';
import { AlertTriangle, Check, CirclePlus, RotateCw, ShieldCheck } from 'lucide-react';
import { parseReviewedDiscoveries, type ReviewedDiscovery, type EvidenceStatus } from '../lib/reviewed-discoveries';

type State = 'draft' | 'approved' | 'withdrawn';
type ManagedEntry = ReviewedDiscovery & {
  status: State;
  version: number;
  canApprove: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  withdrawnAt: string | null;
};
type AccessState = 'loading' | 'signed-out' | 'forbidden' | 'ready' | 'unavailable';
type FormValue = {
  title: string; venue: string; region: string; startsAt: string;
  priceValue: string; priceStatus: EvidenceStatus;
  travelValue: string; travelStatus: EvidenceStatus;
  accessibilityValue: string; accessibilityStatus: EvidenceStatus;
  availabilityValue: string; availabilityStatus: EvidenceStatus;
  publisher: string; sourceUrl: string; retrievedAt: string; whyIncluded: string;
};
const fields: { key: 'price' | 'travel' | 'accessibility' | 'availability'; label: string; valueKey: keyof FormValue; statusKey: keyof FormValue }[] = [
  { key: 'price', label: 'Price', valueKey: 'priceValue', statusKey: 'priceStatus' },
  { key: 'travel', label: 'Travel', valueKey: 'travelValue', statusKey: 'travelStatus' },
  { key: 'accessibility', label: 'Accessibility', valueKey: 'accessibilityValue', statusKey: 'accessibilityStatus' },
  { key: 'availability', label: 'Availability', valueKey: 'availabilityValue', statusKey: 'availabilityStatus' },
];
const emptyForm: FormValue = {
  title: '', venue: '', region: '', startsAt: '',
  priceValue: '', priceStatus: 'unknown', travelValue: '', travelStatus: 'unknown',
  accessibilityValue: '', accessibilityStatus: 'unknown', availabilityValue: '', availabilityStatus: 'unknown',
  publisher: '', sourceUrl: '', retrievedAt: '', whyIncluded: '',
};

function dateForInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function dateToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function formFromEntry(entry: ManagedEntry): FormValue {
  return {
    title: entry.title, venue: entry.venue, region: entry.region, startsAt: dateForInput(entry.startsAt),
    priceValue: entry.price.value || '', priceStatus: entry.price.status,
    travelValue: entry.travel.value || '', travelStatus: entry.travel.status,
    accessibilityValue: entry.accessibility.value || '', accessibilityStatus: entry.accessibility.status,
    availabilityValue: entry.availability.value || '', availabilityStatus: entry.availability.status,
    publisher: entry.publisher, sourceUrl: entry.sourceUrl, retrievedAt: dateForInput(entry.retrievedAt),
    whyIncluded: entry.whyIncluded,
  };
}
function payloadFromForm(form: FormValue) {
  const evidence = Object.fromEntries(fields.map(({ key, label, valueKey, statusKey }) => {
    const status = form[statusKey] as EvidenceStatus;
    const value = (form[valueKey] as string).trim();
    return [key, { label, value: status === 'unknown' ? null : value, status }];
  }));
  return {
    title: form.title.trim(), venue: form.venue.trim(), region: form.region.trim(),
    startsAt: dateToIso(form.startsAt),
    ...evidence,
    publisher: form.publisher.trim(), sourceUrl: form.sourceUrl.trim(),
    retrievedAt: dateToIso(form.retrievedAt), whyIncluded: form.whyIncluded.trim(),
  };
}
function publicShape(entry: ManagedEntry): ReviewedDiscovery {
  const { status: _status, version: _version, canApprove: _canApprove, createdAt: _createdAt,
    updatedAt: _updatedAt, approvedAt: _approvedAt, withdrawnAt: _withdrawnAt, ...record } = entry;
  return record;
}

async function readJson(response: Response) {
  try { return await response.json(); } catch { return null; }
}

function EvidenceEditor({ field, form, setForm }: {
  field: typeof fields[number]; form: FormValue; setForm: (value: FormValue) => void;
}) {
  const value = form[field.valueKey] as string;
  const status = form[field.statusKey] as EvidenceStatus;
  const baseId = `reviewed-${field.key}`;
  return <fieldset className="review-manager-evidence">
    <legend>{field.label}</legend>
    <label htmlFor={`${baseId}-status`}>Evidence status</label>
    <select id={`${baseId}-status`} value={status} onChange={(event) => {
      const next = event.target.value as EvidenceStatus;
      setForm({ ...form, [field.statusKey]: next, [field.valueKey]: next === 'unknown' ? '' : value });
    }}>
      <option value="unknown">Unknown</option>
      <option value="estimated">Estimated</option>
      <option value="verified">Verified at source</option>
    </select>
    <label htmlFor={`${baseId}-value`}>{field.label} details</label>
    <input id={`${baseId}-value`} maxLength={180} value={value} disabled={status === 'unknown'}
      placeholder={status === 'unknown' ? 'Not confirmed' : `Enter ${field.label.toLowerCase()} details`}
      required={status !== 'unknown'}
      onChange={(event) => setForm({ ...form, [field.valueKey]: event.target.value })} />
    <small>{status === 'verified' ? 'Use only when checked directly at the cited source.' :
      status === 'estimated' ? 'Label an estimate clearly; do not present it as verified.' :
        'Unknown facts stay blank and are never treated as zero.'}</small>
  </fieldset>;
}

function EntryForm({ initial, saving, error, onCancel, onSubmit }: {
  initial: FormValue; saving: boolean; error: string; onCancel: () => void;
  onSubmit: (payload: ReturnType<typeof payloadFromForm>) => void;
}) {
  const [form, setForm] = useState(initial);
  const [validationError, setValidationError] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = payloadFromForm(form);
    const candidate = { id: 'form-validation-only', ...payload, approval: 'reviewed' as const };
    if (!parseReviewedDiscoveries([candidate])) {
      setValidationError('Check the source URL, retrieval time, dates, and evidence values. Unknown facts must remain blank.');
      return;
    }
    setValidationError('');
    onSubmit(payload);
  }
  return <form className="review-manager-form" onSubmit={submit}>
    <div className="review-manager-form-heading">
      <h4>Reviewed source entry</h4>
      <p>Only add details you checked at the cited public source. Saving creates a private draft, not a public listing.</p>
    </div>
    <div className="review-manager-fields">
      <label>Title<input required maxLength={180} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Venue or place<input required maxLength={140} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
      <label>Region or neighborhood<input required maxLength={120} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
      <label>Start time, if confirmed<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
    </div>
    <div className="review-manager-evidence-grid">{fields.map((field) =>
      <EvidenceEditor key={field.key} field={field} form={form} setForm={setForm} />)}</div>
    <div className="review-manager-fields review-manager-source-fields">
      <label>Publisher or source name<input required maxLength={120} value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></label>
      <label>Public HTTPS source URL<input type="url" required maxLength={2048} placeholder="https://…" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /></label>
      <label>When you checked this source<input type="datetime-local" required value={form.retrievedAt} onChange={(e) => setForm({ ...form, retrievedAt: e.target.value })} /></label>
      <label className="review-manager-why">Why this may help people<textarea required maxLength={400} rows={3} value={form.whyIncluded} onChange={(e) => setForm({ ...form, whyIncluded: e.target.value })} /></label>
    </div>
    {(validationError || error) && <p className="review-manager-error" role="alert">{validationError || error}</p>}
    <div className="review-manager-actions">
      <button className="review-manager-primary" type="submit" disabled={saving}><Check size={16} aria-hidden="true" />{saving ? 'Saving…' : 'Save private draft'}</button>
      <button className="review-manager-secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
    </div>
  </form>;
}

export default function ReviewedDiscoveriesManager({ open, onPublicChanged }: { open: boolean; onPublicChanged: () => void }) {
  const [access, setAccess] = useState<AccessState>('loading');
  const [csrf, setCsrf] = useState('');
  const [entries, setEntries] = useState<ManagedEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [formTarget, setFormTarget] = useState<ManagedEntry | 'new' | null>(null);
  const [notice, setNotice] = useState('');

  async function load() {
    setAccess('loading'); setError('');
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const auth = await readJson(response);
      if (!response.ok || !auth?.authenticated || typeof auth.csrfToken !== 'string') {
        setAccess('signed-out'); return;
      }
      setCsrf(auth.csrfToken);
      const reviewResponse = await fetch('/api/week-ahead/discoveries/review', { credentials: 'same-origin', cache: 'no-store' });
      const review = await readJson(reviewResponse);
      if (reviewResponse.status === 403) { setAccess('forbidden'); return; }
      if (!reviewResponse.ok || !Array.isArray(review?.entries)) throw new Error('Unable to load moderator entries.');
      const entriesWithoutControls = review.entries.map((entry: ManagedEntry) => publicShape(entry));
      if (!parseReviewedDiscoveries(entriesWithoutControls)) throw new Error('The saved moderator list could not be validated.');
      setEntries(review.entries);
      setTruncated(review.truncated === true);
      setAccess('ready');
    } catch {
      setAccess('unavailable');
      setError('Moderator entries could not be checked. Nothing from sample ideas was substituted.');
    }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function save(payload: ReturnType<typeof payloadFromForm>) {
    if (!csrf) { setError('Your moderator session expired. Check access and try again.'); return; }
    const editing = formTarget && formTarget !== 'new' ? formTarget : null;
    setBusyId(editing?.id || 'new'); setError(''); setNotice('');
    const body = editing ? { ...payload, version: editing.version } : payload;
    try {
      const response = await fetch(editing
        ? `/api/week-ahead/discoveries/review/${encodeURIComponent(editing.id)}`
        : '/api/week-ahead/discoveries/review', {
        method: editing ? 'PUT' : 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(response.status === 409
        ? 'This entry changed since you opened it. Refresh the list before editing again.'
        : 'This entry could not be saved. Check its source and evidence.');
      setFormTarget(null);
      setNotice(editing?.status === 'approved'
        ? 'Changes saved as a private draft. The public copy is hidden until another moderator approves it.'
        : 'Private draft saved. A different moderator must approve it before it appears to visitors.');
      await load();
      onPublicChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This entry could not be saved.'); }
    finally { setBusyId(''); }
  }

  async function transition(entry: ManagedEntry, action: 'approve' | 'withdraw') {
    if (!csrf) { setError('Your moderator session expired. Check access and try again.'); return; }
    if (action === 'withdraw' && !window.confirm('Withdraw this entry from public view? Its source and review history will stay private for moderators.')) return;
    setBusyId(entry.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/week-ahead/discoveries/review/${encodeURIComponent(entry.id)}/${action}`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ version: entry.version }),
      });
      if (!response.ok) {
        const result = await readJson(response);
        throw new Error(result?.error === 'independent_moderator_required'
          ? 'A different moderator must approve this draft.'
          : result?.error === 'discovery_changed_refresh_required'
            ? 'This entry changed in another session. Refresh the list before deciding.'
            : 'The review action could not be completed.');
      }
      setNotice(action === 'approve'
        ? 'Approved and visible in Reviewed public-source leads.'
        : 'Withdrawn from public view. The private review record was retained.');
      await load();
      onPublicChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The review action could not be completed.'); }
    finally { setBusyId(''); }
  }

  if (!open) return null;
  const loginUrl = `/login?returnTo=${encodeURIComponent('/gosie-week-ahead/outings')}`;
  return <section className="review-manager" aria-labelledby="review-manager-heading">
    <div className="review-manager-heading">
      <div><span className="section-kicker">Private moderator workspace</span><h3 id="review-manager-heading">Review source-backed leads</h3></div>
      <ShieldCheck size={20} aria-hidden="true" />
    </div>
    <p className="review-manager-disclosure">Drafts and withdrawn entries are private. Approval makes an entry public; edits to an approved entry hide it until a second moderator approves the update. Source evidence and retrieval time stay attached. No provider or scraper is called.</p>
    {notice && <p className="review-manager-notice" role="status">{notice}</p>}
    {access === 'loading' && <p role="status">Checking moderator access…</p>}
    {access === 'signed-out' && <div className="review-manager-access"><p>Sign in to check whether your account has moderator access. The private list was not loaded.</p><a href={loginUrl}>Sign in to Gosie</a></div>}
    {access === 'forbidden' && <p className="review-manager-access" role="status">This workspace is limited to authorized Gosie moderators. No private entries were returned.</p>}
    {access === 'unavailable' && <div className="review-manager-access" role="alert"><AlertTriangle size={17} />{error}<button type="button" onClick={() => void load()}><RotateCw size={15} /> Retry</button></div>}
    {access === 'ready' && <>
      <div className="review-manager-tools">
        <p role="status">{entries.length} private {entries.length === 1 ? 'entry' : 'entries'} · New records start as drafts and require approval by a different moderator.</p>
        <button type="button" className="review-manager-primary" onClick={() => setFormTarget('new')}><CirclePlus size={16} />Add source lead</button>
        <button type="button" className="review-manager-secondary" onClick={() => void load()}><RotateCw size={15} />Refresh list</button>
      </div>
      {truncated && <p className="review-manager-notice">Only the first 100 entries are shown. More records are available; refine the list before reviewing.</p>}
      {formTarget && <EntryForm key={formTarget === 'new' ? 'new' : `${formTarget.id}-${formTarget.version}`}
        initial={formTarget === 'new' ? emptyForm : formFromEntry(formTarget)}
        saving={busyId === (formTarget === 'new' ? 'new' : formTarget.id)} error={error}
        onCancel={() => { setFormTarget(null); setError(''); }} onSubmit={save} />}
      {entries.length === 0 && <p className="reviewed-discoveries-empty" role="status">No moderator drafts or past reviewed leads yet. Start only with a real public source you personally checked.</p>}
      <div className="review-manager-list">
        {entries.map((entry) => <article className="review-manager-entry" key={entry.id}>
          <div className="review-manager-entry-head"><div><span className={`review-manager-status is-${entry.status}`}>{entry.status}</span><h4>{entry.title}</h4></div><span>Version {entry.version}</span></div>
          <p><strong>{entry.venue}</strong> · {entry.region}</p>
          <p>{entry.publisher} · <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open cited source</a></p>
          <p>Checked {new Date(entry.retrievedAt).toLocaleString()} · Updated {new Date(entry.updatedAt).toLocaleString()}</p>
          <div className="review-manager-entry-actions">
            <button type="button" className="review-manager-secondary" disabled={!!busyId || entry.status === 'withdrawn'}
              onClick={() => { setError(''); setFormTarget(entry); }}>Edit as draft</button>
            {entry.status === 'draft' && <button type="button" className="review-manager-primary" disabled={!!busyId || !entry.canApprove}
              title={!entry.canApprove ? 'A different moderator must approve this draft.' : undefined}
              onClick={() => void transition(entry, 'approve')}><Check size={15} />Approve and publish</button>}
            {entry.status !== 'withdrawn' && <button type="button" className="review-manager-withdraw" disabled={!!busyId}
              onClick={() => void transition(entry, 'withdraw')}>Withdraw</button>}
            {!entry.canApprove && entry.status === 'draft' && <span className="review-manager-help">Needs a different moderator.</span>}
          </div>
        </article>)}
      </div>
    </>}
  </section>;
}
