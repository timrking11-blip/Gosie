import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Discovery = {
  id: string; title: string; venue: string; region: string; category: string;
  why: string; status: string; firstSeenAt: string; lastCheckedAt: string;
  verification: string; sourceType: "reviewed-public-research";
  flags: string[];
  dates: { publication: string | null; announcedOpening: string | null; confirmedOpening: string | null; exhibitStart: string | null; exhibitEnd: string | null };
  sources: { url: string; publisher: string; excerpt: string; publicationDate: string | null; checkedAt: string }[];
  price: null; travelMinutes: null; accessibility: null; hours: null; availability: null;
  constraintStatus: "not-evaluated";
};
type Catalog = { schemaVersion: number; revision: string | null; checkedAt: string; warning: string | null; records: Discovery[] };
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_RECORDS = 500;
const MAX_SOURCES_PER_RECORD = 12;
const dateFields = ["publication", "announcedOpening", "confirmedOpening", "exhibitStart", "exhibitEnd"] as const;
const allowedFlags = ["stale", "expired", "closed", "delayed", "conflicting", "date-review"];
const allowedStatuses = ["unknown", "announced", "open", "scheduled", "ongoing", "delayed", "closed", "conflicting"];
const day = (value: string) => value.slice(0, 10);
function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function nullableDate(value: unknown): value is string | null {
  return value === null || validDate(value);
}
function validDates(value: unknown): value is Discovery["dates"] {
  if (!objectValue(value) ||
      !dateFields.every((field) => Object.hasOwn(value, field) && nullableDate(value[field])) ||
      !Object.keys(value).every((field) => dateFields.includes(field as typeof dateFields[number]))) return false;
  return !(typeof value.exhibitStart === "string" && typeof value.exhibitEnd === "string" &&
    value.exhibitStart > value.exhibitEnd);
}
function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const forbiddenHost = host === "localhost" || /(^|\.)(local|internal|test|invalid|example|onion)$/.test(host) ||
      ["example.com", "example.org", "example.net"].includes(host) ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":");
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      host.includes(".") && !forbiddenHost ? url.href : null;
  } catch { return null; }
}
function validSource(value: unknown): value is Discovery["sources"][number] {
  if (!objectValue(value) || !boundedText(value.url, 2048) || !sourceUrl(value.url) ||
      !boundedText(value.publisher, 120) || !boundedText(value.excerpt, 280) ||
      !validTimestamp(value.checkedAt) || !(value.publicationDate === null || validDate(value.publicationDate))) return false;
  return Object.keys(value).every((key) => ["url", "publisher", "excerpt", "publicationDate", "checkedAt"].includes(key));
}
function validDiscovery(value: unknown): value is Discovery {
  if (!objectValue(value) || !/^experience-[a-f0-9]{24}$/.test(String(value.id || "")) ||
      !boundedText(value.title, 200) || !boundedText(value.venue, 200) || !boundedText(value.region, 120) ||
      !["restaurant", "exhibit", "experience"].includes(String(value.category)) ||
      !boundedText(value.why, 600) || !allowedStatuses.includes(String(value.status)) ||
      !["unverified", "source-supported"].includes(String(value.verification)) ||
      value.sourceType !== "reviewed-public-research" ||
      !validTimestamp(value.firstSeenAt) || !validTimestamp(value.lastCheckedAt) ||
      Date.parse(value.firstSeenAt as string) > Date.parse(value.lastCheckedAt as string) ||
      !validDates(value.dates) ||
      !Array.isArray(value.flags) || value.flags.length > 12 ||
      !value.flags.every((flag) => typeof flag === "string" && allowedFlags.includes(flag)) ||
      new Set(value.flags).size !== value.flags.length ||
      !Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > MAX_SOURCES_PER_RECORD ||
      !value.sources.every(validSource) ||
      value.price !== null || value.travelMinutes !== null || value.accessibility !== null ||
      value.hours !== null || value.availability !== null || value.constraintStatus !== "not-evaluated") return false;
  const allowed = ["id", "title", "venue", "region", "category", "why", "status", "verification", "sourceType",
    "firstSeenAt", "lastCheckedAt", "dates", "flags", "sources", "price", "travelMinutes", "accessibility",
    "hours", "availability", "constraintStatus"];
  return Object.keys(value).every((key) => allowed.includes(key));
}
function validCatalog(value: unknown): value is Catalog {
  if (!objectValue(value) || value.schemaVersion !== 1 ||
      !(value.revision === null || boundedText(value.revision, 120)) ||
      !validTimestamp(value.checkedAt) ||
      !(value.warning === null || boundedText(value.warning, 500)) ||
      !Array.isArray(value.records) || value.records.length > MAX_RECORDS ||
      !value.records.every(validDiscovery) ||
      new Set(value.records.map((record) => (record as Record<string, unknown>).id)).size !== value.records.length) return false;
  return Object.keys(value).every((key) => ["schemaVersion", "revision", "checkedAt", "warning", "records"].includes(key));
}
async function readCatalogResponse(response: Response): Promise<Catalog> {
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_CATALOG_BYTES) throw new Error("catalog_response_too_large");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("catalog_response_invalid"); }
  if (!validCatalog(value)) throw new Error("catalog_response_invalid");
  return value;
}

export default function ResearchedDiscoveries() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryAnnouncement, setRetryAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryingRef = useRef(false);
  useLayoutEffect(() => {
    if (!retryAnnouncement || !retryingRef.current) return;
    headingRef.current?.focus();
    retryingRef.current = false;
  }, [retryAnnouncement]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/discoveries", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog_unavailable");
        const result = await readCatalogResponse(response);
        setCatalog(result);
        if (retryingRef.current) {
          const count = result.records.length;
          setRetryAnnouncement(count === 0
            ? "No approved discoveries are currently available."
            : `Loaded ${count} approved ${count === 1 ? "discovery" : "discoveries"}.`);
          setError("");
          setRetryBusy(false);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          retryingRef.current = false;
          setRetryBusy(false);
          setError("Reviewed discoveries are unavailable or could not be validated. No replacement content was added; the Weekend Ahead sample ideas remain separate.");
        }
      });
    return () => controller.abort();
  }, [attempt]);

  return <section className="research-discoveries reviewed-discoveries" aria-labelledby="research-discoveries-heading">
    <h2 id="research-discoveries-heading" ref={headingRef} tabIndex={-1}>From public sources, reviewed by Gosie</h2>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{retryAnnouncement}</p>
    <p>Separate from the fictional ranked ideas below. These are reviewed public-source leads, not personalized recommendations.
      Price, travel, accessibility, hours and availability are unknown unless you confirm them with the source.
      Your profile limits have not been evaluated for these discoveries.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="secondary-button" aria-disabled={retryBusy} onClick={() => {
      if (retryBusy) return;
      retryingRef.current = true;
      setRetryAnnouncement("");
      setRetryBusy(true);
      setAttempt((value) => value + 1);
    }}>{retryBusy ? "Retrying discoveries…" : "Retry discoveries"}</button></div> :
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
