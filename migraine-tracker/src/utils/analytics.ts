import { format } from "date-fns";
import { DayEntry } from "../types/migraine";

export interface MonthStats {
  month: number;
  label: string;
  headaches: number;
  migraines: number;
  total: number;
}

export function getMonthlyStats(
  entries: Record<string, DayEntry>,
  year: number
): MonthStats[] {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: format(new Date(year, i, 1), "MMM"),
    headaches: 0,
    migraines: 0,
    total: 0,
  }));

  Object.values(entries).forEach((entry) => {
    const date = new Date(entry.date);

    if (date.getFullYear() !== year) return;

    const month = date.getMonth();

    if (entry.severity === 1) months[month].headaches++;
    if (entry.severity === 2) months[month].migraines++;

    months[month].total =
      months[month].headaches + months[month].migraines;
  });

  return months;
}