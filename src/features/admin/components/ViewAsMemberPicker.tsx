"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import type { AppRole } from "@/shared/types/domain";

export type PreviewMember = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
};

export function ViewAsMemberPicker({
  members,
  compact = false
}: {
  members: PreviewMember[];
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchingMembers = members
    .filter((member) =>
      `${member.full_name} ${member.email} ${member.role}`.toLocaleLowerCase().includes(normalizedSearch)
    )
    .slice(0, compact ? 8 : 30);

  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Search site members</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-harbor-ocean" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className="focus-ring w-full rounded-lg border border-harbor-ocean/15 bg-white py-2 pl-9 pr-3 text-sm text-harbor-midnight placeholder:text-harbor-midnight/45"
        />
      </label>
      <div className={compact ? "max-h-64 space-y-1 overflow-y-auto" : "max-h-[32rem] space-y-1 overflow-y-auto"}>
        {matchingMembers.length ? matchingMembers.map((member) => (
          <Link
            key={member.id}
            href={`/view-as?member=${encodeURIComponent(member.id)}`}
            className="focus-ring block rounded-lg px-3 py-2 transition hover:bg-harbor-mist"
          >
            <span className="block truncate text-sm font-semibold text-harbor-midnight">{member.full_name}</span>
            <span className="block truncate text-xs text-harbor-midnight/60">{member.email} · {member.role}</span>
          </Link>
        )) : (
          <p className="px-3 py-4 text-sm text-harbor-midnight/60">No matching members.</p>
        )}
      </div>
      {!compact && matchingMembers.length === 30 ? (
        <p className="text-xs text-harbor-midnight/50">Keep typing to narrow the results.</p>
      ) : null}
    </div>
  );
}
