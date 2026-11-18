import { Info, ShieldCheck } from 'lucide-react';
import { parseReviewedDiscoveries, type EvidenceField, type ReviewedDiscovery } from '../lib/reviewed-discoveries';

// Empty until Gosie owners configure entries that have been independently reviewed.
// Never fill this list from organizer credentials, scraping or fictional samples.
const configuredEntries: unknown = [];
const entries = parseReviewedDiscoveries(configuredEntries);

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
  if (entries === null) return <section className="reviewed-discoveries" aria-labelledby="reviewed-discoveries-heading">
    <h3 id="reviewed-discoveries-heading">Reviewed public-source leads</h3>
    <p role="alert">The saved discovery list could not be checked. No live search was attempted.</p>
  </section>;
  return <section className="reviewed-discoveries" aria-labelledby="reviewed-discoveries-heading">
    <div className="reviewed-discoveries-heading">
      <div><span className="section-kicker">Separate from the sample ideas</span>
        <h3 id="reviewed-discoveries-heading">Reviewed public-source leads</h3></div>
      <ShieldCheck size={20} aria-hidden="true" />
    </div>
    <p className="reviewed-discoveries-disclosure"><Info size={16} aria-hidden="true" />
      <span>Live public search is not connected. This page sends no location or dates to a provider. Only independently reviewed entries configured by Gosie can appear here. It does not use organizer-only records, scrape websites, or verify ticket availability.</span>
    </p>
    {entries.length
      ? <div className="reviewed-discovery-grid">{entries.map((entry) => <DiscoveryCard key={entry.id} entry={entry} />)}</div>
      : <p className="reviewed-discoveries-empty" role="status">No reviewed source-backed discoveries are configured for this preview yet. This section is empty until Gosie adds approved entries; the fictional examples below remain separate.</p>}
  </section>;
}
