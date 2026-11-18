/** Shared moderation copy and validation for web and native Communities. */
export const REASON_MIN = 10;
export const REASON_MAX = 1000;

export const reviewChecklist = [
  "Practically useful locally: what it is, who it helps, where and when, access and cost if known.",
  "Informative for people, not advertising-only.",
  "Credible source, no misleading claims, and no invented verification.",
  "Respects privacy and treats venues, municipalities, nonprofits and contributors fairly.",
] as const;

export const reasonHelp = "Shared privately with the contributor and moderators. Never shown publicly. Use 10–1000 characters; explain the practical benefit or what needs to change. Do not include private personal details.";

export function reasonError(text: string): string {
  const n = text.trim().length;
  if (n < REASON_MIN) return `Write a reason of at least ${REASON_MIN} characters (${n} so far).`;
  if (n > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters or fewer (${n} now).`;
  return "";
}

/** Private decision text for the contributor's own records. Empty while pending. */
export function decisionNote(record: { status: "pending" | "approved" | "rejected"; decisionReason?: string | null }): string {
  if (record.status === "pending") return "";
  const reason = record.decisionReason?.trim();
  if (reason) return reason;
  return "No reason was recorded for this decision. It was reviewed before reasons were collected.";
}
