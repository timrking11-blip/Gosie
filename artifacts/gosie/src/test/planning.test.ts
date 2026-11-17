import { describe, expect, it } from "vitest";
import { groupPlans, localDate } from "@/lib/planning";
import type { WeekItem } from "@workspace/api-client-react";

describe("owned plan grouping", () => {
  const items: WeekItem[] = Array.from({ length: 7 }, (_, index) => ({
    id: `item-${index}`, day: `2026-11-${16 + index}`, title: `Plan ${index}`,
    category: index % 2 ? "Work" : "Personal", company: null, timeLabel: "09:00",
    domain: "personal", priority: "Medium", completed: false,
  }));
  it("retains every dated event across all grouping changes, including Thursday and Friday", () => {
    for (const grouping of ["chronological", "category", "company", "chronological"] as const) {
      const groups = groupPlans(items, grouping);
      expect(Object.values(groups).flat().map((item) => item.id).sort()).toEqual(items.map((item) => item.id).sort());
      if (grouping === "chronological") {
        expect(Object.keys(groups)).toHaveLength(7);
        expect(groups["Thursday, Nov 19"][0].id).toBe("item-3");
        expect(groups["Friday, Nov 20"][0].id).toBe("item-4");
      }
    }
  });
  it("orders dated plans by date and time without mutating API data", () => {
    const reversed = [...items].reverse();
    expect(Object.values(groupPlans(reversed, "chronological")).flat().map((item) => item.id)).toEqual(items.map((item) => item.id));
    expect(reversed[0].id).toBe("item-6");
  });
  it("formats local dates without a UTC day shift", () => {
    const date = new Date(2026, 10, 16, 0, 15);
    expect(localDate(date)).toBe("2026-11-16");
  });
});
