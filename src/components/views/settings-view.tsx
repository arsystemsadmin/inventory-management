"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Globe, Smartphone, Store, UserRound } from "lucide-react";
import { InstallCard } from "@/components/pwa/install-prompt";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useActiveStore } from "@/lib/active-store";
import { useActions } from "@/lib/actions-context";
import type { Profile } from "@/lib/types";
import { useT } from "@/i18n/client";

/** Your profile, the store you work in, and app preferences. Same for owners and employees. */
export function SettingsView({
  profile, businessName, signOut,
}: {
  profile: Pick<Profile, "full_name" | "email" | "role" | "default_store_id">;
  businessName: string;
  signOut?: React.ReactNode;
}) {
  const t = useT();
  const actions = useActions();
  const { activeStoreId, stores, setActiveStore } = useActiveStore();
  const isOwner = profile.role === "owner";
  const [name, setName] = useState(profile.full_name);
  const [business, setBusiness] = useState(businessName);
  const [defaultStore, setDefaultStore] = useState(profile.default_store_id ?? "");
  const [pending, startTransition] = useTransition();

  // Pick up saved values after a refresh.
  useEffect(() => { setName(profile.full_name); setDefaultStore(profile.default_store_id ?? ""); }, [profile.full_name, profile.default_store_id]);
  useEffect(() => { setBusiness(businessName); }, [businessName]);

  const dirty = name.trim() !== profile.full_name || defaultStore !== (profile.default_store_id ?? "")
    || (isOwner && business.trim() !== businessName);
  const missing = !name.trim() || (isOwner && !business.trim());

  const save = () => {
    if (missing) { toast.error(t("form.fillRequired")); return; }
    startTransition(async () => {
      const res = await actions.updateMySettings({
        full_name: name.trim(),
        default_store_id: defaultStore || null,
        ...(isOwner ? { business_name: business.trim() } : {}),
      });
      if (res.ok) toast.success(res.message); else toast.error(res.error);
    });
  };

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="size-4" /> {t("settings.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="settings-name">{t("settings.fullName")} *</Label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!name.trim()} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="settings-email">{t("settings.email")}</Label>
            <Input id="settings-email" value={profile.email} readOnly disabled dir="ltr" />
            <p className="text-xs text-muted-foreground">{t("settings.emailNote")}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("settings.role")}</span>
            <Badge variant="secondary">{isOwner ? t("common.owner") : t("common.employee")}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="size-4" /> {t("settings.stores")}</CardTitle>
          <CardDescription>{t("settings.storesNote")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isOwner ? t("settings.noStoresOwner") : t("settings.noStoresEmployee")}</p>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="settings-active">{t("settings.activeStore")}</Label>
                <NativeSelect id="settings-active" value={activeStoreId} onChange={(e) => setActiveStore(e.target.value)}>
                  {stores.length > 1 && <option value="">{t("common.allStores")}</option>}
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{t("settings.activeStoreNote")}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="settings-default">{t("settings.defaultStore")}</Label>
                <NativeSelect id="settings-default" value={defaultStore} onChange={(e) => setDefaultStore(e.target.value)}>
                  <option value="">{stores.length > 1 ? t("common.allStores") : t("settings.noDefault")}</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{t("settings.defaultStoreNote")}</p>
              </div>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">{isOwner ? t("settings.allYourStores") : t("settings.storesYouWorkIn")}</span>
                <ul className="flex flex-wrap gap-2">
                  {stores.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStore(s.id)}
                        className={`rounded-full border px-3 py-1 text-sm ${s.id === activeStoreId ? "border-foreground bg-foreground text-background" : ""}`}
                      >
                        {s.name}
                        {s.id === (profile.default_store_id ?? "") && <span className="ms-1 text-xs opacity-70">· {t("settings.defaultTag")}</span>}
                        {s.status === "closed" && <span className="ms-1 text-xs opacity-70">· {t("settings.closedTag")}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {activeStoreId && <p className="text-xs text-muted-foreground">{t("settings.workingIn", { store: storeName(activeStoreId) })}</p>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-4" /> {t("settings.business")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            <Label htmlFor="settings-business">{t("settings.businessName")} *</Label>
            <Input id="settings-business" value={business} onChange={(e) => setBusiness(e.target.value)} aria-invalid={!business.trim()} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="size-4" /> {t("settings.preferences")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <span className="text-sm">{t("common.language")}</span>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="size-4" /> {t("install.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent><InstallCard /></CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {signOut}
        <Button size="lg" onClick={save} disabled={pending || !dirty} className="ms-auto">
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
