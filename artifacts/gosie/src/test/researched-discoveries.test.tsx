import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResearchedDiscoveries from "@/components/product/ResearchedDiscoveries";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
type TestRecord = {
  id: string; title: string; venue: string; region: string; category: string; why: string; status: string;
  verification: string; sourceType: string; firstSeenAt: string; lastCheckedAt: string; flags: string[];
  dates: { publication: string | null; announcedOpening: string | null; confirmedOpening: string | null; exhibitStart: string | null; exhibitEnd: string | null };
  sources: { url: string; publisher: string; excerpt: string; publicationDate: string | null; checkedAt: string }[];
  price: null; travelMinutes: null; accessibility: null; hours: null; availability: null; constraintStatus: string;
};
const baseRecord: TestRecord = {
  id: "experience-0123456789abcdef01234567", title: "Fixture museum exhibition", venue: "Fixture museum",
  region: "Test region", category: "exhibit", why: "Synthetic reviewed evidence", status: "scheduled",
  verification: "source-supported", sourceType: "reviewed-public-research",
  firstSeenAt: "2026-11-18T12:00:00Z", lastCheckedAt: "2026-11-18T12:00:00Z", flags: ["stale"],
  dates: { publication: null, announcedOpening: null, confirmedOpening: null, exhibitStart: "2026-11-01", exhibitEnd: "2026-12-31" },
  sources: [{ url: "https://www.metmuseum.org/exhibitions", publisher: "Fixture source",
    excerpt: "Synthetic excerpt", publicationDate: null, checkedAt: "2026-11-18T12:00:00Z" }],
  price: null, travelMinutes: null, accessibility: null, hours: null, availability: null, constraintStatus: "not-evaluated",
};
const validRecord = (overrides: Partial<TestRecord> = {}): TestRecord => ({ ...baseRecord, ...overrides });
const validCatalog = (records: unknown[] = []) => ({
  schemaVersion: 1, revision: "synthetic-test-revision", checkedAt: "2026-11-18T12:00:00Z", warning: null, records,
});
const okResponse = (records: unknown[] = []) => ({ ok: true, text: async () => JSON.stringify(validCatalog(records)) });
it("shows an approved-only empty state without fictional substitutes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
  render(<ResearchedDiscoveries />);
  expect(await screen.findByText(/No current discoveries have been approved/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/discoveries", expect.objectContaining({ credentials: "same-origin" }));
});
it("shows evidence, date distinctions and unknown constraints, not planning actions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse([validRecord()])));
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
    ...okResponse(),
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
    ...okResponse([validRecord({
      id: "experience-1123456789abcdef01234567", title: "Retry fixture gallery", venue: "Fixture gallery",
      category: "experience", status: "open", flags: [],
      dates: { publication: null, announcedOpening: null, confirmedOpening: null, exhibitStart: null, exhibitEnd: null },
    })]),
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
  expect(screen.getByRole("alert")).toHaveTextContent(/Reviewed discoveries are unavailable or could not be validated/);
  fireEvent.click(retry);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(retry).toHaveFocus();
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
const malformedFixtures = [
  ["malformed date", (record: ReturnType<typeof validRecord>) => ({ ...record,
    dates: { ...record.dates, exhibitStart: "2026-02-31" } })],
  ["missing sources", (record: ReturnType<typeof validRecord>) => {
    const { sources: _sources, ...withoutSources } = record;
    return withoutSources;
  }],
  ["invalid flags", (record: ReturnType<typeof validRecord>) => ({ ...record, flags: ["unrecognized-flag"] })],
  ["invalid link", (record: ReturnType<typeof validRecord>) => ({ ...record,
    sources: [{ ...record.sources[0], url: "javascript:alert(1)" }] })],
] as const;
for (const [label, mutate] of malformedFixtures) {
  it(`shows an unavailable and retry state for ${label} without rendering the malformed record`, async () => {
    const record = validRecord();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse([mutate(record)])));
    render(<ResearchedDiscoveries />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable or could not be validated/);
    expect(screen.getByRole("button", { name: "Retry discoveries" })).toBeInTheDocument();
    expect(screen.queryByText("Fixture museum exhibition")).not.toBeInTheDocument();
  });
}
it("rejects an oversized catalog response before parsing or rendering it", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => " ".repeat(2 * 1024 * 1024 + 1) }));
  render(<ResearchedDiscoveries />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable or could not be validated/);
  expect(screen.getByRole("button", { name: "Retry discoveries" })).toBeInTheDocument();
});
it("rejects catalogs over the record-count or per-field limits", async () => {
  const tooManyRecords = Array.from({ length: 501 }, (_, index) =>
    validRecord({ id: `experience-${index.toString(16).padStart(24, "0")}` }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(tooManyRecords)));
  const first = render(<ResearchedDiscoveries />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable or could not be validated/);
  first.unmount();
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse([validRecord({ title: "T".repeat(201) })])));
  render(<ResearchedDiscoveries />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable or could not be validated/);
});
