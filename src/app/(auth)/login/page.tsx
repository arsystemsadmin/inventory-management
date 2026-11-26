import { LoginForm } from "./login-form";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("auth.signIn")} · Binventory` };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const t = await getT();
  return <LoginForm next={next} notice={error === "inactive" ? t("auth.deactivated") : error === "link" ? t("auth.linkExpired") : undefined} />;
}
