import type { SelectHTMLAttributes } from "react";

export const quarterHourTimes = Array.from({ length: 96 }, (_, index) =>
  `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`);

export function TimeSelect({ value = "", emptyLabel = "Choose a time", ...props }:
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> & { value?: string; emptyLabel?: string }) {
  // Retain previously saved non-quarter-hour times without silently rounding them.
  const values = value && !quarterHourTimes.includes(value)
    ? [...quarterHourTimes, value].sort() : quarterHourTimes;
  return <select {...props} value={value}>
    <option value="">{emptyLabel}</option>
    {values.map((time) => {
      const [hour, minute] = time.split(":").map(Number);
      return <option key={time} value={time}>{hour % 12 || 12}:{String(minute).padStart(2, "0")} {hour < 12 ? "AM" : "PM"}</option>;
    })}
  </select>;
}

export function localEventIso(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Choose a date and time for both the start and end.");
  const value = new Date(`${day}T${time}:00`);
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (Number.isNaN(value.getTime()) || value.getFullYear() !== year || value.getMonth() !== month - 1 ||
    value.getDate() !== date || value.getHours() !== hour || value.getMinutes() !== minute)
    throw new Error("That date or local time does not exist. Choose another time, especially around daylight-saving changes.");
  return value.toISOString();
}
