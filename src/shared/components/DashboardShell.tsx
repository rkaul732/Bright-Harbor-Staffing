import { Bell } from "lucide-react";
import { hasAdminAccess, hasSuperAdminAccess } from "@/shared/lib/access";
import { ProfileMenu } from "@/shared/components/ProfileMenu";
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
      <div className="fixed right-4 top-2.5 z-[110] sm:right-6 lg:right-8">
        <ProfileMenu
          fullName={data.currentUser.full_name}
          email={data.currentUser.email}
          canAccessAdmin={hasAdminAccess(data)}
          canAccessAutomatedMessages={hasSuperAdminAccess(data)}
          canEditProfile={role === "employee" && Boolean(onProfileClick)}
          onProfileClick={onProfileClick}
        />
      </div>

      {roleNotifications.length > 0 ? (
        <div className="mb-4 flex gap-2 rounded-lg border border-harbor-sky/20 bg-white/90 px-3 py-2 text-sm text-harbor-midnight/70 shadow-line">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
          <p>{roleNotifications[0].title}: {roleNotifications[0].body}</p>
        </div>
      ) : null}

      {children}
    </main>
  );
}
