import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommunityPanel } from "@workspace/community/panel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mockService(operator: boolean, failure = false) {
  const writes: { body: Record<string, unknown>; headers: HeadersInit | undefined; path: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit = {}) => {
    if (options.method === "POST") {
      writes.push({ path, body: JSON.parse(options.body as string), headers: options.headers });
      return { ok: !failure, json: async () => failure ? { error: "access_changed_refresh_required" } : { status: "granted" } };
    }
    const json = path.endsWith("/auth/session") ? { authenticated: true, csrfToken: "synthetic-csrf" }
      : path.endsWith("/community/mine") ? { roles: ["moderator"], isOperator: operator, items: [], comments: [] }
      : path.endsWith("/organization-access") ? { grants: [{ userId: "synthetic-target", organizationType: "venue",
        publicIdentity: "Synthetic hall", accessVersion: "synthetic-version", legacy: false }], reviews: [], truncated: false }
      : path.endsWith("/organization-reviews") ? { reviews: [], truncated: false }
      : { items: [], comments: [] };
    return { ok: true, json: async () => json };
  }));
  return writes;
}
describe("operator-only reviewed organization access", () => {
  it("does not expose access controls to a moderator without operator authorization", async () => {
    mockService(false);
    render(<CommunityPanel />);
    await screen.findByText("Waiting for review");
    expect(screen.queryByRole("heading", { name: "Reviewed organization access" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/community/organization-access", expect.anything());
  });
  it("requires explicit review before sending the identity, type and reason with CSRF", async () => {
    const writes = mockService(true);
    render(<CommunityPanel />);
    const grant = await screen.findByRole("button", { name: "Grant reviewed organization access" });
    expect(grant).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Existing account ID"), { target: { value: "synthetic-recipient" } });
    fireEvent.change(screen.getByLabelText("Organization type"), { target: { value: "nonprofit" } });
    fireEvent.change(screen.getByLabelText("Approved public organization name"), { target: { value: "Synthetic neighborhood group" } });
    fireEvent.change(screen.getByLabelText("Private access review reason"), { target: { value: "Synthetic manual representation review." } });
    const checkbox = screen.getByRole("checkbox", { name: /I reviewed this account/ });
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText("Approved public organization name"), { target: { value: "Synthetic neighborhood charity" } });
    expect(grant).toBeDisabled();
    fireEvent.click(checkbox);
    fireEvent.click(grant);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toEqual({ userId: "synthetic-recipient", organizationType: "nonprofit",
      publicIdentity: "Synthetic neighborhood charity", reason: "Synthetic manual representation review." });
    expect(writes[0].headers).toMatchObject({ "X-CSRF-Token": "synthetic-csrf" });
    const notice = await screen.findByText("Reviewed organization access granted. Every contribution still needs moderation.");
    expect(notice.closest('[role="status"]')).toHaveFocus();
  });
  it("lets an operator cancel revocation, then submits a version-bound confirmation and shows conflicts", async () => {
    const writes = mockService(true, true);
    render(<CommunityPanel />);
    const review = await screen.findByRole("button", { name: "Review revocation of Synthetic hall" });
    fireEvent.click(review);
    expect(screen.getByLabelText("Private revocation reason")).toHaveFocus();
    expect(screen.getByText(/Existing content stays in its current review state/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm revocation" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel revocation" }));
    expect(writes).toHaveLength(0);
    expect(review).toHaveFocus();
    fireEvent.click(review);
    fireEvent.change(screen.getByLabelText("Private revocation reason"), { target: { value: "Synthetic revocation after review." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm revocation" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("This access changed since you opened it.");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText("Private revocation reason")).toHaveValue("Synthetic revocation after review.");
    expect(writes[0].path).toBe("/api/community/organization-access/revoke");
    expect(writes[0].body).toEqual({ userId: "synthetic-target", organizationType: "venue",
      accessVersion: "synthetic-version", reason: "Synthetic revocation after review." });
    expect(writes[0].headers).toMatchObject({ "X-CSRF-Token": "synthetic-csrf" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh access records" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Reviewed organization access" })).toHaveFocus());
    expect(screen.queryByLabelText("Private revocation reason")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I reviewed this account/ })).not.toBeChecked();
  });
  it("Escape cancels revocation without a write and restores the opening control", async () => {
    const writes = mockService(true);
    render(<CommunityPanel />);
    const review = await screen.findByRole("button", { name: "Review revocation of Synthetic hall" });
    fireEvent.click(review);
    const reason = screen.getByLabelText("Private revocation reason");
    expect(reason).toHaveFocus();
    fireEvent.change(reason, { target: { value: "Synthetic reason that must not be submitted." } });
    fireEvent.keyDown(reason, { key: "Escape" });
    expect(writes).toHaveLength(0);
    expect(review).toHaveFocus();
    expect(screen.queryByLabelText("Private revocation reason")).not.toBeInTheDocument();
    fireEvent.click(review);
    expect(screen.getByLabelText("Private revocation reason")).toHaveValue("");
  });
  it("does not enable a confirmed grant with blank account or public name", async () => {
    mockService(true);
    render(<CommunityPanel />);
    await screen.findByRole("button", { name: "Grant reviewed organization access" });
    fireEvent.change(screen.getByLabelText("Private access review reason"), { target: { value: "Synthetic reviewed reason." } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this account/ }));
    expect(screen.getByRole("button", { name: "Grant reviewed organization access" })).toBeDisabled();
  });
});
