"use client";

import Link from "next/link";
import Image from "next/image";
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
    <header className="sticky top-0 z-[90] border-b border-harbor-ocean/10 bg-white/95 shadow-line backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-[96rem] flex-col items-start justify-center gap-1 px-4 py-2 pr-20 sm:min-h-[84px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:pr-28 lg:px-8 lg:pr-32">
        <Link
          href="/"
          className="focus-ring flex min-w-0 items-center gap-3 rounded-lg"
          aria-label={APP_NAME + " home"}
        >
          <Image
            src="/brand/bhh-logo.png"
            alt="Bright Harbor Healthcare"
            width={1000}
            height={428}
            priority
            className="h-[52px] w-auto shrink-0 sm:h-[66px]"
          />
          <span className="hidden border-l border-harbor-ocean/20 pl-3 text-[10px] font-bold uppercase leading-[1.4] tracking-[0.16em] text-harbor-ocean lg:block">
            Staffing<br />Portal
          </span>
        </Link>
        {showViewSwitcher ? (
          <div className="grid w-full max-w-[17rem] shrink-0 grid-cols-2 rounded-xl border border-harbor-ocean/10 bg-harbor-mist p-1 shadow-line sm:w-[17rem]">
            {viewLinks.map((link) => {
              const active = activeView === link.key;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-harbor-ocean transition hover:text-harbor-midnight",
                    active && "bg-harbor-midnight text-white shadow-line hover:text-white"
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
