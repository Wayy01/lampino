"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers, requireUserManager } from "@/lib/admin/session";
import { hashPassword } from "@/lib/admin/password";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import {
  ActionRefusal,
  runAction,
  runFormAction,
  type ActionResult,
} from "@/lib/admin/errors";

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
  const lang = langFromForm(fd);
  const session = await requireUserManager(lang);

  return runFormAction(lang, async () => {
    const errors = getAdminDict(lang).users.errors;

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

    // The form only offers admin/editor. A `superadmin` keeps its role, and
    // nobody changes their own (an admin can't lock themselves out).
    const existing =
      id === null
        ? null
        : await prisma.adminUser.findUnique({ where: { id }, select: { role: true } });
    if (id !== null && !existing) return { error: getAdminDict(lang).errors.recordMissing };
    if (existing?.role === "superadmin" && session.role !== "superadmin") {
      throw new ActionRefusal("superadminProtected");
    }
    const role =
      existing && (existing.role === "superadmin" || id === session.userId)
        ? existing.role
        : str(fd, "role") === "admin"
          ? "admin"
          : "editor";

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
  });
}

export async function deleteUser(
  lang: AdminLang,
  currentUserId: number,
  id: number,
): Promise<ActionResult> {
  const session = await requireUserManager(lang);
  return runAction(lang, async () => {
      // The UI never offers these deletions, but a direct POST reaches here —
      // and now gets told why it was refused rather than appearing to succeed.
      if (id === session.userId || id === currentUserId) {
        throw new ActionRefusal("cannotDeleteSelf");
      }
      const target = await prisma.adminUser.findUnique({ where: { id }, select: { role: true } });
      if (!target) return;
      if (target.role === "superadmin" && session.role !== "superadmin") {
        throw new ActionRefusal("superadminProtected");
      }
      // Someone must still be able to manage accounts afterwards.
      const managers = await prisma.adminUser.count({
        where: { role: { in: ["admin", "superadmin"] } },
      });
      if (canManageUsers(target.role) && managers <= 1) {
        throw new ActionRefusal("cannotDeleteLastAdmin");
      }

      await prisma.adminUser.delete({ where: { id } });
      revalidatePath("/admin/[lang]/users", "page");
  });
}
