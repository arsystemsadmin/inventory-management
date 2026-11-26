import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeveloperEmail } from "@/lib/dev-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/config";

// Developer hub: every account's errors. Hidden (404) for anyone not in DEV_EMAILS.
export const metadata = { title: "Error log · Dev", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Row = {
  id: number; created_at: string; business_id: string | null; user_id: string | null; user_email: string | null;
  user_role: string | null; source: string; action: string; path: string | null; message: string | null;
  code: string | null; details: unknown; user_agent: string | null;
};

const RANGES = { "1": "24 hours", "7": "7 days", "30": "30 days" } as const;

export default async function DevErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; business?: string; action?: string; days?: string; q?: string }>;
}) {
  if (!supabaseConfigured) notFound();
  const dev = await getDeveloperEmail();
  if (!dev) notFound();
  const admin = await createAdminClient();
  if (!admin) return <p className="p-6 text-sm">The server secret key isn&apos;t set, so the log can&apos;t be read.</p>;

  const sp = await searchParams;
  const days = sp.days && sp.days in RANGES ? sp.days : "7";
  const since = new Date(Date.now() - Number(days) * 86_400_000).toISOString();
  const uuid = /^[0-9a-f-]{36}$/i;

  let q = admin.from("error_log").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(300);
  if (sp.user && uuid.test(sp.user)) q = q.eq("user_id", sp.user);
  if (sp.business && uuid.test(sp.business)) q = q.eq("business_id", sp.business);
  if (sp.action) q = q.eq("action", sp.action.slice(0, 100));
  if (sp.q) q = q.ilike("message", `%${sp.q.slice(0, 100).replace(/[%_]/g, "")}%`);

  const [{ data: rows, error }, { data: summaryRows }] = await Promise.all([
    q,
    admin.from("error_log").select("user_id, user_email, business_id, action").gte("created_at", since).limit(5000),
  ]);
  const list = (rows ?? []) as Row[];
  const summary = (summaryRows ?? []) as Pick<Row, "user_id" | "user_email" | "business_id" | "action">[];

  const businessIds = [...new Set([...list, ...summary].map((r) => r.business_id).filter(Boolean))] as string[];
  const { data: businesses } = businessIds.length
    ? await admin.from("businesses").select("id, name").in("id", businessIds)
    : { data: [] as { id: string; name: string }[] };
  const bizName = new Map((businesses ?? []).map((b) => [b.id, b.name]));

  // Errors per account and per action for the selected period.
  const byAccount = new Map<string, { email: string; business: string | null; count: number }>();
  const byAction = new Map<string, number>();
  for (const r of summary) {
    const key = r.user_id ?? "anonymous";
    const cur = byAccount.get(key) ?? { email: r.user_email ?? "Not signed in", business: r.business_id, count: 0 };
    cur.count++;
    byAccount.set(key, cur);
    byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1);
  }
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { days, user: sp.user, business: sp.business, action: sp.action, q: sp.q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/dev/errors?${p}`;
  };
  const filtered = sp.user || sp.business || sp.action || sp.q;

  return (
    <main dir="ltr" className="mx-auto grid max-w-6xl gap-5 px-4 py-6 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Error log <span className="text-sm font-normal text-muted-foreground">developers only</span></h1>
        <span className="text-xs text-muted-foreground">Signed in as {dev}</span>
      </header>

      <nav className="flex flex-wrap items-center gap-2">
        {Object.entries(RANGES).map(([d, label]) => (
          <Link key={d} href={link({ days: d })} className={`rounded-md border px-3 py-1.5 ${d === days ? "bg-foreground text-background" : ""}`}>{label}</Link>
        ))}
        <form action="/dev/errors" className="flex gap-2">
          <input type="hidden" name="days" value={days} />
          {sp.user && <input type="hidden" name="user" value={sp.user} />}
          {sp.business && <input type="hidden" name="business" value={sp.business} />}
          {sp.action && <input type="hidden" name="action" value={sp.action} />}
          <input name="q" defaultValue={sp.q} placeholder="Search messages" className="h-9 rounded-md border px-3" />
          <button className="h-9 rounded-md border px-3" type="submit">Search</button>
        </form>
        {filtered && <Link href={`/dev/errors?days=${days}`} className="underline">Clear filters</Link>}
      </nav>

      {error && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">Couldn&apos;t read the log: {error.message}</p>}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <h2 className="mb-2 font-semibold">By account ({RANGES[days as keyof typeof RANGES]})</h2>
          {byAccount.size === 0 ? <p className="text-muted-foreground">No errors.</p> : (
            <ul className="divide-y">
              {[...byAccount.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30).map(([id, a]) => (
                <li key={id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    {id === "anonymous" ? <span>{a.email}</span> : <Link href={link({ user: id })} className="underline">{a.email}</Link>}
                    {a.business && (
                      <Link href={link({ business: a.business })} className="ms-2 text-xs text-muted-foreground underline">
                        {bizName.get(a.business) ?? a.business.slice(0, 8)}
                      </Link>
                    )}
                  </span>
                  <b>{a.count}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <h2 className="mb-2 font-semibold">By action</h2>
          {byAction.size === 0 ? <p className="text-muted-foreground">No errors.</p> : (
            <ul className="divide-y">
              {[...byAction.entries()].sort((a, b) => b[1] - a[1]).map(([action, n]) => (
                <li key={action} className="flex justify-between py-1.5">
                  <Link href={link({ action })} className="font-mono underline">{action}</Link><b>{n}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Errors ({list.length}{list.length === 300 ? ", newest 300" : ""})</h2>
        {list.length === 0 ? <p className="text-muted-foreground">Nothing logged for these filters.</p> : (
          <ul className="divide-y rounded-lg border">
            {list.map((r) => (
              <li key={r.id} className="grid gap-1 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={r.created_at}>{new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)} UTC</time>
                  <span className="rounded bg-muted px-1.5 font-mono">{r.action}</span>
                  {r.code && <span className="rounded bg-red-50 px-1.5 font-mono text-red-800">{r.code}</span>}
                  <span className="rounded border px-1.5">{r.source}</span>
                  {r.path && <span className="font-mono">{r.path}</span>}
                </div>
                <div className="font-medium">{r.message}</div>
                <div className="text-xs">
                  {r.user_id ? <Link href={link({ user: r.user_id })} className="underline">{r.user_email ?? r.user_id}</Link> : "Not signed in"}
                  {r.user_role && <span className="text-muted-foreground"> · {r.user_role}</span>}
                  {r.business_id && <span className="text-muted-foreground"> · {bizName.get(r.business_id) ?? r.business_id}</span>}
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Details</summary>
                  <pre className="mt-1 max-h-80 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug whitespace-pre-wrap break-all">
                    {JSON.stringify({ details: r.details, user_agent: r.user_agent, user_id: r.user_id, business_id: r.business_id }, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
