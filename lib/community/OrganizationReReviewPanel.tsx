import { useEffect, useState } from "react";
import { communityRequest, communityWrite } from "./api";
import type { OrganizationContentReview } from "./api";
import { REASON_MAX, reasonError } from "./moderation";

function ReviewDecision({ review, apiBase, onDone }: {
  review: OrganizationContentReview; apiBase: string; onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const record = review.content;
  const fieldId = `gc-org-review-${review.revocationId}-${record.id}`;
  async function decide(action: "retain" | "hide" | "dismiss") {
    if (busy || reasonError(reason) || !review.canReview) return;
    setBusy(true); setError("");
    try {
      await communityWrite(`/community/organization-reviews/${encodeURIComponent(review.revocationId)}/${review.contentType}/${encodeURIComponent(record.id)}`,
        { action, reason: reason.trim(), expectedStatus: record.status }, apiBase);
      onDone(action === "hide" ? "Contribution kept private after organization re-review. Nothing was published or deleted."
        : "Organization re-review recorded. The contribution's current visibility was not changed.");
    } catch (err) {
      setError(err instanceof Error && err.message === "review_changed_refresh_required"
        ? "This review changed. Refresh the re-review queue before deciding again."
        : err instanceof Error ? err.message : "The re-review decision could not be saved.");
      setBusy(false);
    }
  }
  return <article className="gc-card">
    <h4 className="gc-title">{review.contentType === "items" ? review.content.title : "Organization note"}</h4>
    <p className="gc-fine">{review.publicIdentity} · {review.organizationType} · access revoked {new Date(review.revokedAt).toLocaleString()}</p>
    <p><strong>Current state: {record.status}.</strong> {record.status === "pending" ? "Still private; retaining it does not approve it." : "Still approved; revocation alone did not remove it."}</p>
    <p>{review.contentType === "items" ? review.content.description : review.content.text}</p>
    {review.contentType === "comments" && (review.parent ? <div className="gc-why">
      <strong>On {review.parent.title}</strong>
      <p>{review.parent.description} · {review.parent.location}</p>
      <p>Parent event state: {review.parent.status}{review.parent.expired ? " · past event" : ""}.</p>
      {review.parent.startsAt && <p>{new Date(review.parent.startsAt).toLocaleString()}</p>}
      {review.parent.sourceUrl && <a className="gc-link" href={review.parent.sourceUrl} target="_blank" rel="noopener noreferrer">Check parent event source (opens in a new tab)</a>}
    </div> : <p className="gc-fine">Parent event details are unavailable. Confirm the context before retaining this note.</p>)}
    {review.contentType === "items" && <>
      <p>{review.content.location}</p>
      {review.content.startsAt && <p>{new Date(review.content.startsAt).toLocaleString()} – {review.content.endsAt && new Date(review.content.endsAt).toLocaleString()}</p>}
      {review.content.sourceUrl && <a className="gc-link" href={review.content.sourceUrl} target="_blank" rel="noopener noreferrer">Check the submitted source (opens in a new tab)</a>}
    </>}
    <p className="gc-fine">Historical attribution: {record.attribution} · {review.contentType === "comments" ? `parent event ${review.content.itemId}` : review.content.kind}</p>
    <p className="gc-fine">{review.basis === "legacy-attribution"
      ? "Uncertain legacy match: this account and attribution match the revoked organization, but the original grant was not recorded. Confirm the relationship; do not assume wrongdoing."
      : "Linked by the recorded organization permission used when submitted. This is not proof the content is inaccurate."}</p>
    {!review.canReview ? <p className="gc-fine">You cannot re-review your own contribution. Another moderator must decide.</p> :
      <div className="gc-decide">
        <label htmlFor={fieldId}>Private re-review reason (required)</label>
        <textarea id={fieldId} disabled={busy} maxLength={REASON_MAX} rows={3} value={reason}
          aria-describedby={`${fieldId}-help`} onChange={(event) => setReason(event.target.value)} />
        <p className="gc-fine" id={`${fieldId}-help`}>Use 10–1000 characters. Never public; do not include private personal details. Retain and dismiss reasons stay in the private moderator record. A keep-private reason is also shown to the contributor.</p>
        <div className="gc-decide-actions">
          <button type="button" className="gc-btn" disabled={busy || !!reasonError(reason)} onClick={() => decide("retain")}>Retain current state</button>
          <button type="button" className="gc-btn gc-btn-danger" disabled={busy || !!reasonError(reason)} onClick={() => decide("hide")}>Keep private / remove from feed</button>
          {review.basis === "legacy-attribution" && <button type="button" className="gc-btn gc-btn-ghost" disabled={busy || !!reasonError(reason)} onClick={() => decide("dismiss")}>Dismiss uncertain match</button>}
        </div>
        {error && <p className="gc-inline-error" role="alert">{error}</p>}
      </div>}
  </article>;
}

export function OrganizationReReviewPanel({ apiBase, onDone }: { apiBase: string; onDone: (message: string) => void }) {
  const [data, setData] = useState<{ reviews: OrganizationContentReview[]; truncated: boolean } | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    communityRequest<{ reviews: OrganizationContentReview[]; truncated: boolean }>("/community/organization-reviews", { signal: controller.signal }, apiBase)
      .then(setData).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Re-review queue unavailable."); });
    return () => controller.abort();
  }, [apiBase, version]);
  return <section className="gc-section gc-mod gc-org-rereview" aria-labelledby="gc-org-rereview-h">
    <h3 id="gc-org-rereview-h">Organization access re-review</h3>
    <p className="gc-private">Moderators only · historical contributions, not public accusations</p>
    <p className="gc-fine">Recommended people-first standard: revoked access is a reason to check a contribution, not proof of wrongdoing. Retain useful, credible local information regardless of organization type. Keep misleading, unsafe, outdated or advertising-only content private. Check practical details and sources. Do not repeat private operator reasons or sensitive details.</p>
    <p className="gc-fine">Revocation never publishes, deletes or changes existing visibility. Retain leaves approved content approved and pending content private; pending content still needs its separate approval. Keep private removes an approved contribution from the feed or rejects a pending one. Dismiss is only for uncertain legacy attribution matches. Every action needs a reason; none restores organization access.</p>
    <button type="button" className="gc-link" onClick={() => setVersion((value) => value + 1)}>Refresh re-review queue</button>
    {error ? <p role="alert" className="gc-inline-error">{error}</p> : !data ? <p role="status">Loading organization re-reviews…</p> : <>
      {data.truncated && <p role="status">Showing the oldest 100 unresolved matches. Resolve these and refresh to see the remaining matches.</p>}
      {data.reviews.length === 0 ? <p>No organization contributions need re-review.</p> :
        <div className="gc-grid">{data.reviews.map((review) =>
          <ReviewDecision key={`${review.revocationId}:${review.contentType}:${review.content.id}`} review={review} apiBase={apiBase} onDone={onDone} />)}</div>}
    </>}
  </section>;
}
