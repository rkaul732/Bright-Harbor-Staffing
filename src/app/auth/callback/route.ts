import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { getSupabaseEnv } from "@/shared/lib/supabase/env";

function isSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = isSafeNextPath(requestUrl.searchParams.get("next"));
  const isSignupConfirmation = requestUrl.searchParams.get("flow") === "signup";
  const redirectUrl = isSignupConfirmation
    ? new URL("/auth?mode=sign-in&confirmed=1&next=/auth/setup", request.url)
    : new URL(nextPath, request.url);
  let response = NextResponse.redirect(redirectUrl);

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code || !configured) {
    return isSignupConfirmation
      ? NextResponse.redirect(new URL("/auth?mode=sign-in&confirmation_error=1&next=/auth/setup", request.url))
      : response;
  }

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return response.cookies.get(name)?.value ?? request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (isSignupConfirmation) {
      return NextResponse.redirect(new URL("/auth?mode=sign-in&confirmation_error=1&next=/auth/setup", request.url));
    }
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("message", error.message);
    return NextResponse.redirect(authUrl);
  }

  if (isSignupConfirmation) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      const authUrl = new URL("/auth?mode=sign-in&confirmation_error=1&next=/auth/setup", request.url);
      return NextResponse.redirect(authUrl);
    }
    return response;
  }

  await supabase.rpc("record_current_user_login", {
    login_at: new Date().toISOString()
  });

  return response;
}
