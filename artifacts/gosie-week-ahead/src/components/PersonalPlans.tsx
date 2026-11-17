import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';

export type PersonalPlan = {
  id: string;
  date: string;
  time: string;
  title: string;
  category: 'Work' | 'Wellbeing' | 'Home' | 'Social';
  note: string;
};

const STORAGE_KEY = 'gosie-week-ahead-personal-plans-v1';
const categories: PersonalPlan['category'][] = ['Work', 'Wellbeing', 'Home', 'Social'];
const emptyForm = (date: string) => ({ date, time: '', title: '', category: 'Wellbeing' as PersonalPlan['category'], note: '' });

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDateKey(date) === value;
}
function isPlan(value: unknown): value is PersonalPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<PersonalPlan>;
  return typeof plan.id === 'string' && plan.id.length > 0 &&
    isDate(plan.date) && typeof plan.time === 'string' &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plan.time) &&
    typeof plan.title === 'string' && plan.title.trim().length > 0 && plan.title.length <= 120 &&
    categories.includes(plan.category as PersonalPlan['category']) &&
    typeof plan.note === 'string' && plan.note.length <= 500;
}
function readPlans(): { plans: PersonalPlan[]; error: string } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { plans: [], error: '' };
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(isPlan)) {
      return { plans: [], error: 'Saved plans could not be read. Existing browser data was left untouched.' };
    }
    return { plans: value, error: '' };
  } catch {
    return { plans: [], error: 'This browser could not read saved plans. Check its local storage permissions and try again.' };
  }
}
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function personalWeekDates(anchor: string) {
  const selected = new Date(`${anchor}T12:00:00`);
  selected.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected);
    date.setDate(date.getDate() + index);
    return localDateKey(date);
  });
}
function readableDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T12:00:00`));
}
function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PersonalPlans() {
  const initialDate = localDateKey(new Date());
  const [saved, setSaved] = useState(readPlans);
  const [weekAnchor, setWeekAnchor] = useState(initialDate);
  const [editing, setEditing] = useState<PersonalPlan | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(initialDate));
  const [notice, setNotice] = useState('');
  const weekDates = useMemo(() => personalWeekDates(weekAnchor), [weekAnchor]);
  const visible = saved.plans.filter((plan) => weekDates.includes(plan.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title));

  function commit(next: PersonalPlan[]) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved({ plans: next, error: '' });
      return true;
    } catch {
      setNotice('The browser could not save this change. Your existing saved plans were kept; check local storage permissions and try again.');
      return false;
    }
  }
  function startNew() {
    setEditing(null);
    setForm(emptyForm(weekAnchor));
    setNotice('');
    setFormOpen(true);
  }
  function startEdit(plan: PersonalPlan) {
    setEditing(plan);
    setForm({ date: plan.date, time: plan.time, title: plan.title, category: plan.category, note: plan.note });
    setNotice('');
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    const plan: PersonalPlan = { ...form, id: editing?.id || newId(), title: form.title.trim(), note: form.note.trim() };
    if (!isPlan(plan)) {
      setNotice('Check the plan title, date, time, category and note.');
      return;
    }
    const next = editing ? saved.plans.map((current) => current.id === editing.id ? plan : current) : [...saved.plans, plan];
    if (commit(next)) {
      setWeekAnchor(plan.date);
      setNotice(editing ? 'Your plan was updated on this device.' : 'Your plan was saved on this device.');
      closeForm();
    }
  }
  function remove(plan: PersonalPlan) {
    if (!window.confirm(`Remove “${plan.title}” from this browser?`)) return;
    setNotice('');
    if (commit(saved.plans.filter((current) => current.id !== plan.id))) setNotice('Your plan was removed from this device.');
  }
  function moveWeek(amount: number) {
    const date = new Date(`${weekDates[0]}T12:00:00`);
    date.setDate(date.getDate() + amount * 7);
    setWeekAnchor(localDateKey(date));
  }

  return <section className="surface-card personal-plans" aria-labelledby="personal-plans-heading">
    <div className="personal-plans-heading">
      <div>
        <span className="section-kicker">Just for this browser</span>
        <h2 className="section-title" id="personal-plans-heading">Your own plans</h2>
        <p className="personal-plans-intro">Add and edit plans you want to remember. They stay in this browser on this device and are not sent to Gosie or connected to your calendar.</p>
      </div>
      <button type="button" className="personal-plan-primary" onClick={startNew} disabled={Boolean(saved.error)}>
        <Plus size={17} aria-hidden="true" /> Add a plan
      </button>
    </div>
    <div className="personal-plan-privacy" role="note">
      <CalendarDays size={17} aria-hidden="true" />
      <span>Local only, not encrypted by Gosie, and not shared across devices. Anyone with access to this browser profile may see these plans. Clearing this browser’s site data removes them.</span>
    </div>
    {saved.error && <div className="personal-plan-message is-error" role="alert">{saved.error}
      <button type="button" onClick={() => setSaved(readPlans())}>Try reading again</button>
    </div>}
    {notice && <div className={`personal-plan-message${notice.startsWith('The browser') || notice.startsWith('Check') ? ' is-error' : ''}`} role={notice.startsWith('The browser') || notice.startsWith('Check') ? 'alert' : 'status'}>{notice}
      <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button>
    </div>}
    <div className="personal-week-nav" aria-label="Choose your plan week">
      <button type="button" aria-label="Previous week" onClick={() => moveWeek(-1)}><ChevronLeft size={18} /></button>
      <span>{readableDate(weekDates[0], { month: 'long', day: 'numeric' })} – {readableDate(weekDates[6], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      <button type="button" aria-label="Next week" onClick={() => moveWeek(1)}><ChevronRight size={18} /></button>
      <label htmlFor="personal-week-date">Jump to a date</label>
      <input id="personal-week-date" aria-label="Jump to a date" type="date" value={weekAnchor} onChange={(event) => setWeekAnchor(event.target.value)} />
    </div>
    {formOpen && <form className="personal-plan-form" onSubmit={submit}>
      <div className="personal-plan-form-heading"><h3>{editing ? 'Edit your plan' : 'Add a plan'}</h3>
        <button type="button" aria-label="Close plan form" onClick={closeForm}><X size={18} /></button>
      </div>
      <label>Plan title<input autoFocus required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <div className="personal-plan-form-row">
        <label>Date<input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label>Time<input type="time" required value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
        <label>Kind<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as PersonalPlan['category'] })}>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select></label>
      </div>
      <label>Note (optional)<textarea maxLength={500} rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
      <div className="personal-plan-form-actions">
        <button type="button" className="personal-plan-secondary" onClick={closeForm}>Cancel</button>
        <button type="submit" className="personal-plan-primary">{editing ? 'Save changes' : 'Save on this device'}</button>
      </div>
    </form>}
    {saved.error ? <p className="personal-plan-empty">Plans are unavailable until this browser can read its saved data.</p> :
      visible.length === 0 ? <p className="personal-plan-empty">No personal plans in this week yet. Add one whenever you’re ready.</p> :
        <ul className="personal-plan-list">
          {visible.map((plan) => <li className="personal-plan-row" key={plan.id}>
            <div className="personal-plan-date"><strong>{readableDate(plan.date, { weekday: 'short' })}</strong><span>{readableDate(plan.date, { month: 'short', day: 'numeric' })} · {plan.time}</span></div>
            <div className="personal-plan-copy"><h3>{plan.title}</h3><span>{plan.category}</span>{plan.note && <p>{plan.note}</p>}</div>
            <div className="personal-plan-row-actions">
              <button type="button" aria-label={`Edit ${plan.title}`} onClick={() => startEdit(plan)}><Pencil size={17} /><span>Edit</span></button>
              <button type="button" aria-label={`Remove ${plan.title}`} onClick={() => remove(plan)}><Trash2 size={17} /><span>Remove</span></button>
            </div>
          </li>)}
        </ul>}
  </section>;
}
