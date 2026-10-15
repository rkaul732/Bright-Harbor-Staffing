import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardCheck, UsersRound } from "lucide-react";

const features = [
  { icon: CalendarDays, title: "Time off, clearly tracked", description: "Submit requests and follow each decision from your own dashboard." },
  { icon: UsersRound, title: "Coverage in view", description: "Find posted shifts and keep program schedules in one place." },
  { icon: ClipboardCheck, title: "A simpler review flow", description: "Managers can review requests and coordinate staffing with confidence." }
];

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-harbor-midnight text-white shadow-lift">
        <div className="pointer-events-none absolute -right-20 -top-48 h-[34rem] w-[34rem] rounded-full border border-white/10 bg-harbor-sky/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-72 right-20 h-[38rem] w-[38rem] rounded-full border border-white/10 bg-harbor-ocean/40 blur-3xl" />
        <div className="relative grid min-h-[33rem] items-center gap-10 px-6 py-14 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.7fr)] lg:gap-16 lg:px-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-harbor-lemon">
              <span className="h-1.5 w-1.5 rounded-full bg-harbor-lemon" />Bright Harbor team portal
            </p>
            <h1 className="mt-7 text-balance text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.7rem]">Better coordination for every shift.</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/75 sm:text-lg">A central place for Bright Harbor employees and managers to manage time off, shift coverage, and the programs they support.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/auth" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-harbor-lemon px-5 py-2.5 text-sm font-bold text-harbor-midnight transition hover:bg-white">Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href="/auth?mode=sign-up" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Create employee account</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:ml-auto" aria-hidden="true">
            <div className="absolute -inset-4 rounded-[2rem] border border-white/10" />
            <div className="relative overflow-hidden rounded-2xl border border-white/30 bg-white p-6 text-harbor-midnight shadow-lift sm:p-8">
              <div className="flex items-center justify-between border-b border-harbor-ocean/10 pb-5">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-harbor-ocean">Staffing workspace</span>
                <span className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-harbor-sky" /><i className="h-2 w-2 rounded-full bg-harbor-lemon" /><i className="h-2 w-2 rounded-full bg-harbor-ocean" /></span>
              </div>
              <p className="mt-6 text-2xl font-semibold">Your day, organized.</p>
              <p className="mt-2 text-sm leading-6 text-harbor-midnight/60">The essentials your team needs, all in one place.</p>
              <div className="mt-6 space-y-3">
                {features.map(({ icon: Icon, title }) => (
                  <div key={title} className="flex items-center gap-3 rounded-xl border border-harbor-ocean/10 bg-harbor-mist/60 p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-harbor-ocean shadow-line"><Icon className="h-4 w-4" /></span>
                    <span className="text-sm font-semibold">{title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-harbor-mist"><div className="h-full w-2/3 rounded-full bg-harbor-sky" /></div>
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 py-8 sm:grid-cols-3 sm:py-10" aria-label="Portal features">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="panel p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-harbor-mist text-harbor-ocean"><Icon className="h-5 w-5" aria-hidden="true" /></div>
            <h2 className="mt-5 text-lg font-semibold text-harbor-midnight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-harbor-midnight/65">{description}</p>
          </div>
        ))}
      </section>
      <p className="text-center text-xs font-medium tracking-[0.08em] text-harbor-ocean/70">BRIGHT HARBOR HEALTHCARE · STAFFING PORTAL</p>
    </main>
  );
}
