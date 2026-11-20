import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Binventory" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next} notice={error === "inactive" ? "Your account is deactivated. Ask the owner." : error === "link" ? "That link has expired or was already used. Sign in, or sign up again." : undefined} />;
}
