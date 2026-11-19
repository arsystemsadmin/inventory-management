import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Binventory" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next} notice={error === "inactive" ? "Your account is deactivated. Ask the owner." : undefined} />;
}
