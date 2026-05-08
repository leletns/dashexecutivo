import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth-server";
import { LoginPageClient } from "@/components/auth/login-page-client";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await getPortalSession();
  if (session?.user?.email) {
    redirect("/dashboard");
  }

  const callbackUrl =
    typeof searchParams.callbackUrl === "string" && searchParams.callbackUrl.startsWith("/")
      ? searchParams.callbackUrl
      : "/dashboard";
  const authError = typeof searchParams.error === "string" ? searchParams.error : undefined;

  return (
    <LoginPageClient callbackUrl={callbackUrl} authError={authError} />
  );
}
