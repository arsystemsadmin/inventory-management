import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase Auth email links (sign-up confirmation, etc.).
 * Exchanges the one-time code for a session cookie, then opens the app.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      url.pathname = dest;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  url.pathname = "/login";
  url.search = "?error=link";
  return NextResponse.redirect(url);
}
