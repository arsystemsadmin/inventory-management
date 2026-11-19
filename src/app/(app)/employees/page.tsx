import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { EmployeesTable } from "@/components/employees/employees-table";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoEmployeesPage } from "@/components/demo/demo-pages";

export const metadata = { title: "Employees · Binventory" };

export default async function EmployeesPage() {
  if (isDemoMode) return <DemoEmployeesPage />;
  await requireOwner();
  const supabase = await createClient();
  const [{ data: profiles }, { data: pay }, { data: members }, { data: stores }, { data: open }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, active").eq("role", "employee").order("active", { ascending: false }).order("full_name"),
    supabase.from("employee_pay").select("profile_id, hourly_rate_cents"),
    supabase.from("store_members").select("store_id, profile_id"),
    supabase.from("stores").select("id, name").order("name"),
    supabase.from("time_entries").select("profile_id, store_id").is("clock_out", null),
  ]);
  const rate = new Map((pay ?? []).map((p) => [p.profile_id, p.hourly_rate_cents]));
  const employees = (profiles ?? []).map((p) => ({
    ...p,
    rate_cents: rate.get(p.id) ?? null,
    store_ids: (members ?? []).filter((m) => m.profile_id === p.id).map((m) => m.store_id),
  }));
  const clockedIn = Object.fromEntries((open ?? []).map((t) => [t.profile_id, t.store_id]));
  return (
    <>
      <EmployeesTable employees={employees} stores={stores ?? []} clockedIn={clockedIn} />
      <LiveRefresh tables={["time_entries"]} />
    </>
  );
}
