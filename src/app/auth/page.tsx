import { AuthPanel } from "@/features/auth/components/AuthPanel";

export default async function AuthPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <AuthPanel nextPath={params.next} />
    </main>
  );
}
