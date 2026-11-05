// Same-origin client for the Gosie API (served by artifacts/api-server under /api). Relative URLs only.
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export type ProfileConfig = Record<string, unknown> & { schemaVersion: string };
export type Profile = { id: string; title: string; is_demo?: boolean; config: ProfileConfig };
export type Me = { user_id: string; email: string; csrf_token: string; expires_at: number };

const base = () => `${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/api`;

async function request<T>(method: string, path: string, opts: { body?: unknown; csrf?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.csrf) headers["X-CSRF-Token"] = opts.csrf;
  const res = await fetch(`${base()}${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const ct = res.headers.get("content-type") ?? "";
  // A static host answers /api/* with HTML; treat that as "API not available".
  if (!ct.includes("application/json")) throw new ApiError(res.status, "api_unavailable");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data?.error === "string" ? data.error : "request_failed");
  return data as T;
}

export const api = {
  isAvailable: async () => {
    try {
      const r = await request<{ ok?: boolean }>("GET", "/health");
      return r.ok === true;
    } catch {
      return false;
    }
  },
  me: () => request<Me>("GET", "/me"),
  register: (email: string, password: string) => request<{ id: string; email: string }>("POST", "/auth/register", { body: { email, password } }),
  login: (email: string, password: string) => request<{ user_id: string; csrf_token: string; expires_at: number }>("POST", "/auth/login", { body: { email, password } }),
  logout: (csrf: string) => request<{ status: string }>("POST", "/auth/logout", { body: {}, csrf }),
  listProfiles: () => request<{ profiles: Profile[] }>("GET", "/profiles").then((r) => r.profiles),
  demoProfiles: () => request<{ profiles: Profile[] }>("GET", "/demo-profiles").then((r) => r.profiles),
  createProfile: (csrf: string, title: string, config: ProfileConfig) => request<{ id: string; title: string }>("POST", "/profiles", { body: { title, config }, csrf }),
  deleteProfile: (csrf: string, id: string) => request<{ status: string }>("DELETE", `/profiles/${encodeURIComponent(id)}`, { csrf }),
};

const messages: Record<string, string> = {
  unauthorized: "Email or password is incorrect.",
  email_exists: "That email is already registered. Try signing in.",
  invalid_email: "Enter a valid email address.",
  password_too_short: "Use at least 8 characters for the password.",
  password_too_long: "That password is too long.",
  email_and_password_required: "Enter an email and a password.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  profile_limit_reached: "You have reached the profile limit. Delete one to add another.",
  api_unavailable: "The account service is not available right now.",
};
export const describeError = (e: unknown) => (e instanceof ApiError ? messages[e.code] ?? "Something went wrong. Please try again." : "Could not reach the server.");
