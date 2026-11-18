import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
it("offers retry rather than replacing an API failure with examples", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
    ok: true, json: async () => ({ schemaVersion: 1, records: [] }),
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ResearchedDiscoveries />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry discoveries" }));
  expect(await screen.findByText(/No current discoveries/)).toBeInTheDocument();
});
