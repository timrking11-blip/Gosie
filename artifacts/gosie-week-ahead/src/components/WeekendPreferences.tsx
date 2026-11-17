import { useEffect, useState, type FormEvent } from 'react';
import { Download, FileUp, Info, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  activityCategories,
  clearWeekendPreferences,
  defaultWeekendPreferences,
  experienceOptions,
  parseWeekendPreferencesImport,
  readWeekendPreferences,
  serializeWeekendPreferences,
  socialContexts,
  validateWeekendPreferences,
  writeWeekendPreferences,
  type WeekendPreferences as Preferences,
} from '../lib/weekend-discovery';

function readBrowserPreferences() {
  try {
    return readWeekendPreferences(window.localStorage);
  } catch {
    return { preferences: { ...defaultWeekendPreferences }, error: 'unavailable' as const };
  }
}

export default function WeekendPreferences({
  onPreferencesChange,
}: {
  onPreferencesChange: (preferences: Preferences) => void;
}) {
  const [stored, setStored] = useState(readBrowserPreferences);
  const [draft, setDraft] = useState<Preferences>(() => ({ ...stored.preferences }));
  const [interestDraft, setInterestDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    onPreferencesChange(stored.preferences);
  }, [onPreferencesChange, stored.preferences]);

  function updateDraft(update: (current: Preferences) => Preferences) {
    setDraft((current) => update(current));
  }

  function persist(next: Preferences, successMessage: string) {
    try {
      if (!writeWeekendPreferences(window.localStorage, next)) {
        setError('These choices are not valid yet. Check the interest and limit fields.');
        return;
      }
    } catch {
      setError('This browser could not save preferences. They remain only for this visit.');
      return;
    }
    setStored({ preferences: next, error: null });
    setDraft(next);
    onPreferencesChange(next);
    setError('');
    setNotice(successMessage);
  }

  function save() {
    const validated = validateWeekendPreferences(draft);
    if (!validated) {
      setError('Check the selected categories, interests, experience choices, and numeric limits.');
      return;
    }
    persist(validated, 'Preferences saved on this device.');
  }

  function clear() {
    try {
      if (!clearWeekendPreferences(window.localStorage)) throw new Error('storage unavailable');
    } catch {
      setError('The browser could not clear its saved preferences.');
      return;
    }
    const reset = { ...defaultWeekendPreferences };
    setStored({ preferences: reset, error: null });
    setDraft(reset);
    onPreferencesChange(reset);
    setError('');
    setNotice('Saved preferences cleared from this device.');
  }

  function addInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const interest = interestDraft.trim().replace(/\s+/g, ' ');
    if (!interest) return;
    if (draft.interests.some((item) => item.toLocaleLowerCase() === interest.toLocaleLowerCase())) {
      setError('That interest is already selected.');
      return;
    }
    if (draft.interests.length >= 20 || interest.length > 60) {
      setError('Use up to 20 interests, with no more than 60 characters each.');
      return;
    }
    setDraft((current) => ({ ...current, interests: [...current.interests, interest] }));
    setError('');
    setInterestDraft('');
  }

  async function importPreferences(file?: File) {
    if (!file) return;
    setError('');
    setNotice('');
    try {
      if (file.size > 32 * 1024) throw new Error('The preferences file is too large to be a valid Gosie export.');
      const imported = parseWeekendPreferencesImport(await file.text());
      persist(imported, 'Preferences imported and saved on this device.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The preferences file could not be imported.');
    } finally {
      setFileInputKey((current) => current + 1);
    }
  }

  function exportPreferences() {
    try {
      const contents = serializeWeekendPreferences(stored.preferences);
      const blobUrl = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = 'gosie-weekend-preferences.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setNotice('Preferences-only JSON export downloaded.');
      setError('');
    } catch {
      setError('Preferences could not be exported. Save valid choices and try again.');
    }
  }

  const toggleValue = <T extends string>(current: T[], value: T) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  const canExport = stored.error === null;

  return (
    <section className="surface-card preference-card" aria-labelledby="weekend-preferences-heading">
      <div className="preference-card-heading">
        <div>
          <span className="section-kicker">Your choices, on this device</span>
          <h3 id="weekend-preferences-heading">What sounds like you?</h3>
          <p>Choose a few interests and limits. Save when you’re ready; your choices only reorder the fictional examples below.</p>
        </div>
      </div>

      <div className="preference-privacy" role="note">
        <Info size={17} aria-hidden="true" />
        <span>
          Live search is not connected. These preferences stay in this browser and are not sent anywhere.
          No location or dates are requested. Costs, travel, and all four ideas remain illustrative.
        </span>
      </div>

      {stored.error === 'malformed' && (
        <p className="preference-message is-error" role="alert">
          Saved preferences could not be read. The stored value was left untouched; save new choices or clear it explicitly.
        </p>
      )}
      {stored.error === 'unavailable' && (
        <p className="preference-message is-error" role="alert">
          This browser could not read local storage. You can try the controls for this visit, but they may not persist.
        </p>
      )}
      {notice && <p className="preference-message" role="status">{notice}</p>}
      {error && <p className="preference-message is-error" role="alert">{error}</p>}

      <div className="preference-form">
        <fieldset className="preference-fieldset">
          <legend>Activity categories</legend>
          <p className="preference-help">Optional broad categories; leaving all unchecked keeps every sample eligible.</p>
          <div className="preference-options">
            {activityCategories.map((category) => (
              <label className="preference-option" key={category}>
                <input
                  type="checkbox"
                  checked={draft.categories.includes(category)}
                  onChange={() => updateDraft((current) => ({
                    ...current,
                    categories: toggleValue(current.categories, category),
                  }))}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="preference-fieldset">
          <legend>Specific interests</legend>
          <p className="preference-help">Add a few words. Matching uses only tags on these fictional samples.</p>
          <form className="interest-entry" onSubmit={addInterest}>
            <label className="visually-hidden" htmlFor="weekend-interest">Add a specific interest</label>
            <input
              id="weekend-interest"
              type="text"
              maxLength={60}
              value={interestDraft}
              onChange={(event) => setInterestDraft(event.target.value)}
              placeholder="For example, jazz"
            />
            <button className="preference-action preference-action-secondary" type="submit" disabled={!interestDraft.trim() || draft.interests.length >= 20}>
              <Plus size={16} aria-hidden="true" /> Add interest
            </button>
          </form>
          {draft.interests.length > 0 ? (
            <ul className="interest-list" aria-label="Selected interests">
              {draft.interests.map((interest) => (
                <li key={interest}>
                  <span>{interest}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${interest}`}
                    onClick={() => updateDraft((current) => ({
                      ...current,
                      interests: current.interests.filter((item) => item !== interest),
                    }))}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="preference-help">No specific interests selected.</p>}
        </fieldset>

        <fieldset className="preference-fieldset">
          <legend>Experience preferences</legend>
          <p className="preference-help">These are soft sample labels, not facts about real events.</p>
          <div className="preference-options">
            {experienceOptions.map((experience) => (
              <label className="preference-option" key={experience}>
                <input
                  type="checkbox"
                  checked={draft.experiences.includes(experience)}
                  onChange={() => updateDraft((current) => ({
                    ...current,
                    experiences: toggleValue(current.experiences, experience),
                  }))}
                />
                <span>{experience}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="preference-fieldset">
          <legend>Social context</legend>
          <p className="preference-help">Changes the fixed example score for each context.</p>
          <div className="preference-context-options" role="group" aria-label="Choose social context">
            {socialContexts.map((context) => (
              <button
                type="button"
                key={context}
                aria-pressed={draft.context === context}
                onClick={() => updateDraft((current) => ({ ...current, context }))}
              >
                {context}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="preference-fieldset">
          <legend>Optional hard limits</legend>
          <p className="preference-help">Only a limit you set excludes examples. The amounts below are fictional estimates.</p>
          <div className="preference-limits">
            <label>
              Maximum sample cost (USD)
              <input
                type="number"
                min="0"
                max="2000"
                step="1"
                inputMode="numeric"
                value={draft.maxBudgetUsd ?? ''}
                onChange={(event) => updateDraft((current) => ({
                  ...current,
                  maxBudgetUsd: event.target.value === '' ? undefined : Number(event.target.value),
                }))}
                placeholder="No limit"
              />
            </label>
            <label>
              Maximum sample travel (minutes)
              <input
                type="number"
                min="0"
                max="240"
                step="1"
                inputMode="numeric"
                value={draft.maxTravelMinutes ?? ''}
                onChange={(event) => updateDraft((current) => ({
                  ...current,
                  maxTravelMinutes: event.target.value === '' ? undefined : Number(event.target.value),
                }))}
                placeholder="No limit"
              />
            </label>
          </div>
        </fieldset>

        <div className="preference-actions">
          <button className="preference-action" type="button" onClick={save}>Save choices on this device</button>
          <button className="preference-action preference-action-secondary" type="button" onClick={clear}>
            <RotateCcw size={15} aria-hidden="true" /> Clear saved choices
          </button>
          <button className="preference-action preference-action-secondary" type="button" onClick={exportPreferences} disabled={!canExport}>
            <Download size={15} aria-hidden="true" /> Export preferences
          </button>
          <label className="preference-action preference-action-secondary preference-import">
            <FileUp size={15} aria-hidden="true" /> Import preferences
            <input
              key={fileInputKey}
              type="file"
              accept="application/json,.json"
              aria-label="Import preferences-only JSON"
              onChange={(event) => void importPreferences(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
