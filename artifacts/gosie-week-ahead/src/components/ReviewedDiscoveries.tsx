import { useCallback, useEffect, useState } from 'react';
import { Info, RotateCw, ShieldCheck } from 'lucide-react';
import { parseReviewedDiscoveries, type EvidenceField, type ReviewedDiscovery } from '../lib/reviewed-discoveries';
import ReviewedDiscoveriesManager from './ReviewedDiscoveriesManager';

function Fact({ field }: { field: EvidenceField }) {
  const state = field.status === 'verified' ? 'Verified at source' :
    field.status === 'estimated' ? 'Estimate' : 'Unknown';
  return <li><strong>{field.label}:</strong> {field.value || 'Not confirmed'} <span>({state})</span></li>;
}

function DiscoveryCard({ entry }: { entry: ReviewedDiscovery }) {
  const ageHours = (Date.now() - Date.parse(entry.retrievedAt)) / 3600000;
  const freshness = ageHours > 24 * 7 ? 'Stale — recheck the source' :
    ageHours < 0 ? 'Review timestamp needs checking' : 'Recently checked';
  return <article className="reviewed-discovery-card">
    <p className="section-kicker">Reviewed public-source lead</p>
    <h4>{entry.title}</h4>
    <p><strong>{entry.venue}</strong> · {entry.region}</p>
    <p>When: {entry.startsAt ? new Date(entry.startsAt).toLocaleString() : 'Not confirmed'}</p>
    <ul className="reviewed-discovery-facts">
      {[entry.price, entry.travel, entry.accessibility, entry.availability].map((fact) => <Fact key={fact.label} field={fact} />)}
    </ul>
    <p className="reviewed-discovery-why">{entry.whyIncluded}</p>
    <p className="reviewed-discovery-freshness">{freshness} · Retrieved {new Date(entry.retrievedAt).toLocaleString()}</p>
    <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
      {entry.publisher} · Check the original source
    </a>
  </article>;
}

export default function ReviewedDiscoveries() {
  const [entries, setEntries] = useState<ReviewedDiscovery[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/week-ahead/discoveries', {
        credentials: 'same-origin', cache: 'no-store',
      });
      if (!response.ok) throw new Error('unavailable');
      const payload = await response.json();
      const checked = parseReviewedDiscoveries(payload?.entries);
      if (!checked) throw new Error('invalid');
      setEntries(checked);
      setTruncated(payload.truncated === true);
    } catch {
      setEntries(null);
      setError('Reviewed public-source leads could not be checked. No sample ideas were substituted.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="reviewed-discoveries" aria-labelledby="reviewed-discoveries-heading">
    <div className="reviewed-discoveries-heading">
      <div><span className="section-kicker">Separate from the sample ideas</span>
        <h3 id="reviewed-discoveries-heading">Reviewed public-source leads</h3></div>
      <ShieldCheck size={20} aria-hidden="true" />
    </div>
    <p className="reviewed-discoveries-disclosure"><Info size={16} aria-hidden="true" />
      <span>Live search is not connected. Only source-backed entries independently reviewed by Gosie moderators can appear here. Gosie does not scrape websites, use organizer-only records, or verify ticket availability. Public listings show their source and retrieval time; unknown facts stay unknown.</span>
    </p>
    {loading && <p role="status">Checking reviewed public sources…</p>}
    {!loading && error && <div className="reviewed-discoveries-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}><RotateCw size={15} aria-hidden="true" />Retry</button></div>}
    {!loading && !error && entries?.length
      ? <div className="reviewed-discovery-grid">{entries.map((entry) => <DiscoveryCard key={entry.id} entry={entry} />)}</div>
      : !loading && !error && <p className="reviewed-discoveries-empty" role="status">No reviewed source-backed discoveries have been approved yet. The fictional examples below remain separate.</p>}
    {truncated && !error && <p role="status">Only the first 100 reviewed leads are shown.</p>}
    <div className="reviewed-discoveries-moderator">
      <button type="button" aria-expanded={managerOpen} onClick={() => setManagerOpen((open) => !open)}>
        {managerOpen ? 'Close moderator tools' : 'Moderator tools'}
      </button>
      <ReviewedDiscoveriesManager open={managerOpen} onPublicChanged={() => void load()} />
    </div>
  </section>;
}
