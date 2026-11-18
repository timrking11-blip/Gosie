import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { communityRequest, communityWrite } from "./api";

const endpoint = "/community/organization-access";
const types = ["venue", "municipality", "nonprofit", "restaurant-owner"] as const;
type OrganizationType = typeof types[number];
type Grant = { userId: string; organizationType: OrganizationType; publicIdentity: string; accessVersion: string; legacy: boolean };
type Review = { id: string; userId: string | null; reviewedBy: string | null; organizationType: OrganizationType; publicIdentity: string; action: string; reason: string; createdAt: string };
type Access = { grants: Grant[]; reviews: Review[]; truncated: boolean };
const message = (error: unknown) => error instanceof Error ? error.message : "The access decision could not be saved.";

export function OrganizationAccessPanel({ apiBase, onDone }: { apiBase: string; onDone: (message: string) => void }) {
  const [data, setData] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [userId, setUserId] = useState("");
  const [organizationType, setType] = useState<OrganizationType>("venue");
  const [publicIdentity, setIdentity] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    communityRequest<Access>(endpoint, { signal: controller.signal }, apiBase).then(setData).catch((err) => {
      if (!controller.signal.aborted) setError(message(err));
    });
    return () => controller.abort();
  }, [apiBase, retry]);
  async function grant(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    setBusy(true); setError("");
    try {
      await communityWrite(endpoint, { userId: userId.trim(), organizationType, publicIdentity: publicIdentity.trim(), reason: reason.trim() }, apiBase);
      onDone("Reviewed organization access granted. Every contribution still needs moderation.");
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (!revoking) return;
    setBusy(true); setError("");
    try {
      await communityWrite(`${endpoint}/revoke`, { userId: revoking.userId, organizationType: revoking.organizationType, accessVersion: revoking.accessVersion, reason: revokeReason.trim() }, apiBase);
      onDone("Organization access revoked. Existing contributions and their moderation status were retained.");
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <section className="gc-section gc-mod gc-access" aria-labelledby="gc-access-h">
    <h3 id="gc-access-h">Reviewed organization access</h3>
    <p className="gc-private">Operators only · private account identifiers and review reasons</p>
    <p className="gc-fine">For people, not promotion. Review the existing account's authority to represent the organization before granting access. This does not verify identity automatically, invite anyone, grant moderation, or allow self-publication. You cannot manage your own access.</p>
    {error && <p role="alert" className="gc-inline-error">{error} <button type="button" className="gc-link" disabled={busy} onClick={() => setRetry((value) => value + 1)}>Refresh access records</button></p>}
    {!data ? !error && <p role="status">Loading organization access…</p> : <>
      <form className="gc-form" onSubmit={grant}>
        <label>Existing account ID<input required maxLength={200} value={userId} onChange={(e) => { setUserId(e.target.value); setConfirmed(false); }} /></label>
        <label>Organization type<select value={organizationType} onChange={(e) => { setType(e.target.value as OrganizationType); setConfirmed(false); }}>{types.map((type) => <option key={type} value={type}>{type === "restaurant-owner" ? "Restaurant" : type === "nonprofit" ? "Nonprofit" : type === "municipality" ? "Municipality" : "Venue"}</option>)}</select></label>
        <label>Approved public organization name<input required maxLength={80} value={publicIdentity} onChange={(e) => { setIdentity(e.target.value); setConfirmed(false); }} /></label>
        <label>Private access review reason<textarea required minLength={10} maxLength={1000} value={reason} onChange={(e) => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="gc-fine">The approved name becomes attribution on future organization submissions and notes. Record why representation was approved; do not enter passwords, private documents or sensitive personal details.</p>
        <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I reviewed this account, organization type and public name.</label>
        <button className="gc-btn" disabled={busy || !confirmed || reason.trim().length < 10}>Grant reviewed organization access</button>
      </form>
      <h4>Current organization access</h4>
      {data.truncated && <p role="status">Only the first 500 grants are shown. Use controlled administration to inspect the remainder.</p>}
      {!data.grants.length && <p>No organization access has been granted.</p>}
      <ul className="gc-mine-comments">{data.grants.map((item) => <li className="gc-mine-comment" key={`${item.userId}:${item.organizationType}`}>
        <div><strong>{item.publicIdentity}</strong><p>{item.organizationType} · account {item.userId}</p>{item.legacy && <p>Legacy database grant — no reviewed grant decision recorded here.</p>}</div>
        <button type="button" className="gc-btn gc-btn-danger" disabled={busy} onClick={() => { setRevoking(item); setRevokeReason(""); }}>Review revocation of {item.publicIdentity}</button>
      </li>)}</ul>
      {revoking && <form className="gc-form" onSubmit={revoke}>
        <h4>Revoke {revoking.publicIdentity} ({revoking.organizationType})?</h4>
        <p>Account {revoking.userId} will lose this organization permission on subsequent requests. Existing content stays in its current review state. A separate contributor or moderator permission, if any, is unchanged. This cannot be undone automatically; restoring access needs a new reviewed grant.</p>
        <label>Private revocation reason<textarea required minLength={10} maxLength={1000} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} /></label>
        <div className="gc-actions"><button type="button" className="gc-btn gc-btn-ghost" disabled={busy} onClick={() => setRevoking(null)}>Cancel revocation</button><button className="gc-btn gc-btn-danger" disabled={busy || revokeReason.trim().length < 10}>Confirm revocation</button></div>
      </form>}
      <h4>Recent access decisions</h4>
      <p className="gc-fine">Latest 100 decisions. Organization access review is separate from content moderation.</p>
      {!data.reviews.length && <p>No access decisions recorded yet.</p>}
      <ul className="gc-mine-comments">{data.reviews.map((review) => <li className="gc-mine-comment" key={review.id}>
        <strong>{review.action === "grant" ? "Granted" : "Revoked"}: {review.publicIdentity} · {review.organizationType}</strong>
        <p>Account {review.userId || "(deleted)"} · operator {review.reviewedBy || "(deleted)"} · {new Date(review.createdAt).toLocaleString()}</p>
        <p>{review.reason}</p>
      </li>)}</ul>
    </>}
  </section>;
}
