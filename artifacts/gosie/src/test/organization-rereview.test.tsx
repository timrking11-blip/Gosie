import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrganizationReReviewPanel } from "../../../../lib/community/OrganizationReReviewPanel";
import type { OrganizationContentReview } from "@workspace/community/api";

const fixture: OrganizationContentReview = {
  revocationId: "revoke-1", revokedAt: "2026-11-18T12:00:00Z", publicIdentity: "Synthetic Library",
  organizationType: "nonprofit", basis: "recorded-grant", canReview: true, contentType: "items",
  content: { id: "gem-1", kind: "gem", title: "Seed library", description: "Useful practical local details.",
    location: "Fictional hall", attribution: "Synthetic Library", sourceUrl: "https://example.invalid",
    startsAt: null, endsAt: null, status: "pending", createdAt: "2026-11-17T12:00:00Z",
    reviewedAt: null, expired: false, why: "", comments: [] },
};
let rows: OrganizationContentReview[], writes: unknown[], failure: boolean;
beforeEach(() => {
  rows = [fixture]; writes = []; failure = false;
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit = {}) => {
    if (options.method === "POST") {
      writes.push({ path, body: JSON.parse(options.body as string), headers: options.headers });
      return { ok: !failure, json: async () => failure ? { error: "review_changed_refresh_required" } : { status: "pending", action: "retain" } };
    }
    return { ok: true, json: async () => path.endsWith("/auth/session")
      ? { authenticated: true, csrfToken: "synthetic-csrf" } : { reviews: rows, truncated: false } };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("private revoked-organization content re-review", () => {
  it("explains that access loss does not imply wrongdoing or publish a pending contribution", async () => {
    const done = vi.fn();
    render(<OrganizationReReviewPanel apiBase="/api" onDone={done} />);
    await screen.findByText("Seed library");
    expect(screen.getByText(/not proof of wrongdoing/)).toBeInTheDocument();
    expect(screen.getByText(/Still private; retaining it does not approve it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retain current state" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Dismiss uncertain match" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Private re-review reason (required)"), { target: { value: "  Useful to people independently of permission.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Retain current state" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(writes).toEqual([{
      path: "/api/community/organization-reviews/revoke-1/items/gem-1",
      body: { action: "retain", expectedStatus: "pending", reason: "Useful to people independently of permission." },
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "synthetic-csrf" },
    }]);
  });
  it("lets moderators dismiss only explicitly uncertain legacy matches", async () => {
    rows = [{ ...fixture, basis: "legacy-attribution" }];
    render(<OrganizationReReviewPanel apiBase="/api" onDone={vi.fn()} />);
    await screen.findByText("Seed library");
    expect(screen.getByText(/Uncertain legacy match/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Private re-review reason (required)"), { target: { value: "The attribution refers to an unrelated individual." } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss uncertain match" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ body: { action: "dismiss", expectedStatus: "pending" } });
  });
  it("does not offer own-content decisions and retains a failed decision's reason", async () => {
    rows = [{ ...fixture, canReview: false }];
    const { unmount } = render(<OrganizationReReviewPanel apiBase="/api" onDone={vi.fn()} />);
    await screen.findByText(/You cannot re-review your own/);
    expect(screen.queryByLabelText("Private re-review reason (required)")).not.toBeInTheDocument();
    unmount(); rows = [fixture]; failure = true;
    render(<OrganizationReReviewPanel apiBase="/api" onDone={vi.fn()} />);
    const reason = await screen.findByLabelText("Private re-review reason (required)");
    fireEvent.change(reason, { target: { value: "Misleading opening details need a new source." } });
    fireEvent.click(screen.getByRole("button", { name: "Keep private / remove from feed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh the re-review queue");
    expect(reason).toHaveValue("Misleading opening details need a new source.");
  });
  it("shows the parent event's context and source when re-reviewing an organization note", async () => {
    rows = [{ ...fixture, contentType: "comments", parent: fixture.content,
      content: { id: "note-1", itemId: "gem-1", text: "A practical access update.", attribution: "Synthetic Library",
        status: "approved", createdAt: "2026-11-17T12:00:00Z", reviewedAt: "2026-11-17T13:00:00Z" } }];
    render(<OrganizationReReviewPanel apiBase="/api" onDone={vi.fn()} />);
    expect(await screen.findByText("On Seed library")).toBeInTheDocument();
    expect(screen.getByText("A practical access update.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Check parent event source/ })).toHaveAttribute("href", "https://example.invalid");
  });
});
