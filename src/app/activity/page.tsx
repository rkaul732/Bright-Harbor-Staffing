import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, Search } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { hasSuperAdminAccess } from "@/shared/lib/access";
import { getDashboardData } from "@/shared/lib/dashboard-data";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { AppUser } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type LoginEvent = {
  id: number;
  user_id: string;
  signed_in_at: string;
  is_prior_last_sign_in: boolean;
};

type ActivityParams = {
  q?: string | string[];
  person?: string | string[];
  page?: string | string[];
};

function pageNumber(value: string | string[] | undefined) {
  if (typeof value !== "string") return 1;
  const parsed = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : 1;
}

function activityHref({ q, person, page }: { q?: string; person?: string; page?: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (person) params.set("person", person);
  if (page && page !== "1") params.set("page", page);
  const search = params.toString();
  return search ? `/activity?${search}` : "/activity";
}

function formatSignIn(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short"
  }).format(new Date(value));
}

function StaffMatch({ user, q }: { user: AppUser; q: string }) {
  return (
    <Link
      href={activityHref({ q, person: user.id })}
      className="focus-ring block rounded-lg border border-harbor-ocean/10 bg-white px-4 py-3 transition hover:border-harbor-sky/40 hover:bg-harbor-mist/50"
    >
      <span className="block text-sm font-semibold text-harbor-midnight">{user.full_name}</span>
      <span className="mt-0.5 block text-xs text-harbor-midnight/60">{user.email}</span>
    </Link>
  );
}

export default async function ActivityPage({
  searchParams
}: {
  searchParams: Promise<ActivityParams>;
}) {
  const data = await getDashboardData("admin");
  if (!hasSuperAdminAccess(data)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const personId = typeof params.person === "string" ? params.person : "";
  const page = pageNumber(params.page);
  const users = [...data.users].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const userById = new Map(users.map((user) => [user.id, user]));
  const matches = q
    ? users.filter((user) => `${user.full_name} ${user.email}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
    : [];
  const selectedPerson = personId
    ? userById.get(personId)
    : matches.length === 1
      ? matches[0]
      : undefined;

  if (personId && !selectedPerson) {
    redirect("/activity");
  }

  const showEvents = !q || Boolean(selectedPerson);
  let events: LoginEvent[] = [];
  let total = 0;
  let loadError: string | null = null;

  if (showEvents && isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("staff_login_events")
      .select("id,user_id,signed_in_at,is_prior_last_sign_in", { count: "exact" })
      .order("signed_in_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (selectedPerson) {
      query = query.eq("user_id", selectedPerson.id);
    }

    const result = await query;
    if (result.error) {
      loadError = "Login activity could not be loaded. Please try again shortly.";
    } else {
      events = result.data ?? [];
      total = result.count ?? 0;
    }
  }

  if (total > 0 && (page - 1) * PAGE_SIZE >= total) {
    redirect(activityHref({ q, person: selectedPerson?.id }));
  }

  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, total);
  const pagePerson = selectedPerson?.id;

  return (
    <DashboardShell role="admin" data={data}>
      <section className="panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-harbor-sky">Super Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-harbor-midnight sm:text-4xl">Activity</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/65">
              See when staff members signed in. Search by name or company email to view one person’s login history.
            </p>
          </div>
          {showEvents ? <span className="pill w-fit">{total} sign-in {total === 1 ? "record" : "records"}</span> : null}
        </div>

        <form action="/activity" method="get" className="mt-6 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="activity-search" className="sr-only">Search staff activity</label>
          <input
            id="activity-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search employee name or email"
            className="field max-w-xl"
          />
          <button type="submit" className="primary-button shrink-0">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
          {q || selectedPerson ? (
            <Link href="/activity" className="secondary-button shrink-0">Clear</Link>
          ) : null}
        </form>
      </section>

      {q && matches.length !== 1 && !personId ? (
        <section className="panel mt-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-harbor-midnight">
            {matches.length ? "Choose a staff member" : "No matching staff member"}
          </h2>
          <p className="mt-1 text-sm text-harbor-midnight/60">
            {matches.length
              ? "Select one person to see only their sign-in records."
              : "Try a different name or Bright Harbor email address."}
          </p>
          {matches.length > 0 ? (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 24).map((user) => <StaffMatch key={user.id} user={user} q={q} />)}
              </div>
              {matches.length > 24 ? (
                <p className="mt-3 text-xs text-harbor-midnight/55">Showing the first 24 matches. Enter more of the name to narrow the list.</p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : (
        <section className="panel mt-4 overflow-hidden">
          <div className="flex flex-col gap-1 border-b border-harbor-ocean/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label">Sign-in history</p>
              <h2 className="mt-1 text-xl font-semibold text-harbor-midnight">
                {selectedPerson ? selectedPerson.full_name : "Recent sign-ins"}
              </h2>
              {selectedPerson ? <p className="mt-0.5 text-sm text-harbor-midnight/55">{selectedPerson.email}</p> : null}
            </div>
            <p className="text-xs text-harbor-midnight/55">Times shown in Eastern Time</p>
          </div>

          {loadError ? (
            <p role="alert" className="px-5 py-8 text-sm text-red-700">{loadError}</p>
          ) : events.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-harbor-mist text-[11px] font-semibold uppercase tracking-[0.08em] text-harbor-ocean">
                    <tr>
                      <th className="px-5 py-3">Staff member</th>
                      <th className="px-5 py-3">Company email</th>
                      <th className="px-5 py-3">Sign-in time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => {
                      const person = userById.get(event.user_id);
                      return (
                        <tr key={event.id} className="border-t border-harbor-ocean/10 align-top">
                          <td className="px-5 py-3 font-medium text-harbor-midnight">{person?.full_name ?? "Deleted employee"}</td>
                          <td className="px-5 py-3 text-harbor-midnight/65">{person?.email ?? "—"}</td>
                          <td className="px-5 py-3 text-harbor-midnight">
                            <time dateTime={event.signed_in_at}>{formatSignIn(event.signed_in_at)}</time>
                            {event.is_prior_last_sign_in ? (
                              <span className="mt-1 block text-xs text-harbor-midnight/50">Last known sign-in before activity tracking</span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-harbor-ocean/10 px-5 py-4 text-sm text-harbor-midnight/60 sm:flex-row sm:items-center sm:justify-between">
                <span>Showing {start}–{end} of {total}</span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link className="secondary-button" href={activityHref({ q, person: pagePerson, page: String(page - 1) })}>Previous</Link>
                  ) : null}
                  {end < total ? (
                    <Link className="secondary-button" href={activityHref({ q, person: pagePerson, page: String(page + 1) })}>Next</Link>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 px-5 py-8 text-sm text-harbor-midnight/65">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-harbor-sky" aria-hidden="true" />
              <p>No sign-ins have been recorded for {selectedPerson ? selectedPerson.full_name : "staff"} yet.</p>
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
