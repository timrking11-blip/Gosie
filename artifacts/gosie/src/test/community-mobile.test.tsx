import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor, act } from "@testing-library/react";

// Test the real native data hook independently of the screen's request mocks.
vi.mock("../../../gosie-mobile/node_modules/react-native", () => ({ Platform: { OS: "web" } }));
import { useCommunityItems, mobileApiBase } from "../../../gosie-mobile/hooks/useCommunity";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Gosie Mobile community integration", () => {
  it("loads approved data through the same-origin API and refreshes it", async () => {
    const first = { id: "approved-native-fixture", kind: "gem", status: "approved" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [first] }) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCommunityItems());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([first]);
    expect(fetchMock).toHaveBeenCalledWith("/api/community/items", expect.objectContaining({ credentials: "include" }));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await act(async () => result.current.refresh());
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe("");
  });
  it("clears stale listings and exposes an error when the community service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Service unavailable")));
    const { result } = renderHook(() => useCommunityItems());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe("Service unavailable");
    expect(mobileApiBase()).toBe("/api");
  });
});
