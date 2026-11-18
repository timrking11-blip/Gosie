import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResearchedDiscoveries from "@/components/product/ResearchedDiscoveries";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows an approved-only empty state without fictional substitutes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schemaVersion: 1, records: [] }) }));
  render(<ResearchedDiscoveries />);
  expect(await screen.findByText(/No current discoveries have been approved/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/discoveries", expect.objectContaining({ credentials: "same-origin" }));
});
it("shows evidence, date distinctions and unknown constraints, not planning actions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    schemaVersion: 1, records: [{
      id: "fixture", title: "Fixture museum exhibition", venue: "Fixture museum", region: "Test region",
      category: "exhibit", why: "Synthetic reviewed evidence", status: "scheduled", flags: ["stale"],
      firstSeenAt: "2026-11-18T12:00:00Z", lastCheckedAt: "2026-11-18T12:00:00Z",
      dates: { publication: null, announcedOpening: null, confirmedOpening: null, exhibitStart: "2026-11-01", exhibitEnd: "2026-12-31" },
      sources: [{ url: "https://www.metmuseum.org/exhibitions", publisher: "Fixture source", excerpt: "Synthetic excerpt", publicationDate: null, checkedAt: "2026-11-18T12:00:00Z" }],
    }],
  }) }));
  render(<ResearchedDiscoveries />);
  await screen.findByText("Fixture museum exhibition");
  expect(screen.getByText(/Exhibit run:/)).toHaveTextContent("2026-11-01 to 2026-12-31");
  expect(screen.getByText(/First seen by Gosie:/)).toHaveTextContent("not an opening date");
  expect(screen.getByText(/Cost and travel unknown/)).toBeInTheDocument();
  const summary = screen.getByText("Sources and evidence");
  summary.focus();
  expect(summary).toHaveFocus();
  fireEvent.click(summary);
  expect(screen.getByRole("link", { name: /original source/ })).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.queryByRole("button", { name: /Save|Add to my week/ })).not.toBeInTheDocument();
});
it("announces an empty result and moves focus to the section heading after retry", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
    ok: true, json: async () => ({ schemaVersion: 1, records: [] }),
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ResearchedDiscoveries />);
  const retry = await screen.findByRole("button", { name: "Retry discoveries" });
  retry.focus();
  fireEvent.click(retry);
  expect(await screen.findByText(/No current discoveries/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No approved discoveries are currently available."));
  expect(screen.getByRole("heading", { name: "From public sources, reviewed by Gosie" })).toHaveFocus();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("announces populated results and moves focus after a successful retry", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
    ok: true, json: async () => ({ schemaVersion: 1, records: [{
      id: "retry-fixture", title: "Retry fixture gallery", venue: "Fixture gallery", region: "Test region",
      category: "gallery", why: "Synthetic reviewed evidence", status: "open", flags: [],
      firstSeenAt: "2026-11-18T12:00:00Z", lastCheckedAt: "2026-11-18T12:00:00Z",
      dates: { publication: null, announcedOpening: null, confirmedOpening: null, exhibitStart: null, exhibitEnd: null },
      sources: [],
    }] }),
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ResearchedDiscoveries />);
  const retry = await screen.findByRole("button", { name: "Retry discoveries" });
  retry.focus();
  fireEvent.click(retry);
  expect(await screen.findByText("Retry fixture gallery")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Loaded 1 approved discovery."));
  expect(screen.getByRole("heading", { name: "From public sources, reviewed by Gosie" })).toHaveFocus();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("keeps focus on retry after repeated failures and keeps the alert available", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", fetcher);
  render(<ResearchedDiscoveries />);
  const retry = await screen.findByRole("button", { name: "Retry discoveries" });
  retry.focus();
  fireEvent.click(retry);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(retry).toHaveFocus();
  expect(screen.getByRole("alert")).toHaveTextContent("Approved discoveries could not be loaded.");
  fireEvent.click(retry);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(retry).toHaveFocus();
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
