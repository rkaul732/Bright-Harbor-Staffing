import { AuthPanel } from "@/features/auth/components/AuthPanel";
import type { AppRole } from "@/shared/types/domain";

function parseRole(role?: string): AppRole {
  if (role === "admin" || role === "employee") {
    return role;
  }

  return "employee";
}

export default async function AuthPage({
  searchParams
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <AuthPanel initialRole={parseRole(params.role)} nextPath={params.next} />
    </main>
  );
}
