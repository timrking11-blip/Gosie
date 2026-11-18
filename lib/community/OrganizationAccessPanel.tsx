import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { communityRequest, communityWrite } from "./api";

const endpoint = "/community/organization-access";
const types = ["venue", "municipality", "nonprofit", "restaurant-owner"] as const;
type OrganizationType = typeof types[number];
type Grant = { userId: string; organizationType: OrganizationType; publicIdentity: string; accessVersion: string; legacy: boolean };
type Review = { id: string; userId: string | null; reviewedBy: string | null; organizationType: OrganizationType; publicIdentity: string; action: string; reason: string; createdAt: string };
type Access = { grants: Grant[]; reviews: Review[]; truncated: boolean };
const accessErrors: Record<string, string> = {
  access_changed_refresh_required: "This access changed since you opened it. Refresh the records and review the current permission before trying again.",
  existing_account_required: "No existing account matches that ID. Check the account ID before reviewing access.",
  revoke_existing_organization_first: "This account already represents an organization. Review its current access before granting another permission.",
  cannot_manage_own_organization_access: "Another operator must review changes to your own organization access.",
  operator_permission_required: "You no longer have operator permission. No access decision was saved.",
  invalid_access_review: "Check the account, organization name and review reason. Reasons need 10–1000 characters.",
};
const message = (error: unknown) => error instanceof Error
  ? accessErrors[error.message] || error.message
  : "The access decision could not be saved.";

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
  const heading = useRef<HTMLHeadingElement>(null);
  const errorNotice = useRef<HTMLParagraphElement>(null);
  const revokeInput = useRef<HTMLTextAreaElement>(null);
  const revokeTrigger = useRef<HTMLButtonElement | null>(null);
  const focusAfterRefresh = useRef(false);
  useEffect(() => { if (error) errorNotice.current?.focus(); }, [error]);
  useEffect(() => { if (revoking) revokeInput.current?.focus(); }, [revoking]);
  useEffect(() => {
    if (data && focusAfterRefresh.current) {
      focusAfterRefresh.current = false;
      heading.current?.focus();
    }
  }, [data]);
  function cancelRevocation() {
    setRevoking(null); setRevokeReason(""); setError("");
    revokeTrigger.current?.focus();
  }
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
    if (busy || !confirmed || !userId.trim() || !publicIdentity.trim() || reason.trim().length < 10) return;
    setBusy(true); setError("");
    try {
      await communityWrite(endpoint, { userId: userId.trim(), organizationType, publicIdentity: publicIdentity.trim(), reason: reason.trim() }, apiBase);
      onDone("Reviewed organization access granted. Every contribution still needs moderation.");
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (busy || !revoking || revokeReason.trim().length < 10) return;
    setBusy(true); setError("");
    try {
      await communityWrite(`${endpoint}/revoke`, { userId: revoking.userId, organizationType: revoking.organizationType, accessVersion: revoking.accessVersion, reason: revokeReason.trim() }, apiBase);
      onDone("Organization access revoked. Existing contributions and their moderation status were retained. Moderators can re-review linked contributions.");
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <section className="gc-section gc-mod gc-access" aria-labelledby="gc-access-h">
    <h3 id="gc-access-h" ref={heading} tabIndex={-1}>Reviewed organization access</h3>
    <p className="gc-private">Operators only · private account identifiers and review reasons</p>
    <p className="gc-fine">For people, not promotion. Review the existing account's authority to represent the organization before granting access. This does not verify identity automatically, invite anyone, grant moderation, or allow self-publication. You cannot manage your own access.</p>
    {error && <p ref={errorNotice} tabIndex={-1} role="alert" className="gc-inline-error">{error} <button type="button" className="gc-link" disabled={busy} onClick={() => {
      focusAfterRefresh.current = true;
      setConfirmed(false); setRevoking(null); setRevokeReason(""); setRetry((value) => value + 1);
    }}>Refresh access records</button></p>}
    {!data ? !error && <p role="status">Loading organization access…</p> : <>
      <form className="gc-form" onSubmit={grant}>
        <label>Existing account ID<input required disabled={busy} maxLength={200} value={userId} onChange={(e) => { setUserId(e.target.value); setConfirmed(false); }} /></label>
        <label>Organization type<select disabled={busy} value={organizationType} onChange={(e) => { setType(e.target.value as OrganizationType); setConfirmed(false); }}>{types.map((type) => <option key={type} value={type}>{type === "restaurant-owner" ? "Restaurant" : type === "nonprofit" ? "Nonprofit" : type === "municipality" ? "Municipality" : "Venue"}</option>)}</select></label>
        <label>Approved public organization name<input required disabled={busy} maxLength={80} value={publicIdentity} onChange={(e) => { setIdentity(e.target.value); setConfirmed(false); }} /></label>
        <label>Private access review reason<textarea required disabled={busy} minLength={10} maxLength={1000} value={reason} onChange={(e) => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p className="gc-fine">The approved name becomes attribution on future organization submissions and notes. Record why representation was approved; do not enter passwords, private documents or sensitive personal details.</p>
        <label><input type="checkbox" disabled={busy} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I reviewed this account, organization type and public name.</label>
        <button className="gc-btn" disabled={busy || !confirmed || !userId.trim() || !publicIdentity.trim() || reason.trim().length < 10}>Grant reviewed organization access</button>
      </form>
      <h4>Current organization access</h4>
      {data.truncated && <p role="status">Only the first 500 grants are shown. Use controlled administration to inspect the remainder.</p>}
      {!data.grants.length && <p>No organization access has been granted.</p>}
      <ul className="gc-mine-comments">{data.grants.map((item) => <li className="gc-mine-comment" key={`${item.userId}:${item.organizationType}`}>
        <div><strong>{item.publicIdentity}</strong><p>{item.organizationType} · account {item.userId}</p>{item.legacy && <p>Legacy database grant — no reviewed grant decision recorded here.</p>}</div>
        <button type="button" className="gc-btn gc-btn-danger" disabled={busy} onClick={(event) => { revokeTrigger.current = event.currentTarget; setRevoking(item); setRevokeReason(""); setError(""); }}>Review revocation of {item.publicIdentity}</button>
      </li>)}</ul>
      {revoking && <form className="gc-form" aria-labelledby="gc-revoke-h" onSubmit={revoke} onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) { event.preventDefault(); cancelRevocation(); }
      }}>
        <h4 id="gc-revoke-h">Revoke {revoking.publicIdentity} ({revoking.organizationType})?</h4>
        <p>Account {revoking.userId} will lose this organization permission on subsequent requests. Existing content stays in its current review state. A separate contributor or moderator permission, if any, is unchanged. This cannot be undone automatically; restoring access needs a new reviewed grant.</p>
        <label>Private revocation reason<textarea ref={revokeInput} required disabled={busy} minLength={10} maxLength={1000} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} /></label>
        <div className="gc-actions"><button type="button" className="gc-btn gc-btn-ghost" disabled={busy} onClick={cancelRevocation}>Cancel revocation</button><button className="gc-btn gc-btn-danger" disabled={busy || revokeReason.trim().length < 10}>Confirm revocation</button></div>
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
