"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/admin/password";
import { createAdminSession, destroyAdminSession } from "@/lib/admin/session";
import { getAdminDict, langFromForm } from "@/lib/admin/i18n";

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const lang = langFromForm(formData);
  const t = getAdminDict(lang).login;

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: t.missingCredentials };
  }

  const user = await prisma.adminUser.findFirst({
    where: { OR: [{ username }, { email: username }] },
  });
  if (!user || !verifyPassword(password, user.password)) {
    return { error: t.invalidCredentials };
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });
  await createAdminSession(user);
  redirect(`/admin/${lang}`);
}

export async function logout(lang: string): Promise<void> {
  await destroyAdminSession();
  redirect(`/admin/${lang === "ru" ? "ru" : "ro"}/login`);
}
