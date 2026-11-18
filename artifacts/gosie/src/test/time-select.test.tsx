import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TimeSelect, quarterHourTimes, localEventIso } from "@workspace/community/time";

afterEach(cleanup);
it("offers the full day in quarter-hour increments and stores HH:mm", () => {
  expect(quarterHourTimes).toHaveLength(96);
  expect(quarterHourTimes[0]).toBe("00:00");
  expect(quarterHourTimes[95]).toBe("23:45");
  expect(new Set(quarterHourTimes).size).toBe(96);
  render(<TimeSelect aria-label="Time" defaultValue="" />);
  const select = screen.getByLabelText("Time");
  expect(screen.getByRole("option", { name: "12:00 AM" })).toHaveValue("00:00");
  expect(screen.getByRole("option", { name: "12:00 PM" })).toHaveValue("12:00");
  fireEvent.change(select, { target: { value: "18:15" } });
  expect(screen.getByRole("option", { name: "6:15 PM" })).toHaveValue("18:15");
});
it("retains an existing non-quarter-hour time without rounding", () => {
  render(<TimeSelect aria-label="Time" value="09:07" onChange={() => {}} />);
  expect(screen.getByLabelText("Time")).toHaveValue("09:07");
  expect(screen.getByRole("option", { name: "9:07 AM" })).toBeInTheDocument();
});
it("converts chosen local dates and times to API timestamps and rejects invalid input", () => {
  const iso = localEventIso("2030-01-02", "18:15");
  expect(new Date(iso).getHours()).toBe(18);
  expect(new Date(iso).getMinutes()).toBe(15);
  expect(() => localEventIso("2030-02-30", "18:15")).toThrow(/does not exist/);
  expect(() => localEventIso("2030-01-02", "6:15 PM")).toThrow(/Choose a date and time/);
  expect(() => localEventIso("", "")).toThrow(/Choose a date and time/);
});
