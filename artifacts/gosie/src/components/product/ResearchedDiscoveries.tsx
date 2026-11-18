import { useEffect, useState } from "react";

type Discovery = {
  id: string; title: string; venue: string; region: string; category: string;
  why: string; status: string; firstSeenAt: string; lastCheckedAt: string;
  flags: string[];
  dates: { publication: string | null; announcedOpening: string | null; confirmedOpening: string | null; exhibitStart: string | null; exhibitEnd: string | null };
  sources: { url: string; publisher: string; excerpt: string; publicationDate: string | null; checkedAt: string }[];
};
type Catalog = { schemaVersion: number; revision: string | null; warning: string | null; records: Discovery[] };
const day = (value: string) => value.slice(0, 10);
function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export default function ResearchedDiscoveries() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/discoveries", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Approved discoveries could not be loaded.");
        const result = await response.json() as Catalog;
        if (result.schemaVersion !== 1 || !Array.isArray(result.records)) throw new Error("The discovery catalog is unavailable.");
        setCatalog(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Discoveries could not be loaded.");
      });
    return () => controller.abort();
  }, [attempt]);

  return <section className="research-discoveries" aria-labelledby="research-discoveries-heading">
    <h2 id="research-discoveries-heading">From public sources, reviewed by Gosie</h2>
    <p>Separate from the fictional ranked ideas below. These are reviewed public-source leads, not personalized recommendations.
      Price, travel, accessibility, hours and availability are unknown unless you confirm them with the source.
      Your profile limits have not been evaluated for these discoveries.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>Retry discoveries</button></div> :
      !catalog ? <p role="status">Loading reviewed discoveries…</p> :
        <>
          {catalog.warning && <p role="status">{catalog.warning}</p>}
          {catalog.records.length === 0 ? <p>No current discoveries have been approved for the persistent catalog. On-demand public search is separate; its results are never added here.</p> :
            <div className="research-cards">{catalog.records.map((record) => <article key={record.id} className="research-discovery">
              <p className="product-eyebrow">{record.category} · Reviewed public research</p>
              <h3>{record.title}</h3>
              <p><strong>{record.venue}</strong> · {record.region}</p>
              <p>Status reported by source: <strong>{record.status}</strong>{record.flags.includes("stale") && " · Stale — recheck with the source"}</p>
              <p>{record.why}</p>
              {record.dates.announcedOpening && <p>Announced opening: {record.dates.announcedOpening} — not confirmation it opened.</p>}
              {record.dates.confirmedOpening && <p>Source-supported opening date: {record.dates.confirmedOpening}</p>}
              {(record.dates.exhibitStart || record.dates.exhibitEnd) && <p>Exhibit run: {record.dates.exhibitStart || "start unknown"} to {record.dates.exhibitEnd || "end unknown"}</p>}
              {!record.dates.exhibitStart && !record.dates.exhibitEnd && <p>Ongoing or untimed discovery; no event time assigned.</p>}
              <p>First seen by Gosie: {day(record.firstSeenAt)} (not an opening date). Last checked: {day(record.lastCheckedAt)}.</p>
              <details><summary>Sources and evidence</summary>
                <ul>{record.sources.map((source, index) => <li key={`${source.url}-${index}`}>
                  {sourceUrl(source.url) ? <a href={sourceUrl(source.url)!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{source.publisher} — original source</a> : <span>Source link unavailable</span>}
                  <p>{source.excerpt}</p>
                  <p>Article publication: {source.publicationDate || "unknown"}. Checked {day(source.checkedAt)}.</p>
                </li>)}</ul>
              </details>
              <p className="form-help">Cost and travel unknown · Limits not evaluated · Check details before going.</p>
            </article>)}</div>}
        </>}
  </section>;
}
