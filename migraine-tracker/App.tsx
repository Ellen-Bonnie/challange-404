import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import Calendar from "./components/Calendar";
import { useMigraineStore } from "./hooks/useMigraineStore";
import { useMemo, useState } from "react";
import { getMonthlyStats } from "./utils/analytics";
import YearView from "./components/YearView";
import AnalyticsSummary from "./components/AnalyticsSummary";

export default function App() {
  const {
    entries,
    setSeverity,
    stats,
  } = useMigraineStore();

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-white">

      <div className="flex">

        <Sidebar />

        <main className="flex-1 p-8 space-y-8">

          <Header />

          <StatsCards
            headaches={stats.headaches}
            migraines={stats.migraines}
            symptomFree={stats.symptomFree}
            affected={stats.affected}
          />

          <Calendar
            entries={entries}
            setSeverity={setSeverity}
          />

        </main>

      </div>

    </div>
  );
}