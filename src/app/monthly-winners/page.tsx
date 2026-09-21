import Link from "next/link";
import { ArrowLeft, CalendarDays, Trophy } from "lucide-react";
import { getMonthlyWinners } from "@/shared/lib/dashboard-data";
import { formatMonthYear, parseLocalDate } from "@/shared/lib/dates";

export const dynamic = "force-dynamic";

export default async function MonthlyWinnersPage() {
  const winners = await getMonthlyWinners();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/" className="ghost-button mb-5">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Home
      </Link>
      <section className="panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Monthly winners</p>
            <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">
              Most approved shifts
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/60">
              Employees with the most approved shift coverage each month are logged here.
            </p>
          </div>
          <div className="rounded-lg bg-harbor-lemon/65 p-3 text-sm text-harbor-midnight">
            {winners.length} winner{winners.length === 1 ? "" : "s"} recorded
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {winners.map((winner, index) => (
            <article
              key={winner.id}
              className="grid gap-4 rounded-lg border border-harbor-ocean/10 bg-white p-4 shadow-line sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-harbor-sky/15 text-harbor-ocean">
                {index === 0 ? (
                  <Trophy className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <CalendarDays className="h-6 w-6" aria-hidden="true" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-medium text-harbor-midnight">
                  {winner.worker_name}
                </h2>
                <p className="mt-1 text-sm text-harbor-midnight/60">
                  {formatMonthYear(parseLocalDate(winner.month))}
                  {winner.location_name ? ` • ${winner.location_name}` : ""}
                </p>
              </div>
              <div className="rounded-lg bg-harbor-mist px-4 py-3 text-center">
                <p className="text-2xl font-medium text-harbor-midnight">
                  {winner.approved_shift_count}
                </p>
                <p className="text-xs text-harbor-ocean">approved shifts</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
