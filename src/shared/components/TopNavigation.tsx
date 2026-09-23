import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { TopNavigationClient } from "@/shared/components/TopNavigationClient";

async function canShowViewSwitcher() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data: appUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (appUser?.role === "admin") {
      return true;
    }

    const { data: adminProfile } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

    return Boolean(adminProfile);
  } catch {
    return false;
  }
}

export async function TopNavigation() {
  const showViewSwitcher = await canShowViewSwitcher();

  return <TopNavigationClient showViewSwitcher={showViewSwitcher} />;
}
