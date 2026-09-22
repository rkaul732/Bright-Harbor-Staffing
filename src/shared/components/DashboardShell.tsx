import { Bell } from "lucide-react";
import { APP_NAME, ROLE_LABELS } from "@/shared/lib/constants";
import { hasAdminAccess } from "@/shared/lib/access";
import { ProfileMenu } from "@/shared/components/ProfileMenu";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type { AppRole, DashboardData } from "@/shared/types/domain";

export function DashboardShell({
  role,
  data,
  children,
  onProfileClick
}: {
  role: AppRole;
  data: DashboardData;
  children: React.ReactNode;
  onProfileClick?: () => void;
}) {
  const roleNotifications = data.notifications.filter(
    (notification) =>
      notification.role === role ||
      notification.role === "all" ||
      notification.user_id === data.currentUser.id
  );

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 lg:px-6">
      <section className="mb-4 rounded-lg border border-harbor-ocean/10 bg-white/90 p-3 shadow-line backdrop-blur sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill">{ROLE_LABELS[role]} dashboard</span>
              {data.isDemo ? <StatusBadge value="demo" /> : null}
            </div>
            <h1 className="mt-2 text-xl font-medium text-harbor-midnight sm:text-2xl">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-harbor-midnight/60">
              Signed in as {data.currentUser.full_name}
            </p>
          </div>

          <ProfileMenu
            fullName={data.currentUser.full_name}
            email={data.currentUser.email}
            canAccessAdmin={hasAdminAccess(data)}
            canEditProfile={role === "employee" && Boolean(onProfileClick)}
            onProfileClick={onProfileClick}
          />
        </div>

        {roleNotifications.length > 0 ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-2 text-sm text-harbor-midnight/70">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
            <p>{roleNotifications[0].title}: {roleNotifications[0].body}</p>
          </div>
        ) : null}
      </section>

      {children}
    </main>
  );
}
