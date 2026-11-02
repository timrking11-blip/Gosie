import { createElement, type ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { WeekMock } from "@/components/gosie/WeekMock";
import { WeekendMock } from "@/components/gosie/WeekendMock";
import { Route } from "@/routes/index";

afterEach(cleanup);

// Independent expected data: do not import the component's records. These assertions
// must catch omissions, duplicate rendering, wrong days and accidental fixture edits.
const events = [
  { day: "Mon", time: "09:30", title: "Quarterly planning review", category: "Work" },
  { day: "Mon", time: "18:00", title: "Climbing session", category: "Personal" },
  { day: "Tue", time: "11:00", title: "Design critique · Atlas", category: "Work" },
  { day: "Wed", time: "08:00", title: "Dentist", category: "Errands" },
  { day: "Wed", time: "14:00", title: "Draft board memo", category: "Work" },
  { day: "Thu", time: "19:30", title: "Dinner with Sam & Priya", category: "Personal" },
  { day: "Fri", time: "16:00", title: "Renew passport form", category: "Errands" },
];

function assertEvents(preview: HTMLElement, mode: "category" | "chrono") {
  const scope = within(preview);
  const groups = mode === "chrono" ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : ["Work", "Personal", "Errands"];
  expect(scope.getAllByRole("group").slice(1).map((group) => group.getAttribute("aria-label"))).toEqual(groups);
  for (const event of events) {
    expect(scope.getAllByText(event.title, { exact: true })).toHaveLength(1);
    const group = scope.getByRole("group", { name: mode === "chrono" ? event.day : event.category });
    const row = within(group).getByText(event.title, { exact: true }).closest("li");
    expect(row).toHaveTextContent(`${mode === "chrono" ? event.category : event.day} · ${event.time}`);
  }
  const eventGroups = groups.map((name) => scope.getByRole("group", { name }));
  expect(eventGroups.flatMap((group) => within(group).getAllByRole("listitem"))).toHaveLength(7);
  if (mode === "chrono") {
    expect(within(scope.getByRole("group", { name: "Thu" })).getByText("Dinner with Sam & Priya")).toBeVisible();
    expect(within(scope.getByRole("group", { name: "Fri" })).getByText("Renew passport form")).toBeVisible();
  }
}

function switchGroupingWithoutLosingEvents(preview: HTMLElement) {
  const controls = within(within(preview).getByRole("group", { name: "Group week by" }));
  assertEvents(preview, "category");
  for (let cycle = 0; cycle < 2; cycle++) {
    fireEvent.click(controls.getByRole("button", { name: "Chronological" }));
    expect(controls.getByRole("button", { name: "Chronological" })).toHaveAttribute("aria-pressed", "true");
    expect(controls.getByRole("button", { name: "Category" })).toHaveAttribute("aria-pressed", "false");
    assertEvents(preview, "chrono");
    fireEvent.click(controls.getByRole("button", { name: "Category" }));
    expect(controls.getByRole("button", { name: "Category" })).toHaveAttribute("aria-pressed", "true");
    assertEvents(preview, "category");
  }
}

describe("Gosie demo interactions", () => {
  it.each([false, true])("retains all five weekdays and seven events through grouping changes (compact=%s)", (compact) => {
    render(<WeekMock compact={compact} />);
    switchGroupingWithoutLosingEvents(screen.getByRole("region", { name: "Week Ahead demo" }));
  });

  it.each(["hero", "dedicated"])("preserves all events in the actual %s Week Ahead preview", (location) => {
    const { container } = render(createElement(Route.options.component as ComponentType));
    const previews = screen.getAllByRole("region", { name: "Week Ahead demo" });
    expect(previews).toHaveLength(2);
    const section = container.querySelector(location === "hero" ? "#preview" : "#week") as HTMLElement;
    const target = within(section).getByRole("region", { name: "Week Ahead demo" });
    const other = previews.find((preview) => preview !== target)!;
    switchGroupingWithoutLosingEvents(target);
    // Component state must remain independent between the two embedded previews.
    assertEvents(other, "category");
  });

  it("re-ranks weekend ideas and expands their explanations", () => {
    render(<WeekendMock />);
    const firstIdea = () => screen.getAllByRole("listitem")[0];
    expect(firstIdea()).toHaveTextContent("Late set at a small jazz room");
    fireEvent.click(screen.getByRole("button", { name: "Solo" }));
    expect(firstIdea()).toHaveTextContent("Restored-print film night");
    const why = within(firstIdea()).getByRole("button", { name: "Why this idea? Restored-print film night" });
    const explanation = document.getElementById(why.getAttribute("aria-controls")!)!;
    expect(explanation).not.toBeVisible();
    fireEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(explanation).toBeVisible();
    expect(explanation).toHaveTextContent("Sample interest: classic cinema.");
    fireEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "false");
    expect(explanation).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    expect(firstIdea()).toHaveTextContent("Long lunch, shared plates");
    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    expect(firstIdea()).toHaveTextContent("Late set at a small jazz room");
    fireEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(firstIdea()).toHaveTextContent("Long lunch, shared plates");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(firstIdea()).toHaveTextContent("Late set at a small jazz room");
    expect(screen.getAllByText(/Sample fit:/)).toHaveLength(4);
    expect(screen.getByText("Example assumptions · not editable")).toBeInTheDocument();
  });

  it("switches the hero preview and closes the mobile menu after navigation", () => {
    render(createElement(Route.options.component as ComponentType));
    const selectors = within(screen.getByRole("group", { name: "Preview" }));
    fireEvent.click(selectors.getByRole("button", { name: "Weekend Ahead" }));
    expect(selectors.getByRole("button", { name: "Weekend Ahead" })).toHaveAttribute("aria-pressed", "true");
    expect(selectors.getByRole("button", { name: "Week Ahead" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(selectors.getByRole("button", { name: "Week Ahead" }));
    expect(selectors.getByRole("button", { name: "Week Ahead" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = screen.getByRole("navigation", { name: "Mobile" });
    fireEvent.click(within(menu).getByRole("link", { name: "Week Ahead" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the menu on Escape and restores focus to its disclosure button", () => {
    render(createElement(Route.options.component as ComponentType));
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const link = within(screen.getByRole("navigation", { name: "Mobile" })).getByRole("link", { name: "Week Ahead" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  });

  it("keeps native FAQ disclosures operable in the component environment", () => {
    const { container } = render(createElement(Route.options.component as ComponentType));
    const faqs = container.querySelectorAll("#faq details");
    expect(faqs).toHaveLength(4);
    for (const faq of faqs) {
      const summary = faq.querySelector("summary")!;
      expect(faq).not.toHaveAttribute("open");
      fireEvent.click(summary);
      expect(faq).toHaveAttribute("open");
      fireEvent.click(summary);
      expect(faq).not.toHaveAttribute("open");
    }
  });

  it("labels demo limitations and gives embedded explanations unique stable targets", () => {
    const { container } = render(createElement(Route.options.component as ComponentType));
    expect(screen.getByText(/In development · Release date to be announced/)).toBeInTheDocument();
    expect(screen.getByText(/The recommendations and scores are hardcoded examples/)).toBeInTheDocument();
    expect(screen.getByText(/Calendar connections are planned for the future, not implemented here/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/You saved|You rated|Prototype in active testing|being tested as a private prototype|Gosie learns from you/);
    const buttons = screen.getAllByRole("button", { name: /^Why this idea\?/ });
    expect(buttons).toHaveLength(8);
    const targetIds = buttons.map((button) => button.getAttribute("aria-controls"));
    expect(new Set(targetIds).size).toBe(8);
    for (const id of targetIds) expect(document.getElementById(id!)).not.toBeNull();
  });
});
