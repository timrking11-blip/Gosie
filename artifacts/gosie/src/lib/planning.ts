import type { WeekItem, WeekGrouping } from "@workspace/api-client-react";

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function groupPlans(items: WeekItem[], grouping: WeekGrouping): Record<string, WeekItem[]> {
  const groups: Record<string, WeekItem[]> = {};
  const ordered = [...items].sort((a, b) => a.day.localeCompare(b.day) || (a.timeLabel || "99:99").localeCompare(b.timeLabel || "99:99"));
  for (const item of ordered) {
    const label = grouping === "category" ? item.category || "Other"
      : grouping === "company" ? item.company || "Personal"
      : new Date(`${item.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
    (groups[label] ||= []).push(item);
  }
  return groups;
}
