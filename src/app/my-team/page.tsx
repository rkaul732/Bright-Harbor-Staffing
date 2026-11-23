import { redirect } from "next/navigation";
import { Search, UsersRound } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { EmptyState } from "@/shared/components/EmptyState";
import { hasAdminAccess, hasSupervisorAccess } from "@/shared/lib/access";
import { getProgramLabel } from "@/shared/lib/constants";
import { getDashboardData } from "@/shared/lib/dashboard-data";
import { getMyTeam } from "@/shared/lib/my-team";

export const dynamic = "force-dynamic";

export default async function MyTeamPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const data = await getDashboardData("admin");
  if (!hasAdminAccess(data) && !hasSupervisorAccess(data)) redirect("/employee");

  const isAdmin = data.currentUser.role === "admin";
  const team = getMyTeam(data);
  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const search = query.toLocaleLowerCase();
  const visibleTeam = search
    ? team.filter(({ user, sharedPrograms }) =>
        `${user.full_name} ${user.email} ${sharedPrograms.map(getProgramLabel).join(" ")}`
          .toLocaleLowerCase().includes(search)
      )
    : team;

  return (
    <DashboardShell role={data.currentUser.role} data={data}>
      <section className="panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-harbor-sky">{isAdmin ? "Admin directory" : "Supervisor directory"}</p>
            <h1 className="mt-2 text-3xl font-semibold text-harbor-midnight sm:text-4xl">My Team</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/65">
              {isAdmin
                ? "Supervisors in the programs you oversee."
                : "Employees assigned to the programs you supervise."}
            </p>
          </div>
          <span className="pill w-fit">{team.length} {isAdmin ? "supervisor" : "employee"}{team.length === 1 ? "" : "s"}</span>
        </div>

        <form action="/my-team" method="get" className="mt-6 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="team-search" className="sr-only">Search My Team</label>
          <input
            id="team-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search name, email, or program"
            className="field max-w-xl"
          />
          <button type="submit" className="primary-button shrink-0">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>
      </section>

      <section className="panel mt-4 overflow-hidden">
        <div className="border-b border-harbor-ocean/10 px-5 py-4 sm:px-7">
          <p className="label">Team directory</p>
          <h2 className="mt-1 text-xl font-semibold text-harbor-midnight">
            {isAdmin ? "Supervisors" : "Employees"}
          </h2>
          {query ? <p className="mt-1 text-sm text-harbor-midnight/60">{visibleTeam.length} matching results</p> : null}
        </div>
        {visibleTeam.length ? (
          <div className="divide-y divide-harbor-ocean/10">
            {visibleTeam.map(({ user, sharedPrograms }) => (
              <div key={user.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6 sm:px-7">
                <div className="min-w-0">
                  <h3 className="font-semibold text-harbor-midnight">{user.full_name}</h3>
                  <a href={`mailto:${user.email}`} className="mt-1 block break-all text-sm text-harbor-ocean hover:underline">
                    {user.email}
                  </a>
                </div>
                <div className="flex flex-wrap content-start gap-2" aria-label="Shared programs">
                  {[...new Set(sharedPrograms.map(getProgramLabel))].map((program) => (
                    <span key={program} className="rounded-full border border-harbor-sky/20 bg-harbor-mist px-3 py-1 text-sm text-harbor-midnight/75">
                      {program}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 sm:p-7">
            <EmptyState
              icon={UsersRound}
              title={query ? "No matching team members" : "No team members assigned yet"}
              body={query ? "Try a different name, email, or program." : "Team members will appear here when their program assignments are approved."}
            />
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
