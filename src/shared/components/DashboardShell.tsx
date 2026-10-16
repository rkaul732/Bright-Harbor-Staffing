import { Bell } from "lucide-react";
import { hasAdminAccess, hasSuperAdminAccess, hasSupervisorAccess } from "@/shared/lib/access";
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
  const canAccessReviewTools = hasAdminAccess(data) || hasSupervisorAccess(data);
  const canManageAccountTypes = hasSuperAdminAccess(data);
  const roleNotifications = data.notifications.filter(
    (notification) =>
      notification.user_id === data.currentUser.id ||
      (notification.user_id === null && (notification.role === role || notification.role === "all"))
  );

  return (
    <main className="mx-auto w-full max-w-[96rem] px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="fixed right-4 top-3 z-[110] sm:right-6 sm:top-5 lg:right-8">
        <ProfileMenu
          fullName={data.currentUser.full_name}
          email={data.currentUser.email}
          canAccessAdmin={canAccessReviewTools}
          canAccessEmployees={canAccessReviewTools}
          canAccessAutomatedMessages={canManageAccountTypes}
          canManageAccountTypes={canManageAccountTypes}
          canEditProfile={role === "employee" && Boolean(onProfileClick)}
          onProfileClick={onProfileClick}
        />
      </div>

      {roleNotifications.length > 0 ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-harbor-sky/20 bg-white px-4 py-3 text-sm text-harbor-midnight/75 shadow-line">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
          <p>{roleNotifications[0].title}: {roleNotifications[0].body}</p>
        </div>
      ) : null}

      {children}
    </main>
  );
}
