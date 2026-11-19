/**
 * Concurrency test for sell_item(): proves two people can't both sell the last unit.
 * Uses separate Postgres connections impersonating employees exactly like
 * PostgREST does (role=authenticated + request.jwt.claims).
 *
 *   npm run test:concurrency        (local Supabase must be running)
 */
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(`${cond ? "ok  " : "FAIL"} - ${msg}`);
  if (!cond) failures++;
}

async function connectAs(uid: string) {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return {
    c,
    // Each call is its own transaction, like a PostgREST request.
    async begin() {
      await c.query("begin");
      await c.query("select set_config('role','authenticated',true), set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
    },
  };
}

async function main() {
  const admin = new Client({ connectionString: DB_URL });
  await admin.connect();

  const owner = randomUUID(), emp1 = randomUUID(), emp2 = randomUUID();
  const tag = owner.slice(0, 8);
  const mkUser = (id: string, email: string, app: object, user: object) =>
    admin.query(
      `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
       values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'',now(),$3,$4,now(),now())`,
      [id, email, app, user],
    );

  await mkUser(owner, `owner-${tag}@race.test`, {}, { full_name: "Race Owner", business_name: "Race Biz" });
  const { rows: [{ business_id: biz }] } = await admin.query("select business_id from profiles where id=$1", [owner]);
  await mkUser(emp1, `e1-${tag}@race.test`, { business_id: biz }, { full_name: "Racer One" });
  await mkUser(emp2, `e2-${tag}@race.test`, { business_id: biz }, { full_name: "Racer Two" });
  const { rows: [{ id: store }] } = await admin.query(
    "insert into stores (business_id,name,type) values ($1,'Race Store','permanent') returning id", [biz]);
  await admin.query("insert into store_members (store_id,profile_id,business_id) values ($1,$2,$3),($1,$4,$3)",
    [store, emp1, biz, emp2]);
  const mkItem = async (qty: number) =>
    (await admin.query("insert into items (store_id,name,size,color,price_cents,quantity) values ($1,'Race Tee','M','Black',2000,$2) returning id",
      [store, qty])).rows[0].id as string;

  try {
    // ---- 1. Deterministic interleaving: A holds the lock, B waits, A commits.
    console.log("\n# Scenario 1: two employees sell the last unit at the same moment");
    const lastUnit = await mkItem(1);
    const a = await connectAs(emp1), b = await connectAs(emp2);
    await a.begin(); await b.begin();
    const resA = await a.c.query("select sell_item($1,1) as r", [lastUnit]); // takes row lock
    let bSettled = false;
    const pB = b.c.query("select sell_item($1,1) as r", [lastUnit]).then(
      (r) => ({ ok: true as const, r }), (e) => ({ ok: false as const, e }),
    ).finally(() => { bSettled = true; });
    await new Promise((r) => setTimeout(r, 300));
    check(!bSettled, "second seller is blocked on the row lock while the first is in progress");
    await a.c.query("commit");
    const outB = await pB;
    await b.c.query("rollback");
    check(resA.rows[0].r.status_after === "OUT", "first seller succeeds (item now OUT)");
    check(!outB.ok && /OUT_OF_STOCK/.test(String((outB as { e: Error }).e.message)),
      `second seller gets a clear error: ${!outB.ok ? (outB as { e: Error }).e.message : "succeeded!?"}`);
    await a.c.end(); await b.c.end();

    // ---- 2. Burst: 12 parallel single-unit sales against 5 in stock.
    console.log("\n# Scenario 2: 12 simultaneous sales of 1 unit against 5 in stock");
    const burstItem = await mkItem(5);
    const clients = await Promise.all(Array.from({ length: 12 }, (_, i) => connectAs(i % 2 ? emp1 : emp2)));
    const results = await Promise.all(clients.map(async (s) => {
      await s.begin();
      try { await s.c.query("select sell_item($1,1)", [burstItem]); await s.c.query("commit"); return "ok"; }
      catch (e) { await s.c.query("rollback"); return (e as Error).message; }
      finally { await s.c.end(); }
    }));
    const ok = results.filter((r) => r === "ok").length;
    const oos = results.filter((r) => r === "OUT_OF_STOCK").length;
    const { rows: [state] } = await admin.query(
      `select i.quantity,
              (select count(*)::int from sales where item_id=i.id) as sales,
              (select count(*)::int from inventory_movements where item_id=i.id and reason='sale') as movements
       from items i where id=$1`, [burstItem]);
    check(ok === 5, `exactly 5 sales succeeded (got ${ok})`);
    check(oos === 7, `the other 7 got OUT_OF_STOCK (got ${oos})`);
    check(state.quantity === 0, `final quantity is 0, never negative (got ${state.quantity})`);
    check(state.sales === 5 && state.movements === 5, `5 sale rows and 5 movement rows (got ${state.sales}/${state.movements})`);
  } finally {
    await admin.query("delete from sales where business_id=$1", [biz]);
    await admin.query("delete from items where business_id=$1", [biz]);
    await admin.query("delete from auth.users where id = any($1)", [[owner, emp1, emp2]]);
    await admin.query("delete from businesses where id=$1", [biz]);
    await admin.end();
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll concurrency checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
