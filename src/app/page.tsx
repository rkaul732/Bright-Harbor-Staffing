import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "@/shared/lib/constants";

const roleLinks = [
  { label: "Employee Login", href: "/auth?role=employee" },
  { label: "Admin Login", href: "/auth?role=admin" }
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6 lg:px-8">
      <section className="w-full overflow-hidden">
        <div className="grid min-h-[28rem] items-stretch lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center px-5 py-10 text-left sm:px-8 lg:px-10">
            <p className="label">Bright Harbor team access</p>
            <h1 className="mt-4 text-balance text-4xl font-medium leading-tight text-harbor-midnight sm:text-5xl lg:text-6xl">
              Welcome to {APP_NAME}.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-harbor-midnight/70">
              A staffing workspace for time off requests, posted shift coverage,
              pickup approvals, and a clearer view of who needs support across
              Bright Harbor programs.
            </p>

            <div className="mt-9 grid gap-3 sm:max-w-lg sm:grid-cols-2">
              {roleLinks.map((link) => (
                <Link key={link.href} href={link.href} className="primary-button py-3">
                  {link.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden rounded-lg bg-harbor-midnight p-6 text-left text-white shadow-soft lg:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-sm text-white/70">Today</p>
                <div className="mt-5 space-y-3">
                  {["Time off pending", "Open shifts", "Pickup requests"].map(
                    (item, index) => (
                      <div
                        key={item}
                        className="rounded-lg border border-white/10 bg-white/10 p-4"
                      >
                        <p className="text-sm text-white/70">{item}</p>
                        <p className="mt-2 text-3xl font-medium">
                          {[8, 14, 6][index]}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
              <p className="text-sm leading-6 text-white/68">
                Employees see their own requests first. Admins see staffing,
                approvals, and coverage activity in one place.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
