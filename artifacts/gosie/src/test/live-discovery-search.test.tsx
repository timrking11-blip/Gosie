import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LiveDiscoverySearch from "@/components/product/LiveDiscoverySearch";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({ apiRequest }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("authenticated on-demand discovery search", () => {
  beforeEach(() => { apiRequest.mockResolvedValue({ retrievedAt: "2026-11-18T12:00:00Z", category: "arts", results: [] }); });
  it("discloses the exact search fields and requires use restriction acceptance before sending anything", () => {
    render(<LiveDiscoverySearch />);
    expect(screen.getByText(/does not send your profile, interests, budget, travel limits, or account identity/)).toBeInTheDocument();
    expect(screen.getByText(/not saved by Gosie/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search public sources/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("City or broad region"), { target: { value: "Brooklyn, NY" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-11-21" } });
    fireEvent.click(screen.getByRole("button", { name: /Search public sources/ }));
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("sends only submitted region, dates, category and explicit terms acceptance; keeps results transient", async () => {
    apiRequest.mockResolvedValueOnce({ retrievedAt: "2026-11-18T12:00:00Z", category: "arts", results: [{
      id: "brave-1", title: "Museum open studio", url: "https://museum.example.org/studio",
      description: "An unverified public-source snippet.", publisher: "museum.example.org", age: "2 days ago",
    }] });
    render(<LiveDiscoverySearch />);
    fireEvent.change(screen.getByLabelText("City or broad region"), { target: { value: "Brooklyn, NY" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-11-21" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Search public sources/ }));
    await screen.findByRole("link", { name: /Check original source/ });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/discoveries/search", {
      method: "POST", body: { region: "Brooklyn, NY", startDate: "2026-11-20",
        endDate: "2026-11-21", category: "arts", termsAccepted: true },
    });
    expect(screen.getByText(/date, price, availability, accessibility and travel are unverified/)).toBeInTheDocument();
    expect(screen.getByText(/not a personal fit score/)).toBeInTheDocument();
    const sourceLink = screen.getByRole("link", { name: /Check original source/ });
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(sourceLink).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(localStorage.length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /Clear results/ }));
    await waitFor(() => expect(screen.queryByText("Museum open studio")).not.toBeInTheDocument());
  });
  it("shows disabled, rate-limit, provider-error and empty states without fictional substitutions", async () => {
    apiRequest.mockRejectedValueOnce(new Error("discovery_search_not_enabled"))
      .mockRejectedValueOnce(new Error("search_rate_limited"))
      .mockRejectedValueOnce(new Error("discovery_provider_unavailable"));
    render(<LiveDiscoverySearch />);
    const fillAndSubmit = () => {
      fireEvent.change(screen.getByLabelText("City or broad region"), { target: { value: "Brooklyn, NY" } });
      fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-20" } });
      fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-11-21" } });
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      if (!checkbox.checked) fireEvent.click(checkbox);
      fireEvent.click(screen.getByRole("button", { name: /Search public sources/ }));
    };
    fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("not enabled");
    await waitFor(() => expect(screen.getByRole("button", { name: /Search public sources/ })).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("City or broad region"), { target: { value: "Brooklyn, NY" } });
    fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("search limit");
    await waitFor(() => expect(screen.getByRole("button", { name: /Search public sources/ })).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("City or broad region"), { target: { value: "Brooklyn, NY" } });
    fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByText(/fictional examples/)).not.toBeInTheDocument();
  });
});
