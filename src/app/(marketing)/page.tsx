import Link from "next/link";
import {
  ArrowRight, Bell, Boxes, Clock, Layers, Lock, Package, Plus, ScanBarcode, ShieldCheck, Shirt, Smartphone,
  Store, TrendingUp, Truck, UserCog, Users, Wallet, WifiOff, CreditCard, FileDown, Coffee, Eye,
} from "lucide-react";
import { DashboardMock, PhoneSellMock } from "@/components/landing/mockups";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DemoLandingRedirect } from "@/components/demo/demo-landing-redirect";
import { getT } from "@/i18n/server";
import type { TFunction } from "i18next";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("landing.metaTitle"), description: t("landing.metaDescription") };
}

const NAV = [["why", "#why"], ["how", "#how"], ["features", "#features"], ["next", "#next"], ["faq", "#faq"]] as const;

function Logo({ t }: { t: TFunction }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--blue)] text-white shadow-sm"><Boxes className="size-5" /></span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold">Binventory</span>
        <span className="block text-[11px] text-[var(--muted)]">{t("landing.tagline1")}<br className="hidden sm:block" /><span className="sm:hidden"> </span>{t("landing.tagline2")}</span>
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

const STEPS = ["setup", "sell", "low", "live"] as const;
const LIVE = [[TrendingUp, "feed"], [Package, "restock"], [Wallet, "wages"]] as const;
const WHY = [[Users, "serve"], [Eye, "twoMarkets"], [Truck, "rightStock"], [Coffee, "closeDay"]] as const;
const HOW = [
  { n: 1, k: "create", ui: () => <span className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white">Riverside Flea Market · Nov 17–22</span> },
  { n: 2, k: "addStock", ui: (t: TFunction) => <span className="rounded-lg bg-white px-3 py-2 text-xs text-[var(--ink)]">Linen Shirt · M · Navy · {t("sell.inStock", { count: 4 })}</span> },
  { n: 3, k: "lock", ui: (t: TFunction) => <span className="flex items-center gap-1.5 rounded-lg bg-violet-500/90 px-3 py-2 text-xs font-semibold text-white"><Lock className="size-3.5" /> {t("landing.how.lockedBadge")}</span> },
  { n: 4, k: "sell", ui: (t: TFunction) => <span className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white">{t("sell.confirm", { label: "2 × M · Dark wash" })}</span> },
  { n: 5, k: "warn", ui: (t: TFunction) => <span className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">{t("sell.nowCritical", { name: "Bucket Hat (Black)" })}</span> },
  { n: 6, k: "charge", ui: (t: TFunction) => <span className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[var(--ink)]"><Bell className="size-3.5 text-[var(--blue)]" /> {t("toasts.newSale", { label: "2 × Denim Jacket" })} · ₪360</span> },
] as const;
const FEATURES = [[Smartphone, "twoTap"], [Shirt, "variants"], [Bell, "alerts"], [ShieldCheck, "approvals"], [Clock, "payroll"], [Store, "stores"]] as const;
const NEXT = [[ScanBarcode, "barcode"], [WifiOff, "offline"], [CreditCard, "cards"], [Layers, "transfers"], [FileDown, "reports"], [UserCog, "managers"]] as const;
const FAQ = ["training", "phones", "lastOne", "prices", "pay", "separate", "internet", "start"] as const;

export default async function LandingPage() {
  const t = await getT();
  return (
    <div className="landing min-h-dvh">
      <DemoLandingRedirect />
      {/* Fonts for the landing page only */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fonts are only for this page */}
      <link rel="stylesheet" precedence="default"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" />

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Logo t={t} />
          <nav className="ms-6 hidden items-center gap-6 text-sm text-[var(--muted)] lg:flex">
            {NAV.map(([k, h]) => <a key={h} href={h} className="hover:text-[var(--ink)]">{t(`landing.nav.${k}`)}</a>)}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher className="bg-white" />
            <Link href="/login" className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--blue-soft)]">{t("landing.logIn")}</Link>
            <Link href="/signup" className="hidden rounded-full bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--blue-deep)] sm:block">{t("landing.getStarted")}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-[var(--blue)] px-2 py-0.5 text-[10px] font-bold text-white">V1</span>
            {t("landing.pill")}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            {t("landing.heroTitle")}
            <span className="mt-1 block text-[1.05em] font-normal"><span className="serif mark">{t("landing.heroAccent")}</span></span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            {t("landing.heroBody")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--blue-deep)]">
              {t("landing.getStarted")} <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
            <Link href="/login" className="rounded-full border border-[var(--line)] bg-white px-6 py-3 text-sm font-semibold hover:bg-[var(--blue-soft)]">{t("landing.logIn")}</Link>
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl">
          <DashboardMock />
          <div className="absolute -bottom-10 end-2 hidden sm:block lg:-end-8"><PhoneSellMock /></div>
        </div>
        <div className="mx-auto mt-6 flex justify-center sm:hidden"><PhoneSellMock /></div>

        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 sm:mt-20 sm:grid-cols-4">
          {STEPS.map((k, i) => (
            <li key={k} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--blue-soft)] text-xs font-bold text-[var(--blue)]">{i + 1}</span>
              <span><span className="block text-sm font-semibold">{t(`landing.steps.${k}.title`)}</span><span className="block text-xs text-[var(--muted)]">{t(`landing.steps.${k}.body`)}</span></span>
            </li>
          ))}
        </ol>
      </section>

      {/* Live view */}
      <section className="mx-auto max-w-6xl px-4 pt-24">
        <Heading eyebrow={t("landing.live.eyebrow")} title={t("landing.live.title")} accent={t("landing.live.accent")}
          sub={t("landing.live.sub")} />
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {LIVE.map(([I, k]) => (
            <div key={k} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <IconTile icon={I} />
              <div className="mt-3 font-semibold">{t(`landing.live.cards.${k}.title`)}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{t(`landing.live.cards.${k}.body`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section id="why" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <Heading eyebrow={t("landing.nav.why")} title={t("landing.why.title")} accent={t("landing.why.accent")}
          sub={t("landing.why.sub")} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(([I, k]) => (
            <div key={k} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <IconTile icon={I} />
              <div className="mt-3 font-semibold">{t(`landing.why.cards.${k}.title`)}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{t(`landing.why.cards.${k}.body`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 px-2 pt-24 sm:px-4">
        <div className="mx-auto max-w-7xl rounded-3xl bg-[var(--night)] px-4 py-16 sm:px-10">
          <Heading night title={t("landing.how.title")} accent={t("landing.how.accent")} sub={t("landing.how.sub")} />
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/[0.06] p-4">
                <div className="grid h-24 place-items-center rounded-xl bg-white/[0.05]">{s.ui(t)}</div>
                <div className="mt-4 flex items-center gap-2 font-semibold text-white">
                  <span className="grid size-6 place-items-center rounded-full bg-white/10 text-xs">{s.n}</span>{t(`landing.how.steps.${s.k}.title`)}
                </div>
                <p className="mt-1 text-sm text-white/60">{t(`landing.how.steps.${s.k}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <Heading
          eyebrow={<><span className="me-2 rounded-full bg-[var(--blue)] px-2 py-0.5 text-[10px] font-bold text-white">V1</span>{t("landing.features.eyebrow")}</>}
          title={t("landing.features.title")} accent={t("landing.features.accent")} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([I, k]) => (
            <div key={k} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <IconTile icon={I} />
              <div className="eyebrow mt-4 text-[var(--blue)]">{t(`landing.features.cards.${k}.eyebrow`)}</div>
              <div className="mt-1 text-lg font-bold">{t(`landing.features.cards.${k}.title`)}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{t(`landing.features.cards.${k}.body`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Coming next */}
      <section id="next" className="mt-24 scroll-mt-20 bg-[#eef2f9] px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <Heading
            eyebrow={<><span className="me-2 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-white">V2</span>{t("landing.next.eyebrow")}</>}
            title={t("landing.next.title")} accent={t("landing.next.accent")}
            sub={t("landing.next.sub")} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NEXT.map(([I, k]) => (
              <div key={k} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <div className="flex items-start justify-between">
                  <IconTile icon={I} />
                  <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-semibold text-white">{t("landing.next.badge")}</span>
                </div>
                <div className="eyebrow mt-4 text-[var(--blue)]">{t(`landing.next.cards.${k}.eyebrow`)}</div>
                <div className="mt-1 text-lg font-bold">{t(`landing.next.cards.${k}.title`)}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{t(`landing.next.cards.${k}.body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-20">
        <Heading eyebrow={t("landing.nav.faq")} title={t("landing.faq.title")} accent={t("landing.faq.accent")} />
        <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {FAQ.map((k) => (
            <details key={k} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                {t(`landing.faq.items.${k}.q`)}
                <Plus className="faq-plus size-4 shrink-0 text-[var(--blue)] transition-transform" />
              </summary>
              <p className="mt-2 text-sm text-[var(--muted)]">{t(`landing.faq.items.${k}.a`)}</p>
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
              {t("landing.cta.title")}
              <span className="mt-1 block font-normal"><span className="serif mark-night">{t("landing.cta.accent")}</span></span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/70">{t("landing.cta.body")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--blue-soft)]">
                {t("landing.getStarted")} <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
              <Link href="/login" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">{t("landing.logIn")}</Link>
            </div>
            <p className="mt-6 text-xs text-white/50">{t("landing.cta.footnote")}</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{t("landing.footer")}</span>
        <span className="flex gap-5">
          <a href="#features" className="text-[var(--blue)] hover:underline">{t("landing.nav.features")}</a>
          <a href="mailto:info@arsystems.dev" className="text-[var(--blue)] hover:underline">info@arsystems.dev</a>
          <a href="https://arsystems.dev" className="text-[var(--blue)] hover:underline">arsystems.dev</a>
        </span>
      </footer>
    </div>
  );
}
