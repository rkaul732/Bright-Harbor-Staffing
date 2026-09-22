"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "BH";
}

function menuItemClass(active = false) {
  return cn(
    "block w-full rounded-md px-3 py-2 text-left text-sm text-harbor-midnight/72 transition hover:bg-harbor-mist hover:text-harbor-midnight",
    active && "font-semibold text-harbor-midnight"
  );
}

export function ProfileMenu({
  fullName,
  email,
  canAccessAdmin,
  canEditProfile = false,
  onProfileClick
}: {
  fullName: string;
  email: string;
  canAccessAdmin: boolean;
  canEditProfile?: boolean;
  onProfileClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = getInitials(fullName);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={menuRef} className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="focus-ring inline-flex items-center gap-1 rounded-full bg-harbor-midnight px-1.5 py-1.5 text-white shadow-line transition hover:bg-harbor-ocean"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-medium tracking-normal">
          {initials}
        </span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-40 w-64 rounded-lg border border-harbor-ocean/10 bg-white p-2 shadow-soft"
        >
          <div className="border-b border-harbor-ocean/10 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-medium text-harbor-midnight">{fullName}</p>
            <p className="mt-1 truncate text-xs text-harbor-midnight/50">{email}</p>
          </div>

          <div className="py-2">
            {canEditProfile && onProfileClick ? (
              <button
                type="button"
                className={menuItemClass(false)}
                onClick={() => {
                  onProfileClick();
                  setOpen(false);
                }}
              >
                My Profile
              </button>
            ) : null}
            <Link
              href="/employee"
              className={menuItemClass(pathname.startsWith("/employee"))}
              onClick={() => setOpen(false)}
            >
              Employee View
            </Link>
            {canAccessAdmin ? (
              <>
                <Link
                  href="/admin"
                  className={menuItemClass(pathname.startsWith("/admin"))}
                  onClick={() => setOpen(false)}
                >
                  Admin View
                </Link>
                <Link
                  href="/reports"
                  className={menuItemClass(pathname.startsWith("/reports"))}
                  onClick={() => setOpen(false)}
                >
                  Reports
                </Link>
              </>
            ) : null}
            <Link
              href="/monthly-winners"
              className={menuItemClass(pathname.startsWith("/monthly-winners"))}
              onClick={() => setOpen(false)}
            >
              Monthly Winners
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
