import { createElement, type ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { WeekMock } from "@/components/gosie/WeekMock";
import { WeekendMock } from "@/components/gosie/WeekendMock";
import { Route } from "@/routes/index";

afterEach(cleanup);

describe("Imported Gosie interactions", () => {
  it("switches the weekly preview between category and chronological grouping", () => {
    render(<WeekMock />);
    const tabs = within(screen.getByRole("tablist", { name: "Group week by" }));
    expect(tabs.getByRole("tab", { name: "Category" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs.getByRole("tab", { name: "Chronological" }));
    expect(tabs.getByRole("tab", { name: "Chronological" })).toHaveAttribute("aria-selected", "true");
    expect(tabs.getByRole("tab", { name: "Category" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Quarterly planning review")).toBeInTheDocument();
  });

  it("re-ranks weekend ideas and expands their explanations", () => {
    render(<WeekendMock />);
    const firstIdea = () => screen.getAllByRole("listitem")[0];
    expect(firstIdea()).toHaveTextContent("Late set at a small jazz room");
    fireEvent.click(screen.getByRole("button", { name: "Solo" }));
    expect(firstIdea()).toHaveTextContent("Restored-print film night");
    const why = within(firstIdea()).getByRole("button", { name: "Why this idea?" });
    fireEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(firstIdea()).toHaveTextContent("You rated a classic-cinema idea highly");
    fireEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    expect(firstIdea()).toHaveTextContent("Long lunch, shared plates");
    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    expect(firstIdea()).toHaveTextContent("Late set at a small jazz room");
    fireEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(firstIdea()).toHaveTextContent("Long lunch, shared plates");
  });

  it("switches the hero preview and closes the mobile menu after navigation", () => {
    render(createElement(Route.options.component as ComponentType));
    const tabs = within(screen.getByRole("tablist", { name: "Preview" }));
    fireEvent.click(tabs.getByRole("tab", { name: "Weekend Ahead" }));
    expect(tabs.getByRole("tab", { name: "Weekend Ahead" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs.getByRole("tab", { name: "Week Ahead" }));
    expect(tabs.getByRole("tab", { name: "Week Ahead" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = screen.getByRole("navigation", { name: "Mobile" });
    fireEvent.click(within(menu).getByRole("link", { name: "Week Ahead" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
