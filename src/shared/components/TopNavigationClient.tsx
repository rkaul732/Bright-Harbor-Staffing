"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/shared/lib/constants";
import { cn } from "@/shared/lib/cn";

const viewLinks = [
  { key: "employee", label: "Employee View", href: "/employee" },
  { key: "admin", label: "Admin View", href: "/admin" }
] as const;

function activeViewForPath(pathname: string) {
  if (pathname.startsWith("/employee")) return "employee";
  if (["/admin", "/employees", "/reports", "/automated-messages"].some((path) => pathname.startsWith(path))) {
    return "admin";
  }

  return null;
}

export function TopNavigationClient({
  showViewSwitcher
}: {
  showViewSwitcher: boolean;
}) {
  const pathname = usePathname();
  const activeView = activeViewForPath(pathname);

  return (
    <header className="sticky top-0 z-[90] border-b border-harbor-ocean/10 bg-harbor-mist/85 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-2 px-3 py-2 pr-28 sm:px-4 sm:pr-32 lg:px-5 lg:pr-36">
        <Link
          href="/"
          className="focus-ring min-w-0 rounded-md text-sm font-medium text-harbor-midnight sm:text-base"
        >
          {APP_NAME}
        </Link>
        {showViewSwitcher ? (
          <div className="grid w-[15rem] shrink-0 grid-cols-2 rounded-full border border-harbor-ocean/10 bg-white/75 p-0.5 shadow-line">
            {viewLinks.map((link) => {
              const active = activeView === link.key;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex items-center justify-center rounded-full px-2 py-1 text-[12px] font-normal text-harbor-ocean/70 transition hover:text-harbor-midnight",
                    active && "bg-harbor-midnight font-semibold text-white shadow-line hover:text-white"
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
