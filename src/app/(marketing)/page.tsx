import Link from "next/link";
import {
  ArrowRight, Bell, Boxes, Clock, Layers, Lock, Package, Plus, ScanBarcode, ShieldCheck, Shirt, Smartphone,
  Store, TrendingUp, Truck, UserCog, Users, Wallet, WifiOff, CreditCard, FileDown, Coffee, Eye,
} from "lucide-react";
import { DashboardMock, PhoneSellMock } from "@/components/landing/mockups";

export const metadata = {
  title: "Binventory · Inventory for pop-up stores by AR Systems",
  description:
    "Binventory keeps every item at every market counted. Staff sell in two taps from their phones, you see stock and sales live from anywhere. Inventory for pop-up stores by AR Systems.",
};

const NAV = [["Why Binventory", "#why"], ["How it works", "#how"], ["Features", "#features"], ["Coming next", "#next"], ["FAQ", "#faq"]];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--blue)] text-white shadow-sm"><Boxes className="size-5" /></span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold">Binventory</span>
        <span className="block text-[11px] text-[var(--muted)]">Inventory for pop-ups<br className="hidden sm:block" /><span className="sm:hidden"> </span>by AR Systems</span>
      </span>
    </Link>
  );
}

function Heading({ eyebrow, title, accent, sub, night = false }: { eyebrow?: React.ReactNode; title: string; accent: string; sub?: string; night?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <div className={`eyebrow mb-3 ${night ? "text-white/60" : "text-[var(--muted)]"}`}>{eyebrow}</div>}
      <h2 className={`text-3xl font-extrabold tracking-tight sm:text-5xl ${night ? "text-white" : ""}`}>
        {title} <span className={`serif ${night ? "mark-night" : "mark"}`}>{accent}</span>
      </h2>
      {sub && <p className={`mt-4 text-base sm:text-lg ${night ? "text-white/70" : "text-[var(--muted)]"}`}>{sub}</p>}
    </div>
  );
}

function IconTile({ icon: Icon }: { icon: typeof Store }) {
  return <span className="grid size-10 place-items-center rounded-xl bg-[var(--blue-soft)] text-[var(--blue)]"><Icon className="size-5" /></span>;
}

const STEPS = [
  ["Set up the pop-up", "Add every size and color once"],
  ["Sell in two taps", "Right from your staff's phones"],
  ["Know what's running low", "Warnings before you run out"],
  ["Watch it live", "Every store, from anywhere"],
];

const WHY = [
  [Users, "Serve the customer in front of you", "No notebook, no tally sheet. Tap the item, pick the size and color, done."],
  [Eye, "Be at two markets at once", "See every sale at every stall the moment it happens, wherever you are."],
  [Truck, "Bring the right stock", "Low and out-of-stock warnings tell you exactly what to restock before the next market."],
  [Coffee, "Close the day in minutes", "Sales, stock and hours already add up. Nothing left to count at midnight."],
];

const HOW = [
  { n: 1, t: "Create your pop-up", d: "Add the market, its dates and its location. Permanent shops work too.", ui: <span className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white">Riverside Flea Market · Nov 17–22</span> },
  { n: 2, t: "Your team adds the stock", d: "One entry per size and color, with price and quantity. Fast to do on a phone.", ui: <span className="rounded-lg bg-white px-3 py-2 text-xs text-[var(--ink)]">Linen Shirt · M · Navy · 4 in stock</span> },
  { n: 3, t: "Finish setup to lock it", d: "From now on, changes and removals go to you for approval.", ui: <span className="flex items-center gap-1.5 rounded-lg bg-violet-500/90 px-3 py-2 text-xs font-semibold text-white"><Lock className="size-3.5" /> Setup finished</span> },
  { n: 4, t: "Sell in two taps", d: "Pick the size and color, set how many, confirm. Stock updates instantly.", ui: <span className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white">Confirm sale · 2 × M · Dark wash</span> },
  { n: 5, t: "Warnings before you run out", d: "Low, critical and out-of-stock items show up everywhere you look.", ui: <span className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Bucket Hat (Black) is critically low</span> },
  { n: 6, t: "You stay in charge", d: "Approve edits and voids, and see hours and wages owed as shifts run.", ui: <span className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[var(--ink)]"><Bell className="size-3.5 text-[var(--blue)]" /> New sale · 2 × Denim Jacket · ₪360</span> },
];

const FEATURES = [
  [Smartphone, "Built for the stall", "Two-tap selling", "Big buttons, size and color chips, and a quantity stepper. Made for a phone in one hand."],
  [Shirt, "Every variant counted", "Size and color", "Each size and color has its own stock, and every sale records exactly which one sold."],
  [Bell, "Before you run out", "Stock alerts", "Out, critical and low badges on every item, a restock list, and a warning right after the sale that caused it."],
  [ShieldCheck, "Nothing goes missing", "Owner approvals", "After setup, editing items, removing stock and voiding sales all need your OK."],
  [Clock, "Fair, automatic pay", "Clock in and payroll", "Staff clock in at the market. Hours and wages owed add up live, at the rate the shift started with."],
  [Store, "Every stall separate", "Stores and staff", "Run several pop-ups and shops at once. Each employee only sees the stores they work at."],
];

const NEXT = [
  [ScanBarcode, "Barcode scanning", "Scan to sell", "Scan a tag with the phone camera to find the right size and color instantly."],
  [WifiOff, "Offline mode", "No signal, no problem", "Keep selling when the market Wi-Fi drops. Everything syncs when you're back online."],
  [CreditCard, "Card payments", "Take payment in the app", "Connect your card reader so the sale and the payment are one step."],
  [Layers, "Stock transfers", "Move stock between stores", "Send leftover stock from one pop-up to the next, with every unit tracked."],
  [FileDown, "Reports and export", "Know what really sells", "Best sellers by market, margins by item, and exports for your accountant."],
  [UserCog, "Managers", "Share the load", "Add managers and co-owners who can approve changes when you're away."],
];

const FAQ = [
  ["Do my employees need training?", "Not really. They open the store, tap Sell, pick the size and color and confirm. Adding items is a short form, and there's a \"Save & add another size\" button for fast setup."],
  ["Does it work on phones?", "Yes. Every employee screen is designed for phones first, with large buttons and a bottom tab bar. Owners can use a laptop or a phone."],
  ["What if two people sell the last one at the same time?", "Only one sale goes through. The other person gets a clear \"out of stock\" message, so you never sell something you don't have."],
  ["Can employees change prices or delete items?", "During setup they can edit everything. Once setup is finished, edits, stock removals, deleting items and voiding sales all come to you for approval. Adding new stock is always allowed."],
  ["Can employees see each other's pay?", "No. Each employee sees only their own rate and earnings. Only the owner sees everyone's pay and payroll."],
  ["Is my data separate from other businesses?", "Yes. Every business is fully separated, and inside a business each employee only sees the stores they're assigned to."],
  ["Do I need internet at the market?", "For now, yes: a phone with mobile data is enough. Offline mode is planned for the next version."],
  ["How do I get started?", "Create your account, add your first pop-up, invite your team and add your stock. You can try it right away with sample data."],
];

export default function LandingPage() {
  return (
    <div className="landing min-h-dvh">
      {/* Fonts for the landing page only */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fonts are only for this page */}
      <link rel="stylesheet" precedence="default"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" />

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Logo />
          <nav className="ml-6 hidden items-center gap-6 text-sm text-[var(--muted)] lg:flex">
            {NAV.map(([l, h]) => <a key={h} href={h} className="hover:text-[var(--ink)]">{l}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--blue-soft)]">Log in</Link>
            <Link href="/signup" className="hidden rounded-full bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--blue-deep)] sm:block">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-[var(--blue)] px-2 py-0.5 text-[10px] font-bold text-white">V1</span>
            Inventory for pop-up stores by AR Systems
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Every item at every market, counted.
            <span className="mt-1 block text-[1.05em] font-normal"><span className="serif mark">Sold in two taps.</span></span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            Binventory keeps the stock for each of your pop-ups and shops in one place. Your team sells from their phones,
            stock updates the moment something sells, and you see every store live, so you can focus on the customers
            at your table.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--blue-deep)]">
              Get started <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className="rounded-full border border-[var(--line)] bg-white px-6 py-3 text-sm font-semibold hover:bg-[var(--blue-soft)]">Log in</Link>
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl">
          <DashboardMock />
          <div className="absolute -bottom-10 right-2 hidden sm:block lg:-right-8"><PhoneSellMock /></div>
        </div>
        <div className="mx-auto mt-6 flex justify-center sm:hidden"><PhoneSellMock /></div>

        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 sm:mt-20 sm:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--blue-soft)] text-xs font-bold text-[var(--blue)]">{i + 1}</span>
              <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-[var(--muted)]">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>

      {/* Live view */}
      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Heading eyebrow="Your dashboard" title="Every store, live," accent="from anywhere."
          sub="Sales today and this week per store, who's on shift and what they've earned, and everything running low. It updates the moment a sale happens." />
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[[TrendingUp, "Sales as they happen", "A live feed of every sale, with a pop-up for each new one."],
            [Package, "Restock list", "Everything low or out, across all stores, worst first."],
            [Wallet, "Wages owed so far", "Hours and pay for shifts that are still running."]].map(([I, t, d]) => (
            <div key={t as string} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <IconTile icon={I as typeof Store} />
              <div className="mt-3 font-semibold">{t as string}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{d as string}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section id="why" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <Heading eyebrow="Why Binventory" title="Less counting." accent="More selling."
          sub="Tally sheets, guesswork and end-of-day counting eat into the time you should spend selling. Binventory keeps track for you." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(([I, t, d]) => (
            <div key={t as string} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <IconTile icon={I as typeof Store} />
              <div className="mt-3 font-semibold">{t as string}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{d as string}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 px-2 pt-24 sm:px-4">
        <div className="mx-auto max-w-7xl rounded-3xl bg-[var(--night)] px-4 py-16 sm:px-10">
          <Heading night title="How it" accent="works." sub="One pop-up, from setting up the stall to the end of the day." />
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/[0.06] p-4">
                <div className="grid h-24 place-items-center rounded-xl bg-white/[0.05]">{s.ui}</div>
                <div className="mt-4 flex items-center gap-2 font-semibold text-white">
                  <span className="grid size-6 place-items-center rounded-full bg-white/10 text-xs">{s.n}</span>{s.t}
                </div>
                <p className="mt-1 text-sm text-white/60">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <Heading
          eyebrow={<><span className="mr-2 rounded-full bg-[var(--blue)] px-2 py-0.5 text-[10px] font-bold text-white">V1</span>Available now</>}
          title="Everything you need to" accent="sell with confidence." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([I, e, t, d]) => (
            <div key={t as string} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <IconTile icon={I as typeof Store} />
              <div className="eyebrow mt-4 text-[var(--blue)]">{e as string}</div>
              <div className="mt-1 text-lg font-bold">{t as string}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{d as string}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Coming next */}
      <section id="next" className="mt-24 scroll-mt-20 bg-[#eef2f9] px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <Heading
            eyebrow={<><span className="mr-2 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-white">V2</span>In development</>}
            title="What we're" accent="building next."
            sub="The next version of Binventory makes the stall even faster and gives you a clearer picture of what sells." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NEXT.map(([I, e, t, d]) => (
              <div key={t as string} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <div className="flex items-start justify-between">
                  <IconTile icon={I as typeof Store} />
                  <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-semibold text-white">Coming in V2</span>
                </div>
                <div className="eyebrow mt-4 text-[var(--blue)]">{e as string}</div>
                <div className="mt-1 text-lg font-bold">{t as string}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{d as string}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-20">
        <Heading eyebrow="FAQ" title="Questions," accent="answered." />
        <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                {q}
                <Plus className="faq-plus size-4 shrink-0 text-[var(--blue)] transition-transform" />
              </summary>
              <p className="mt-2 text-sm text-[var(--muted)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-2 pt-20 sm:px-4">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[var(--night)] px-4 py-16 text-center sm:py-20">
          <div className="pointer-events-none absolute inset-x-0 -bottom-40 mx-auto h-80 max-w-3xl rounded-full bg-[var(--blue)] opacity-40 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Every item counted.
              <span className="mt-1 block font-normal"><span className="serif mark-night">Every market a little easier.</span></span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/70">Set up your first pop-up in minutes. Your team can start selling the same day.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--blue-soft)]">
                Get started <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">Log in</Link>
            </div>
            <p className="mt-6 text-xs text-white/50">Works on any phone · Each store kept separate · You stay in control</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>Binventory · Inventory for pop-up stores by AR Systems</span>
        <span className="flex gap-5">
          <a href="#features" className="text-[var(--blue)] hover:underline">Features</a>
          <a href="mailto:info@arsystems.dev" className="text-[var(--blue)] hover:underline">info@arsystems.dev</a>
          <a href="https://arsystems.dev" className="text-[var(--blue)] hover:underline">arsystems.dev</a>
        </span>
      </footer>
    </div>
  );
}
