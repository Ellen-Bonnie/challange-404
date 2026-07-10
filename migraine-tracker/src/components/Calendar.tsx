import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Severity } from "../types/migraine";
import { DayEntry } from "../types/migraine";

interface Props {
  entries: Record<string, DayEntry>;
  setSeverity: (date: string, severity: Severity) => void;
}

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Calendar({ entries, setSeverity }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
    });
  }, [currentMonth]);

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900 shadow-sm p-6">

      <div className="flex items-center justify-between mb-6">

        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ChevronLeft />
        </button>

        <div className="text-2xl font-bold">
          {format(currentMonth, "MMMM yyyy")}
        </div>

        <div className="flex gap-2">

          <button
            onClick={() => setCurrentMonth(new Date())}
            className="rounded-xl px-4 py-2 bg-zinc-100 dark:bg-zinc-800"
          >
            Today
          </button>

          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ChevronRight />
          </button>

        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">

        {WEEK.map(day => (
          <div
            key={day}
            className="text-center text-sm text-zinc-500 font-medium py-2"
          >
            {day}
          </div>
        ))}

      </div>

      <div className="grid grid-cols-7 gap-2">

        {days.map(day => {

          const key = format(day, "yyyy-MM-dd");
          const severity = entries[key]?.severity ?? 0;

          let color =
            "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700";

          if (severity === 1)
            color = "bg-yellow-100 border-yellow-300";

          if (severity === 2)
            color = "bg-red-200 border-red-400";

          return (
            <DayCell
              key={key}
              day={day}
              color={color}
              severity={severity}
              current={isSameMonth(day, currentMonth)}
              today={isToday(day)}
              onSelect={(level) => setSeverity(key, level)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CellProps {
  day: Date;
  color: string;
  severity: Severity;
  current: boolean;
  today: boolean;
  onSelect: (level: Severity) => void;
}

function DayCell({
  day,
  color,
  current,
  today,
  onSelect,
}: CellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">

      <button
        onClick={() => setOpen(!open)}
        className={`
          ${color}
          w-full
          h-24
          rounded-2xl
          p-2
          transition
          hover:scale-[1.03]
          hover:shadow-md
          ${!current && "opacity-40"}
          ${today && "ring-2 ring-blue-500"}
        `}
      >
        <div className="text-right font-semibold">
          {format(day, "d")}
        </div>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl bg-white dark:bg-zinc-800 shadow-xl border overflow-hidden">

          <Option
            color="bg-white"
            label="No symptoms"
            onClick={() => {
              onSelect(0);
              setOpen(false);
            }}
          />

          <Option
            color="bg-yellow-100"
            label="Headache"
            onClick={() => {
              onSelect(1);
              setOpen(false);
            }}
          />

          <Option
            color="bg-red-200"
            label="Migraine"
            onClick={() => {
              onSelect(2);
              setOpen(false);
            }}
          />

        </div>
      )}
    </div>
  );
}

interface OptionProps {
  label: string;
  color: string;
  onClick: () => void;
}

function Option({ label, color, onClick }: OptionProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:brightness-95 ${color}`}
    >
      {label}
    </button>
  );
}