import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Account } from "@/components/gosie/Account";
import { api, ApiError, describeError } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Handler = (url: string, init: RequestInit) => { status?: number; json?: unknown; html?: boolean };

// Minimal in-test fake of the API so the component and client are exercised end to end.
function fakeServer(handler: Handler) {
  const calls: { method: string; url: string; headers: Record<string, string>; body?: unknown; credentials?: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? "GET", url, headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined, credentials: init.credentials });
    const r = handler(url, init);
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? (r.html ? "text/html" : "application/json; charset=utf-8") : null) },
      json: async () => r.json ?? {},
    };
  });
  return calls;
}

describe("api client", () => {
  it("uses relative /api URLs, same-origin credentials and the CSRF header", async () => {
    const calls = fakeServer(() => ({ json: { status: "deleted" } }));
    await api.deleteProfile("tok", "p 1");
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/profiles/p%201", credentials: "same-origin" });
    expect(calls[0].headers["X-CSRF-Token"]).toBe("tok");
  });

  it("treats an HTML answer (static host) as API unavailable", async () => {
    fakeServer(() => ({ html: true }));
    expect(await api.isAvailable()).toBe(false);
    await expect(api.me()).rejects.toMatchObject({ code: "api_unavailable" });
  });

  it("maps API error codes to readable messages", () => {
    expect(describeError(new ApiError(401, "unauthorized"))).toMatch(/incorrect/);
    expect(describeError(new ApiError(500, "weird"))).toMatch(/try again/);
    expect(describeError(new TypeError("network"))).toMatch(/reach the server/);
  });
});

describe("Account", () => {
  beforeEach(() => cleanup());

  it("renders nothing when the API is not available", async () => {
    const calls = fakeServer(() => ({ html: true }));
    const { container } = render(<Account />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(container.querySelector("#account")).toBeNull();
  });

  it("registers, signs in, lists, creates and deletes profiles", async () => {
    let profiles: { id: string; title: string; config: unknown }[] = [];
    let signedIn = false;
    const calls = fakeServer((url, init) => {
      const m = init.method ?? "GET";
      if (url === "/api/health") return { json: { ok: true } };
      if (url === "/api/me") return signedIn ? { json: { user_id: "u", email: "me@example.com", csrf_token: "csrf1", expires_at: 1 } } : { status: 401, json: { error: "unauthorized" } };
      if (url === "/api/auth/register") return { status: 201, json: { id: "u", email: "me@example.com" } };
      if (url === "/api/auth/login") { signedIn = true; return { json: { user_id: "u", csrf_token: "csrf1", expires_at: 1 } }; }
      if (url === "/api/demo-profiles") return { json: { profiles: [{ id: "demo-maya", title: "Maya — Professional Focus", config: { schemaVersion: "1.0.0-draft" } }] } };
      if (url === "/api/profiles" && m === "GET") return { json: { profiles } };
      if (url === "/api/profiles" && m === "POST") { profiles = [{ id: "p1", title: "Maya's plan", config: {} }]; return { status: 201, json: { id: "p1", title: "Maya's plan" } }; }
      if (url === "/api/profiles/p1" && m === "DELETE") { profiles = []; return { json: { status: "deleted" } }; }
      if (url === "/api/auth/logout") { signedIn = false; return { json: { status: "logged_out" } }; }
      return { status: 404, json: { error: "not_found" } };
    });

    render(<Account />);
    fireEvent.click(await screen.findByText("Need an account?"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/Signed in as/)).toBeInTheDocument();
    expect(await screen.findByText(/No profiles yet/)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Maya — Professional Focus" }));
    expect(await screen.findByText("Maya's plan")).toBeInTheDocument();
    const create = calls.find((c) => c.method === "POST" && c.url === "/api/profiles")!;
    expect(create.headers["X-CSRF-Token"]).toBe("csrf1");

    fireEvent.click(screen.getByRole("button", { name: "Delete Maya's plan" }));
    expect(await screen.findByText(/No profiles yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("form", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a readable error for a wrong password", async () => {
    fakeServer((url) => {
      if (url === "/api/health") return { json: { ok: true } };
      if (url === "/api/me") return { status: 401, json: { error: "unauthorized" } };
      return { status: 401, json: { error: "unauthorized" } };
    });
    render(<Account />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });
});
