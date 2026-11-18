import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLogin, useRegister } from "@workspace/api-client-react";

// Exercise the workspace client's real hooks, not mocks. pnpm peer variants can
// otherwise give these hooks a different context from the app's provider.
function LoginHooks() {
  const login = useLogin();
  const register = useRegister();
  return <p>{login.isIdle && register.isIdle ? "Sign-in hooks ready" : "Working"}</p>;
}

afterEach(cleanup);

describe("login query context across workspace packages", () => {
  it("lets the API client's sign-in and registration hooks use the web provider", () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><LoginHooks /></QueryClientProvider>);
    expect(screen.getByText("Sign-in hooks ready")).toBeInTheDocument();
    client.clear();
  });
});
