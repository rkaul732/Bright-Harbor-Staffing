"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/shared/types/supabase";
import { getSupabaseEnv } from "@/shared/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
