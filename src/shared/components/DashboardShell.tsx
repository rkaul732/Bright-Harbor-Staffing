import Link from "next/link";
import { Bell, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { APP_NAME, ROLE_LABELS } from "@/shared/lib/constants";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type { AppRole, DashboardData } from "@/shared/types/domain";

const nav = [
  { label: "Employee", href: "/employee", role: "employee" as AppRole },
  { label: "Admin", href: "/admin", role: "admin" as AppRole }
];

export function DashboardShell({
  role,
  data,
  children
}: {
  role: AppRole;
  data: DashboardData;
  children: React.ReactNode;
}) {
  const roleNotifications = data.notifications.filter(
    (notification) =>
      notification.role === role ||
      notification.role === "all" ||
      notification.user_id === data.currentUser.id
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="mb-5 rounded-lg border border-harbor-ocean/10 bg-white/80 p-4 shadow-line backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill">{ROLE_LABELS[role]} dashboard</span>
              {data.isDemo ? <StatusBadge value="demo" /> : null}
            </div>
            <h1 className="mt-3 text-2xl font-medium text-harbor-midnight sm:text-3xl">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-harbor-midnight/60">
              Signed in as {data.currentUser.full_name}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.role === role ? "primary-button px-3 py-2" : "secondary-button px-3 py-2"
                }
              >
                {item.role === "employee" ? (
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {item.label}
              </Link>
            ))}
            <Link href="/monthly-winners" className="secondary-button col-span-2 px-3 py-2 sm:col-span-1">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Winners
            </Link>
          </div>
        </div>

        {roleNotifications.length > 0 ? (
          <div className="mt-4 flex gap-2 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-2 text-sm text-harbor-midnight/70">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
            <p>{roleNotifications[0].title}: {roleNotifications[0].body}</p>
          </div>
        ) : null}
      </section>

      {children}
    </main>
  );
}
