import { format } from "date-fns";
import { MonthStats } from "../utils/analytics";

interface Props {
  stats: MonthStats[];
  onSelect: (month: number) => void;
}

export default function YearView({ stats, onSelect }: Props) {
  return (
    <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-4">

      {stats.map((month) => (
        <button
          key={month.month}
          onClick={() => onSelect(month.month)}
          className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm p-5 text-left hover:shadow-md transition"
        >
          <h3 className="font-bold text-lg">
            {month.label}
          </h3>

          <div className="mt-4 flex justify-between">

            <div>
              <div className="text-xs text-zinc-500">
                Headache
              </div>

              <div className="font-semibold text-yellow-600">
                {month.headaches}
              </div>
            </div>

            <div>
              <div className="text-xs text-zinc-500">
                Migraine
              </div>

              <div className="font-semibold text-red-600">
                {month.migraines}
              </div>
            </div>

          </div>

          <div className="mt-4 h-2 rounded-full bg-zinc-200 overflow-hidden">

            <div
              className="h-full bg-blue-500"
              style={{
                width: `${Math.min(month.total * 5, 100)}%`,
              }}
            />

          </div>

          <div className="mt-2 text-xs text-zinc-500">
            {month.total} affected days
          </div>

        </button>
      ))}

    </div>
  );
}