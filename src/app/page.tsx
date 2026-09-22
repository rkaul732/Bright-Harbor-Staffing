import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "@/shared/lib/constants";

const roleLinks = [
  { label: "Employee Login", href: "/auth?role=employee" },
  { label: "Admin Login", href: "/auth?role=admin" }
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-5xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6 lg:px-8">
      <section className="w-full overflow-hidden">
        <div className="mx-auto flex min-h-[28rem] max-w-3xl flex-col justify-center px-5 py-10 text-left sm:px-8 lg:px-10">
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
      </section>
    </main>
  );
}
