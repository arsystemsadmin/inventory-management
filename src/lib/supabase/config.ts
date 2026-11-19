/**
 * True when the Supabase URL and anon key are present. NEXT_PUBLIC_* values
 * are inlined at build time, so on Cloudflare they must be set as *build*
 * variables. Without them the app runs
 * in browser demo mode (localStorage).
 */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const NOT_CONNECTED_MESSAGE =
  "Demo mode: accounts and data are saved in this browser only. Nothing is sent to a server.";
