import { DayEntry } from "../types/migraine";

const KEY = "migraine-tracker";

export function loadEntries(): Record<string, DayEntry> {

    const raw = localStorage.getItem(KEY);

    if (!raw) return {};

    return JSON.parse(raw);

}

export function saveEntries(data: Record<string, DayEntry>) {

    localStorage.setItem(KEY, JSON.stringify(data));

}