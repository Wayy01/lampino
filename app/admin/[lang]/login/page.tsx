import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminDict, adminHref } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { LoginForm } from "@/components/admin/login-form";

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "ro";
  const session = await getAdminSession();
  if (session) redirect(adminHref(locale));

  const t = getAdminDict(locale);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <span className="font-display text-3xl tracking-tight">
            Lampino<span className="text-primary">.</span>
          </span>
          <div className="label-mono mt-2 text-muted-foreground">
            {t.login.admin}
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
