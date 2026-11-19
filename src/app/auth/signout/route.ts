import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Used when a signed-in user has no active profile (e.g. deactivated).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = request.nextUrl.searchParams.get("reason") === "inactive" ? "?error=inactive" : "";
  return NextResponse.redirect(url);
}
