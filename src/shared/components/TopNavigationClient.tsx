"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/shared/lib/constants";
import { cn } from "@/shared/lib/cn";

const viewLinks = [
  { label: "Employee View", href: "/employee", match: ["/employee"] },
  { label: "Admin View", href: "/admin", match: ["/admin", "/reports", "/automated-messages"] }
];

export function TopNavigationClient({
  showViewSwitcher
}: {
  showViewSwitcher: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[90] border-b border-harbor-ocean/10 bg-harbor-mist/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 pr-20 sm:px-6 sm:pr-24 lg:px-8">
        <Link
          href="/"
          className="focus-ring min-w-0 rounded-md text-sm font-medium text-harbor-midnight sm:text-base"
        >
          {APP_NAME}
        </Link>
        {showViewSwitcher ? (
          <div className="inline-flex shrink-0 items-center rounded-full border border-harbor-ocean/10 bg-white/75 p-1 shadow-line">
            {viewLinks.map((link) => {
              const active = link.match.some((item) => pathname.startsWith(item));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring rounded-full px-3 py-1.5 text-sm font-medium text-harbor-ocean transition sm:px-4",
                    active && "bg-harbor-midnight text-white shadow-line"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>
    </header>
  );
}
