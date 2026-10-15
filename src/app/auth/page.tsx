import { AuthPanel } from "@/features/auth/components/AuthPanel";

export default async function AuthPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto grid min-h-[calc(100vh-84px)] max-w-[86rem] items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16 lg:px-8 lg:py-14">
      <section className="relative hidden min-h-[35rem] overflow-hidden rounded-[2rem] bg-harbor-midnight p-10 text-white shadow-lift lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -right-36 -top-24 h-96 w-96 rounded-full border-[4rem] border-harbor-sky/15" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-harbor-ocean/40 blur-3xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-harbor-lemon">Bright Harbor Healthcare</p>
        <div className="relative">
          <h1 className="max-w-md text-4xl font-semibold leading-tight xl:text-5xl">A more connected way to care for your team.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/75">Access your schedule, time off, and staffing tools through one secure workspace.</p>
        </div>
        <p className="relative border-t border-white/20 pt-5 text-xs font-medium tracking-wide text-white/60">For Bright Harbor employees and administrators</p>
      </section>
      <AuthPanel nextPath={params.next} initialMode={params.mode === "sign-up" ? "sign-up" : "sign-in"} />
    </main>
  );
}
