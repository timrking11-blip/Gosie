/** Shared browser/native contract. Only approved records appear in public feeds. */
export type CommunityRole = "contributor" | "restaurant-owner" | "venue" | "municipality" | "nonprofit" | "moderator";
export function hasOrganizationRole(roles: CommunityRole[]) {
  return roles.some((role) => ["restaurant-owner", "venue", "municipality", "nonprofit"].includes(role));
}
export type CommunityItem = {
  id: string;
  kind: "event" | "gem";
  title: string;
  description: string;
  location: string;
  attribution: string;
  sourceUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  expired: boolean;
  why: string;
  comments: CommunityComment[];
  /** Present only on private contributor / moderator responses. */
  decisionReason?: string | null;
  /** Present only in the moderator queue; enforced independently by the API. */
  canReview?: boolean;
};
export type CommunityComment = {
  id: string; itemId: string; text: string; attribution: string;
  status: "pending" | "approved" | "rejected"; createdAt: string; reviewedAt: string | null;
  decisionReason?: string | null; canReview?: boolean;
};
export type CommunityDraft = Pick<CommunityItem, "kind" | "title" | "description" | "location" | "attribution"> &
  { sourceUrl?: string; startsAt?: string | null; endsAt?: string | null };
export type CommunityMine = { roles: CommunityRole[]; isOperator?: boolean; items: CommunityItem[]; comments: CommunityComment[] };

export async function communityRequest<T>(path: string, options: RequestInit = {}, apiBase = "/api"): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let json;
  try { json = await response.json(); }
  catch { throw new Error("The Communities service did not return a usable response. Please retry later."); }
  if (!response.ok) throw new Error(json.error || `Request failed (${response.status})`);
  return json as T;
}
export async function communityWrite<T>(path: string, body: unknown, apiBase: string): Promise<T> {
  const session = await communityRequest<{ authenticated: boolean; csrfToken?: string }>("/auth/session", {}, apiBase);
  if (!session.authenticated || !session.csrfToken) throw new Error("Please sign in again to continue.");
  return communityRequest<T>(path, { method: "POST", body: JSON.stringify(body), headers: { "X-CSRF-Token": session.csrfToken } }, apiBase);
}
export function communityWeekWindow(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
export function communityEventsInWindow(items: CommunityItem[], start: Date, end: Date) {
  return items.filter((item) => item.kind === "event" && !item.expired &&
    item.status === "approved" && item.startsAt && item.endsAt &&
    new Date(item.startsAt) < end && new Date(item.endsAt) > start)
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}
