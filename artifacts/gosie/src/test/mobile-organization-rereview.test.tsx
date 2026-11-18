import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OrganizationContentReview } from "@workspace/community/api";
import CommunitiesScreen from "../../../gosie-mobile/app/(tabs)/communities";

const mocks = vi.hoisted(() => ({ refreshFeed: vi.fn() }));

vi.mock("../../../gosie-mobile/hooks/useCommunity", () => ({
  mobileApiBase: () => "/api",
  mobileCommunityRequest: async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`/api${path}`, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  },
  useCommunityItems: () => ({
    items: [], loading: false, error: "", refresh: mocks.refreshFeed,
  }),
}));

const itemReview: OrganizationContentReview = {
  revocationId: "revoke-recorded", revokedAt: "2026-11-18T12:00:00Z",
  publicIdentity: "Synthetic public library", organizationType: "nonprofit",
  basis: "recorded-grant", canReview: true, contentType: "items",
  content: {
    id: "item-recorded", kind: "event", title: "Synthetic book swap",
    description: "Practical details for a fictional community event.",
    location: "Fictional neighborhood hall", attribution: "Synthetic public library",
    sourceUrl: "https://example.invalid/source", startsAt: "2026-12-02T19:00:00Z",
    endsAt: "2026-12-02T20:00:00Z", status: "pending",
    createdAt: "2026-11-17T12:00:00Z", reviewedAt: null, expired: false, why: "", comments: [],
  },
};
const legacyComment: OrganizationContentReview = {
  revocationId: "revoke-legacy", revokedAt: "2026-11-18T12:00:00Z",
  publicIdentity: "Synthetic club", organizationType: "venue",
  basis: "legacy-attribution", canReview: true, contentType: "comments",
  content: {
    id: "note-legacy", itemId: "parent-event", text: "Synthetic note about step-free entry.",
    attribution: "Synthetic club", status: "approved", createdAt: "2026-11-17T12:00:00Z", reviewedAt: null,
  },
  parent: {
    ...itemReview.content, id: "parent-event", kind: "event", title: "Synthetic parent concert",
    status: "approved", expired: false, startsAt: "2026-12-03T19:00:00Z",
  },
};
const rejectedReview: OrganizationContentReview = {
  ...itemReview, revocationId: "revoke-rejected",
  content: { ...itemReview.content, id: "item-rejected", title: "Synthetic rejected listing", status: "rejected" },
};

let reviews: OrganizationContentReview[];
let writes: { path: string; options: RequestInit }[];
let writeStatus: number;
let roles: string[];

beforeEach(() => {
  reviews = [itemReview, legacyComment, rejectedReview];
  writes = [];
  writeStatus = 200;
  roles = ["moderator"];
  mocks.refreshFeed.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const path = String(input);
    if (options.method === "POST" && path.includes("/organization-reviews/")) {
      writes.push({ path, options });
      return { ok: writeStatus < 400, status: writeStatus, json: async () =>
        writeStatus === 409 ? { error: "review_changed_refresh_required" } : { status: "pending", action: "retain" } };
    }
    if (path.endsWith("/auth/session")) return { ok: true, status: 200, json: async () => ({ authenticated: true, csrfToken: "synthetic-csrf" }) };
    if (path.endsWith("/community/mine")) return { ok: true, status: 200, json: async () => ({ roles, items: [], comments: [] }) };
    if (path.endsWith("/community/moderation")) return { ok: true, status: 200, json: async () => ({ items: [], comments: [] }) };
    if (path.endsWith("/community/organization-reviews")) return { ok: true, status: 200, json: async () => ({ reviews, truncated: false }) };
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("native Communities organization re-review (React Native primitives simulated in jsdom)", () => {
  it("shows recorded and uncertain legacy matches with current state and parent event context", async () => {
    render(<CommunitiesScreen />);
    await screen.findByText("Organization access re-review");
    expect(await screen.findAllByText("Recorded permission match")).toHaveLength(2);
    expect(screen.getByText("Uncertain legacy match")).toBeInTheDocument();
    expect(screen.getByText(/Still private; retaining it does not approve it/)).toBeInTheDocument();
    expect(screen.getByText(/Already private; retaining it does not publish it/)).toBeInTheDocument();
    expect(screen.getByText("Parent event: Synthetic parent concert")).toBeInTheDocument();
    expect(screen.getByText(/Parent event state: approved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss uncertain match" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retain current state" })).toHaveLength(3);
    expect(screen.getByText(/Revoked access is a reason to check/)).toBeInTheDocument();
  });

  it("gates pending retain on a bounded reason and sends current status with CSRF", async () => {
    reviews = [itemReview];
    render(<CommunitiesScreen />);
    await screen.findByText("Organization access re-review");
    const reason = await screen.findByLabelText("Private re-review reason (required)");
    const retain = screen.getByRole("button", { name: "Retain current state" });
    expect(retain).toBeDisabled();
    fireEvent.change(reason, { target: { value: "Too short" } });
    expect(retain).toBeDisabled();
    fireEvent.change(reason, { target: { value: "Useful to people regardless of access." } });
    expect(retain).toBeEnabled();
    fireEvent.click(retain);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].path).toBe("/api/community/organization-reviews/revoke-recorded/items/item-recorded");
    expect(JSON.parse(writes[0].options.body as string)).toEqual({
      action: "retain", reason: "Useful to people regardless of access.", expectedStatus: "pending",
    });
    expect((writes[0].options.headers as Record<string, string>)["X-CSRF-Token"]).toBe("synthetic-csrf");
    expect(await screen.findByText(/current visibility was not changed/)).toBeInTheDocument();
  });

  it("sends dismiss only for an uncertain legacy match with its current status", async () => {
    reviews = [itemReview, legacyComment];
    render(<CommunitiesScreen />);
    const reasons = await screen.findAllByLabelText("Private re-review reason (required)");
    fireEvent.change(reasons[1], { target: { value: "This historical attribution is not supported." } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss uncertain match" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].path).toBe("/api/community/organization-reviews/revoke-legacy/comments/note-legacy");
    expect(JSON.parse(writes[0].options.body as string)).toEqual({
      action: "dismiss", reason: "This historical attribution is not supported.", expectedStatus: "approved",
    });
  });

  it("denies self-review, preserves a reason after stale state, and hides the panel from non-moderators", async () => {
    reviews = [{ ...itemReview, canReview: false }];
    render(<CommunitiesScreen />);
    await screen.findByText(/You cannot re-review your own contribution/);
    expect(screen.queryByLabelText("Private re-review reason (required)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep private / remove from feed" })).not.toBeInTheDocument();

    cleanup();
    reviews = [itemReview];
    writeStatus = 409;
    render(<CommunitiesScreen />);
    const reason = await screen.findByLabelText("Private re-review reason (required)");
    fireEvent.change(reason, { target: { value: "The source needs another independent check." } });
    fireEvent.click(screen.getByRole("button", { name: "Keep private / remove from feed" }));
    expect(await screen.findByText(/This review changed. Refresh the re-review queue/)).toBeInTheDocument();
    expect(reason).toHaveValue("The source needs another independent check.");

    cleanup();
    roles = ["contributor"];
    render(<CommunitiesScreen />);
    await screen.findByText(/Permissions: contributor/);
    expect(screen.queryByText("Organization access re-review")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic book swap")).not.toBeInTheDocument();
  });
});
