"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { hashPassword } from "@/lib/admin/password";
import { getAdminDict, langFromForm } from "@/lib/admin/i18n";

export type UserActionState = { ok?: boolean; error?: string } | null;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function saveUser(
  id: number | null,
  _prev: UserActionState,
  fd: FormData,
): Promise<UserActionState> {
  await requireAdmin(langFromForm(fd));
  const errors = getAdminDict(langFromForm(fd)).users.errors;

  const username = str(fd, "username");
  if (!username) return { error: errors.usernameRequired };

  const email = str(fd, "email");
  if (!email || !EMAIL.test(email)) return { error: errors.emailRequired };

  // Required when creating; blank on edit means "keep the current password".
  const password = String(fd.get("password") ?? "");
  if (id === null && !password) return { error: errors.passwordRequired };
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return { error: errors.passwordTooShort };
  }

  const role = str(fd, "role") === "admin" ? "admin" : "editor";

  const usernameClash = await prisma.adminUser.findFirst({ where: { username } });
  if (usernameClash && usernameClash.id !== id) {
    return { error: errors.usernameInUse };
  }
  const emailClash = await prisma.adminUser.findFirst({ where: { email } });
  if (emailClash && emailClash.id !== id) return { error: errors.emailInUse };

  if (id === null) {
    await prisma.adminUser.create({
      data: { username, email, role, password: hashPassword(password) },
    });
  } else {
    await prisma.adminUser.update({
      where: { id },
      // Omit `password` entirely when the field was left blank.
      data: {
        username,
        email,
        role,
        ...(password ? { password: hashPassword(password) } : {}),
      },
    });
  }

  revalidatePath("/admin/[lang]/users", "page");
  return { ok: true };
}

export async function deleteUser(
  currentUserId: number,
  id: number,
): Promise<void> {
  const session = await requireAdmin();
  // The UI never offers these deletions; a direct POST is a silent no-op since
  // ConfirmButton's action returns void and cannot surface a message.
  if (id === session.userId || id === currentUserId) return;
  if ((await prisma.adminUser.count()) <= 1) return;

  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/[lang]/users", "page");
}
