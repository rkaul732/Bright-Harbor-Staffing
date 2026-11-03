import { RequestPasswordResetPanel } from "@/features/auth/components/RequestPasswordResetPanel";

export default function RequestPasswordResetPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <RequestPasswordResetPanel />
    </main>
  );
}
