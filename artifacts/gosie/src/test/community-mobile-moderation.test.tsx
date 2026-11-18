import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

// Render the actual native screen with DOM platform stand-ins. These tests do
// not claim real-phone layout or native assistive-technology verification.
vi.mock("../../../gosie-mobile/node_modules/react-native", async () => {
  const { createElement: h } = await import("react");
  const pass = (tag: string) => ({ children, accessibilityRole }: { children?: React.ReactNode; accessibilityRole?: string }) =>
    h(tag, { role: accessibilityRole === "alert" ? "alert" : undefined }, children);
  return {
    Platform: { OS: "web" },
    View: pass("div"), ScrollView: pass("div"), Text: pass("span"),
    ActivityIndicator: ({ accessibilityLabel }: { accessibilityLabel?: string }) => h("span", { role: "status" }, accessibilityLabel),
    TextInput: ({ accessibilityLabel, value, onChangeText, editable }: { accessibilityLabel?: string; value?: string; onChangeText?: (v: string) => void; editable?: boolean }) =>
      h("textarea", { "aria-label": accessibilityLabel, value, disabled: editable === false, onChange: (e: { target: { value: string } }) => onChangeText?.(e.target.value) }),
    TouchableOpacity: ({ children, onPress, disabled, accessibilityRole }: { children?: React.ReactNode; onPress?: () => void; disabled?: boolean; accessibilityRole?: string }) =>
      h("button", { type: "button", role: accessibilityRole === "radio" ? "radio" : undefined, disabled, onClick: onPress }, children),
  };
});
vi.mock("../../../gosie-mobile/node_modules/react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children?: React.ReactNode }) => children }));
const native = vi.hoisted(() => ({ responses: {} as Record<string, unknown>, posts: [] as { path: string; body: unknown }[], fail: false }));
vi.mock("../../../gosie-mobile/hooks/useCommunity", () => ({
  useCommunityItems: () => ({ items: native.responses["/community/items"] ?? [], loading: false, error: "", refresh: async () => undefined }),
  mobileCommunityRequest: async (path: string, options: { method?: string; body?: string } = {}) => {
    if (options.method === "POST") {
      native.posts.push({ path, body: JSON.parse(options.body || "{}") });
      if (native.fail) throw new Error("Decision service unavailable");
      return {};
    }
    return native.responses[path];
  },
}));
vi.mock("../../../gosie-mobile/components/CommunityFeed", async () => {
  const { createElement: h } = await import("react");
  return {
    communityStyles: new Proxy({}, { get: () => ({}) }),
    CommunityCard: ({ item, children }: { item: { title: string }; children?: React.ReactNode }) =>
      h("article", null, h("h3", null, item.title), children),
  };
});
import CommunitiesScreen from "../../../gosie-mobile/app/(tabs)/communities";

afterEach(cleanup);
const fixture = (over: Record<string, unknown> = {}) => ({
  id: "n-item", kind: "gem", title: "Library seed swap", description: "Free seeds.", location: "Main branch",
  attribution: "Riverside Library", sourceUrl: null, startsAt: null, endsAt: null, status: "pending",
  createdAt: "2026-11-17T12:00:00Z", reviewedAt: null, expired: false, why: "", comments: [], ...over,
});
function setup(queueItems: unknown[], mineItems: unknown[] = [], publicItems: unknown[] = []) {
  native.posts = []; native.fail = false;
  native.responses = {
    "/auth/session": { authenticated: true, csrfToken: "native-csrf" },
    "/community/mine": { roles: ["moderator"], items: mineItems, comments: [] },
    "/community/moderation": { items: queueItems, comments: [] },
    "/community/items": publicItems,
  };
}
describe("Gosie Mobile Communities moderation screen", () => {
  it("shows the checklist and disables decisions until a valid reason", async () => {
    setup([fixture({ canReview: true })]);
    render(<CommunitiesScreen />);
    expect(await screen.findByText("Before you decide, check for people first")).toBeInTheDocument();
    expect(screen.getByText(/not advertising-only/)).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Approve find" });
    expect(approve).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject find" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason for decision on this find (required)"), { target: { value: "short" } });
    fireEvent.click(approve);
    expect(approve).toBeDisabled();
    expect(native.posts).toHaveLength(0);
  });
  it("posts the trimmed reason and keeps it after a failed request", async () => {
    setup([fixture({ canReview: true })]); native.fail = true;
    render(<CommunitiesScreen />);
    const field = await screen.findByLabelText("Reason for decision on this find (required)");
    fireEvent.change(field, { target: { value: "  Advertising only, no access details.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Reject find" }));
    await screen.findByText("Decision service unavailable");
    expect(native.posts[0]).toEqual({ path: "/community/moderation/items/n-item", body: { decision: "rejected", decisionReason: "Advertising only, no access details." } });
    expect(field).toHaveValue("  Advertising only, no access details.  ");
  });
  it("removes decision controls on own contributions", async () => {
    setup([fixture({ canReview: false })]); render(<CommunitiesScreen />);
    await screen.findByText(/You cannot review your own contribution/);
    expect(screen.queryByRole("button", { name: "Approve find" })).not.toBeInTheDocument();
  });
  it("shows private and legacy reasons only on own records", async () => {
    setup([], [fixture({ id: "a", title: "Own approved", status: "approved", decisionReason: "Clear, free and practical." }),
      fixture({ id: "b", title: "Own legacy", status: "rejected", decisionReason: null })],
    [fixture({ id: "p", title: "Public swap", status: "approved", decisionReason: "Must never be rendered on public cards." })]);
    render(<CommunitiesScreen />);
    await screen.findByText("Clear, free and practical.");
    expect(screen.getByText(/No reason was recorded/)).toBeInTheDocument();
    expect(screen.getByText("Public swap").closest("article")).not.toHaveTextContent("Moderator reason");
    expect(screen.queryByText("Must never be rendered on public cards.")).not.toBeInTheDocument();
  });
  it("submits an organization-note decision with its own reason", async () => {
    setup([]);
    native.responses["/community/moderation"] = { items: [], comments: [
      { id: "comment-1", itemId: "event-1", text: "Practical note", attribution: "Library", status: "pending", canReview: true },
    ] };
    render(<CommunitiesScreen />);
    const field = await screen.findByLabelText("Reason for decision on this comment (required)");
    fireEvent.change(field, { target: { value: "Useful entrance and accessibility details." } });
    fireEvent.click(screen.getByRole("button", { name: "Approve comment" }));
    await waitFor(() => expect(native.posts).toEqual([{
      path: "/community/moderation/comments/comment-1",
      body: { decision: "approved", decisionReason: "Useful entrance and accessibility details." },
    }]));
  });
});
