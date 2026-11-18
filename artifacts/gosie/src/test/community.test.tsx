import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommunityPanel, CommunityDiscoveries } from "@workspace/community/panel";
import { communityEventsInWindow, communityRequest, type CommunityItem } from "@workspace/community/api";

const item = (overrides: Partial<CommunityItem> = {}): CommunityItem => ({
  id: "event-1", kind: "event", title: "Community Thursday workshop", description: "A contributor suggestion.",
  location: "Neighborhood hall", attribution: "Local reader", sourceUrl: "https://example.invalid",
  startsAt: "2026-11-19T19:00:00Z", endsAt: "2026-11-20T01:00:00Z",
  status: "approved", createdAt: "2026-11-17T12:00:00Z", reviewedAt: "2026-11-17T13:00:00Z",
  expired: false, why: "Contributor dates; confirm with the source.", comments: [], ...overrides,
});
const gem = item({ id: "gem-1", kind: "gem", title: "Evergreen garden", startsAt: null, endsAt: null, why: "Untimed community discovery." });
let roles: string[];
let approved: CommunityItem[];
let own: CommunityItem[];
let queue: CommunityItem[];
let signedIn: boolean;
let writes: { path: string; options: RequestInit; body: Record<string, unknown> }[];

beforeEach(() => {
  roles = []; approved = []; own = []; queue = []; signedIn = false; writes = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, options: RequestInit = {}) => {
    const path = input.replace("/api", "");
    if (options.method === "POST") {
      const body = JSON.parse(options.body as string);
      writes.push({ path, options, body });
      if (path === "/community/items") {
        own = [item({ ...body, id: "new", status: "pending", reviewedAt: null })];
        return { ok: true, json: async () => ({ item: own[0] }) };
      }
      if (path.startsWith("/community/moderation/items/")) {
        approved = queue.map((record) => ({ ...record, status: "approved" as const }));
        queue = [];
        return { ok: true, json: async () => ({ status: body.decision }) };
      }
    }
    const json = path === "/auth/session" ? { authenticated: signedIn, csrfToken: "test-csrf" }
      : path === "/community/mine" ? { roles, items: own, comments: [] }
      : path === "/community/moderation" ? { items: queue, comments: [] }
      : { items: approved };
    return { ok: true, json: async () => json };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("shared Gosie web and Week Ahead Communities", () => {
  it("shows an honest approved-only empty state and a sign-in prompt, without fictional substitutes", async () => {
    render(<CommunityPanel />);
    expect(await screen.findByText("Nothing approved yet.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Suggest an event or gem")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Include past events"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/community/items?includeExpired=true", expect.anything()));
  });
  it("submits an evergreen gem privately, without invented dates or client-supplied approval", async () => {
    signedIn = true; roles = ["contributor"];
    render(<CommunityPanel />);
    fireEvent.click(await screen.findByLabelText("An evergreen local gem"));
    for (const [label, value] of [["Title", "Untimed sample find"], ["Where", "Test neighborhood"],
      ["What makes it worth knowing", "Synthetic component test."], ["Credit it to", "Sample contributor"]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    expect(screen.queryByLabelText("Starts")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    expect(await screen.findByText("Thanks — your suggestion is waiting for review.")).toBeInTheDocument();
    expect(writes[0].body).toMatchObject({ kind: "gem", startsAt: null, endsAt: null });
    expect(writes[0].body).not.toHaveProperty("status");
    expect(writes[0].options.headers).toEqual({ "Content-Type": "application/json", "X-CSRF-Token": "test-csrf" });
    expect(await screen.findByText("Awaiting review")).toBeInTheDocument();
    expect(screen.getByText("Nothing approved yet.")).toBeInTheDocument();
  });
  it("moderator decisions use CSRF and refresh the approved feed separately from the queue", async () => {
    signedIn = true; roles = ["moderator"]; queue = [item({ status: "pending" })];
    render(<CommunityPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved and now public.")).toBeInTheDocument();
    await screen.findByText("All caught up.");
    expect(writes[0].path).toBe("/community/moderation/items/event-1");
    expect(writes[0].body).toEqual({ decision: "approved" });
    expect(screen.getByText("Community Thursday workshop")).toBeInTheDocument();
  });
  it("designated owners can send an event note for separate review", async () => {
    signedIn = true; roles = ["restaurant-owner"]; approved = [item()];
    render(<CommunityPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a note as your organization" }));
    fireEvent.change(screen.getByLabelText("Useful note for the community"), { target: { value: "Synthetic owner note" } });
    fireEvent.click(screen.getByRole("button", { name: "Send note" }));
    expect(await screen.findByText("Your note is waiting for review. It will appear under your organization's designated name.")).toBeInTheDocument();
    expect(writes[0].path).toBe("/community/items/event-1/comments");
    expect(writes[0].body).toEqual({ text: "Synthetic owner note" });
    expect(writes[0].body).not.toHaveProperty("attribution");
  });
  it.each(["venue", "municipality", "nonprofit"])("%s representatives can contribute without bypassing review", async (role) => {
    signedIn = true; roles = [role]; approved = [item()];
    render(<CommunityPanel />);
    expect(await screen.findByText("Suggest an event or gem")).toBeInTheDocument();
    expect(screen.getByText("For people. Made better by local knowledge.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Add a note as your organization" }));
    fireEvent.change(screen.getByLabelText("Useful note for the community"), { target: { value: "Synthetic practical details" } });
    fireEvent.click(screen.getByRole("button", { name: "Send note" }));
    expect(await screen.findByText(/Your note is waiting for review/)).toBeInTheDocument();
    expect(writes[0].body).toEqual({ text: "Synthetic practical details" });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
  it("keeps events on every actual day they overlap and evergreen gems outside date groups", async () => {
    approved = [item(), gem, item({ id: "outside", title: "Outside this week", startsAt: "2026-12-01T12:00:00Z", endsAt: "2026-12-01T14:00:00Z" })];
    render(<CommunityDiscoveries weekStart="2026-11-16" />);
    await screen.findByText("Evergreen garden");
    expect(screen.getAllByText("Community Thursday workshop")).toHaveLength(2);
    expect(screen.getByText("Thursday, Nov 19")).toBeInTheDocument();
    expect(screen.getByText("Friday, Nov 20")).toBeInTheDocument();
    expect(screen.queryByText("Outside this week")).not.toBeInTheDocument();
    const evergreen = screen.getByText("Evergreen garden").closest("article")!;
    expect(evergreen.querySelector(".gc-when")).toBeNull();
    fireEvent.click(evergreen.querySelector("button")!);
    expect(screen.getByText("Untimed community discovery.")).toBeInTheDocument();
  });
  it("shows service failures and offers retry instead of substituting sample listings", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Service offline"));
    render(<CommunityDiscoveries />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Service offline");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
  it("returns a readable error for missing API routing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => { throw new Error("HTML"); } })));
    await expect(communityRequest("/community/items")).rejects.toThrow("did not return a usable response");
  });
  it("the same shared native/web selector rejects expired, unapproved and untimed records", () => {
    expect(communityEventsInWindow([item(), gem, item({ id: "pending", status: "pending" }), item({ id: "old", expired: true })],
      new Date("2026-11-16T00:00Z"), new Date("2026-11-23T00:00Z")).map((record) => record.id)).toEqual(["event-1"]);
  });
});
