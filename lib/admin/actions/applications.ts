"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { APPLICATION_STATUSES } from "@/lib/admin/application-status";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import { runAction, runFormAction, type ActionResult } from "@/lib/admin/errors";

export type ApplicationActionState = { ok?: boolean; error?: string } | null;

export async function updateApplicationStatus(
  id: number,
  _prev: ApplicationActionState,
  fd: FormData,
): Promise<ApplicationActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const status = String(fd.get("status") ?? "");
    if (
      !APPLICATION_STATUSES.includes(
        status as (typeof APPLICATION_STATUSES)[number],
      )
    ) {
      return { error: getAdminDict(lang).applications.errors.unknownStatus };
    }
    await prisma.rentalApplication.update({ where: { id }, data: { status } });
    revalidatePath("/admin/[lang]/applications", "page");
    revalidatePath("/admin/[lang]/applications/[id]", "page");
    return { ok: true };
  });
}

export async function deleteApplication(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.rentalApplication.delete({ where: { id } });
    revalidatePath("/admin/[lang]/applications", "page");
    redirect(`/admin/${lang}/applications`);
  });
}
